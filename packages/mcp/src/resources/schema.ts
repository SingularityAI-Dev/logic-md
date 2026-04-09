import { getSchema } from "@logic-md/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Compute schema text at module load time, not per-request
const schemaText = JSON.stringify(getSchema(), null, 2);

export function registerSchemaResource(server: McpServer): void {
	server.registerResource(
		"logic-md-schema",
		"logic-md://schema",
		{
			mimeType: "application/json",
			description: "JSON Schema for LOGIC.md frontmatter validation",
		},
		async () => ({
			contents: [
				{
					uri: "logic-md://schema",
					mimeType: "application/json",
					text: schemaText,
				},
			],
		}),
	);
}
