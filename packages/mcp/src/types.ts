export interface LintIssue {
	rule: string;
	message: string;
	file: string;
	line?: number;
	column?: number;
	severity: "warning" | "info";
}
