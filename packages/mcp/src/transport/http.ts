import { randomUUID } from "node:crypto";
import {
	createServer as createHttpServer,
	type IncomingMessage,
	type RequestListener,
	type ServerResponse,
} from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/** Minimal transport surface the request listener depends on. */
interface RequestHandlingTransport {
	handleRequest(req: IncomingMessage, res: ServerResponse): Promise<unknown>;
}

/**
 * Build the Node HTTP request listener that drives the MCP transport.
 *
 * Extracted so the error path can be exercised in isolation. When
 * handleRequest rejects, the client must receive a structured response rather
 * than a hung connection that only times out at the socket level.
 */
export function createRequestListener(transport: RequestHandlingTransport): RequestListener {
	return (req, res) => {
		transport.handleRequest(req, res).catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			process.stderr.write(`HTTP handler error: ${message}\n`);
			if (!res.headersSent) {
				res.statusCode = 500;
				res.setHeader("Content-Type", "application/json");
				res.end(JSON.stringify({ error: "Internal MCP server error", detail: message }));
			} else if (!res.writableEnded) {
				res.end();
			}
		});
	};
}

export async function startHttp(server: McpServer, port: number): Promise<void> {
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () => randomUUID(),
	});
	await server.connect(transport);

	const httpServer = createHttpServer(createRequestListener(transport));

	httpServer.listen(port, () => {
		process.stderr.write(`@logic-md/mcp listening on http://localhost:${port}\n`);
	});
}
