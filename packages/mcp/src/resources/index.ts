import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSchemaResource } from "./schema.js";
import { registerSpecResource } from "./spec.js";

export function registerAllResources(server: McpServer): void {
	registerSchemaResource(server);
	registerSpecResource(server);
}
