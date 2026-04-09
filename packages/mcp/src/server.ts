import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllResources } from "./resources/index.js";
import { registerAllTools } from "./tools/index.js";

// Read version from package.json at startup (not build time)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as {
	version: string;
};

export function createServer(): McpServer {
	const server = new McpServer({
		name: "logic-md",
		version: pkg.version,
	});
	// Initialize tools and resources handlers eagerly so tools/list and
	// resources/list respond even when no tools or resources are registered yet.
	// McpServer sets these up lazily on first .tool()/.resource() call — calling
	// them here ensures the server declares the capabilities and responds to
	// list requests with empty arrays in Phase 17. Phase 18 tool registration
	// uses the same handler (it reads from _registeredTools dynamically).
	(server as unknown as { setToolRequestHandlers(): void }).setToolRequestHandlers();
	(server as unknown as { setResourceRequestHandlers(): void }).setResourceRequestHandlers();
	registerAllTools(server);
	registerAllResources(server);
	return server;
}
