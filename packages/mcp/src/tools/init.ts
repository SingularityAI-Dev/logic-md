import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import { config } from "../config.js";

export function registerInitTool(server: McpServer): void {
	server.registerTool(
		"logic_md_init",
		{
			description:
				"Generate a new LOGIC.md file from a template. Returns the file content as a string -- does not write to disk.",
			inputSchema: {
				template: z
					.string()
					.describe("Template name (use logic_md_list_templates to see available templates)"),
				name: z.string().optional().describe("Agent name to substitute in the generated file"),
				description: z
					.string()
					.optional()
					.describe("Agent description to substitute in the generated file"),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ template, name, description }) => {
			// 1. Read template directory listing
			let files: string[];
			try {
				files = readdirSync(config.templatesDir).filter((f) => f.endsWith(".logic.md"));
			} catch {
				return {
					isError: true,
					content: [
						{
							type: "text" as const,
							text: "Templates directory not found",
						},
					],
				};
			}

			// 2. Build available array from filenames
			const available = files.map((f) => f.replace(/\.logic\.md$/, ""));

			// 3. Validate template name against available list
			if (!available.includes(template)) {
				return {
					isError: true,
					content: [
						{
							type: "text" as const,
							text: `Unknown template "${template}". Available: ${available.join(", ")}`,
						},
					],
				};
			}

			// 4. Read template file content
			let templateContent = readFileSync(join(config.templatesDir, `${template}.logic.md`), "utf8");

			// 5. Patch frontmatter if name or description provided
			if (name !== undefined || description !== undefined) {
				const frontmatterMatch = templateContent.match(
					/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,
				);
				if (frontmatterMatch) {
					const frontmatterRaw = frontmatterMatch[1];
					const bodyAfterFrontmatter = frontmatterMatch[2];
					const parsed = parseYaml(frontmatterRaw) as Record<string, unknown>;
					if (name !== undefined) {
						parsed.name = name;
					}
					if (description !== undefined) {
						parsed.description = description;
					}
					const patchedYaml = stringifyYaml(parsed, { lineWidth: 0 });
					templateContent = `---\n${patchedYaml}---\n${bodyAfterFrontmatter}`;
				}
			}

			// 6. Return MCP text content with JSON payload
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ content: templateContent, template_used: template }, null, 2),
					},
				],
			};
		},
	);
}
