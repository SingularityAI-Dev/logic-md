import { createColors } from "picocolors";

export type Colors = ReturnType<typeof createColors>;

export function makeColors(enabled: boolean): Colors {
	return createColors(enabled);
}

export function detectColorSupport(): boolean {
	return !process.env.NO_COLOR && !process.argv.includes("--no-color");
}
