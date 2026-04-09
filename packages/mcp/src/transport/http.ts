import { randomUUID } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export async function startHttp(server: McpServer, port: number): Promise<void> {
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
	});
	await server.connect(transport);

	const httpServer = createHttpServer((req, res) => {
		transport.handleRequest(req, res).catch((err: unknown) => {
			process.stderr.write(`HTTP handler error: ${String(err)}\n`);
		});
	});

	httpServer.listen(port, () => {
		process.stderr.write(`@logic-md/mcp listening on http://localhost:${port}\n`);
	});
}
