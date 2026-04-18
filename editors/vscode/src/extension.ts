import * as vscode from "vscode";

/**
 * LOGIC.md VSCode Extension
 *
 * Provides syntax highlighting and code intelligence for LOGIC.md files.
 * This extension activates when a .logic.md file is opened.
 */

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
	// Create diagnostics collection for validation messages
	diagnosticCollection = vscode.languages.createDiagnosticCollection("logic-md");
	context.subscriptions.push(diagnosticCollection);

	// Show activation message
	console.log("LOGIC.md VSCode extension activated");
	vscode.window.showInformationMessage("LOGIC.md extension is now active");

	// Handle document open
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => {
			if (isLogicMdFile(doc)) {
				validateDocument(doc);
			}
		}),
	);

	// Handle document change
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (isLogicMdFile(event.document)) {
				validateDocument(event.document);
			}
		}),
	);

	// Handle document save
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => {
			if (isLogicMdFile(doc)) {
				validateDocument(doc);
			}
		}),
	);

	// Validate all open LOGIC.md files
	vscode.workspace.textDocuments.forEach((doc) => {
		if (isLogicMdFile(doc)) {
			validateDocument(doc);
		}
	});
}

export function deactivate() {
	if (diagnosticCollection) {
		diagnosticCollection.dispose();
	}
}

/**
 * Check if a document is a LOGIC.md file
 */
function isLogicMdFile(doc: vscode.TextDocument): boolean {
	return doc.languageId === "logic-md" || doc.fileName.endsWith(".logic.md");
}

/**
 * Validate a LOGIC.md document
 *
 * Currently provides basic validation:
 * - Frontmatter structure (--- delimiters)
 * - YAML syntax (basic)
 *
 * Future enhancements:
 * - Full schema validation against @logic-md/core
 * - Expression syntax validation
 * - Step reference validation
 */
function validateDocument(doc: vscode.TextDocument): void {
	const diagnostics: vscode.Diagnostic[] = [];
	const text = doc.getText();
	const lines = text.split("\n");

	// Check for frontmatter delimiters.
	// NOTE: String.prototype.search() ignores any second argument, so we use a /g regex
	// with repeated .exec() calls to find the opening and closing --- delimiters.
	// Frontmatter must be the very first line of the document; stray --- blocks later
	// in the file (e.g. markdown horizontal rules) must not be treated as frontmatter.
	const fmRegex = /^---\s*$/gm;
	const firstMatch = fmRegex.exec(text);
	const frontmatterStart = firstMatch && firstMatch.index === 0 ? 0 : -1;
	const secondMatch = frontmatterStart === 0 ? fmRegex.exec(text) : null;
	const frontmatterEnd = secondMatch ? secondMatch.index : -1;

	if (frontmatterStart === -1) {
		const range = new vscode.Range(0, 0, 0, 0);
		diagnostics.push(
			new vscode.Diagnostic(
				range,
				"LOGIC.md files should start with frontmatter (---).",
				vscode.DiagnosticSeverity.Warning,
			),
		);
	} else if (frontmatterEnd === -1) {
		const range = new vscode.Range(0, 0, 0, 0);
		diagnostics.push(
			new vscode.Diagnostic(
				range,
				"Frontmatter must be closed with --- delimiter.",
				vscode.DiagnosticSeverity.Error,
			),
		);
	}

	// Check for required fields in frontmatter
	if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
		const frontmatterText = text.substring(frontmatterStart + 3, frontmatterEnd);

		const requiredFields = ["spec_version", "name", "reasoning"];
		requiredFields.forEach((field) => {
			if (!frontmatterText.includes(`${field}:`)) {
				diagnostics.push(
					new vscode.Diagnostic(
						new vscode.Range(0, 0, 0, 0),
						`Required field missing: ${field}`,
						vscode.DiagnosticSeverity.Warning,
					),
				);
			}
		});
	}

	diagnosticCollection.set(doc.uri, diagnostics);
}
