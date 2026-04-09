import { readFile } from "node:fs/promises";
import { compileStep, estimateTokens, parse, validate } from "@logic-md/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guardPath } from "../security/path-guard.js";

export function registerCompileStepTool(server: McpServer): void {
	server.registerTool(
		"logic_md_compile_step",
		{
			description:
				"Compile a single named step from a LOGIC.md spec into an executable form with system prompt segment, output schema, quality gates, and token estimate.",
			inputSchema: {
				content: z.string().optional().describe("LOGIC.md content to compile directly"),
				file_path: z
					.string()
					.optional()
					.describe("Path to a LOGIC.md file (must be within working directory)"),
				step_name: z.string().describe("Name of the step to compile"),
				context: z
					.object({
						currentStep: z.string().optional(),
						previousOutputs: z.record(z.string(), z.unknown()).optional(),
						input: z.unknown().optional(),
						attemptNumber: z.number().optional(),
						branchReason: z.string().nullable().optional(),
						previousFailureReason: z.string().nullable().optional(),
					})
					.optional()
					.describe("Execution context for compilation"),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ content, file_path, step_name, context }) => {
			let source: string;

			if (content !== undefined) {
				source = content;
			} else if (file_path !== undefined) {
				const guard = await guardPath(file_path);
				if (!guard.allowed) {
					return {
						isError: true,
						content: [{ type: "text" as const, text: guard.reason ?? "Path not allowed" }],
					};
				}
				try {
					source = await readFile(guard.resolved, "utf8");
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return {
						isError: true,
						content: [{ type: "text" as const, text: `Failed to read file: ${message}` }],
					};
				}
			} else {
				return {
					isError: true,
					content: [{ type: "text" as const, text: "Either content or file_path is required" }],
				};
			}

			const parseResult = parse(source);
			if (!parseResult.ok) {
				return {
					isError: true,
					content: [
						{
							type: "text" as const,
							text: `Parse failed: ${parseResult.errors.map((e) => e.message).join("; ")}`,
						},
					],
				};
			}

			const validateResult = validate(source);
			if (!validateResult.ok) {
				return {
					isError: true,
					content: [
						{
							type: "text" as const,
							text: `Validation failed: ${validateResult.errors.map((e) => e.message).join("; ")}`,
						},
					],
				};
			}

			const execContext = {
				currentStep: context?.currentStep ?? step_name,
				previousOutputs: context?.previousOutputs ?? {},
				input: context?.input ?? null,
				attemptNumber: context?.attemptNumber ?? 1,
				branchReason: context?.branchReason ?? null,
				previousFailureReason: context?.previousFailureReason ?? null,
			};

			let compiled: ReturnType<typeof compileStep>;
			try {
				compiled = compileStep(parseResult.data, step_name, execContext);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					isError: true,
					content: [{ type: "text" as const, text: `Compile failed: ${message}` }],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								systemPromptSegment: compiled.systemPromptSegment,
								outputSchema: compiled.outputSchema,
								qualityGates: compiled.qualityGates.length,
								tokenEstimate: estimateTokens(compiled.systemPromptSegment),
								tokenWarning: compiled.tokenWarning,
								metadata: compiled.metadata,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
