import { createServer } from "./server.js";
import { startHttp } from "./transport/http.js";
import { startStdio } from "./transport/stdio.js";

const useHttp = process.argv.includes("--http");
const portIdx = process.argv.indexOf("--port");
const port = portIdx !== -1 ? parseInt(process.argv[portIdx + 1]!, 10) : 3000;

// Graceful shutdown
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
process.on("unhandledRejection", (reason) => {
	process.stderr.write(`Unhandled rejection: ${String(reason)}\n`);
	process.exit(1);
});

// Stdin close = client disconnected (stdio mode)
process.stdin.on("close", () => process.exit(0));

const server = createServer();

if (useHttp) {
	await startHttp(server, port);
} else {
	await startStdio(server);
}
