import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
	// LOGIC_MD_TEMPLATES_DIR overrides the default bundled templates directory
	templatesDir: process.env.LOGIC_MD_TEMPLATES_DIR ?? join(__dirname, "../templates"),

	// LOGIC_MD_MAX_FILE_SIZE sets max file size in bytes (default 1MB)
	maxFileSize: process.env.LOGIC_MD_MAX_FILE_SIZE
		? parseInt(process.env.LOGIC_MD_MAX_FILE_SIZE, 10)
		: 1_000_000,
} as const;
