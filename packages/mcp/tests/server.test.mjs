import { strict as assert } from "node:assert";
import { symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

// Ensure templates directory is resolved relative to this test file so
// list_templates works regardless of the cwd when tests are invoked.
process.env.LOGIC_MD_TEMPLATES_DIR = new URL("../templates", import.meta.url).pathname;

/**
 * Create a fully connected test client via InMemoryTransport.
 * Returns a Client that has completed MCP initialization handshake.
 */
async function createTestClient() {
	const server = createServer();
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await server.connect(serverTransport);
	const client = new Client({ name: "test-client", version: "0.0.0" });
	await client.connect(clientTransport);
	return client;
}

// A minimal but valid LOGIC.md content string used across multiple tests.
// Must satisfy the JSON Schema: spec_version "1.0", name required, no additionalProperties.
const VALID_LOGIC_MD = `---
spec_version: "1.0"
name: test
description: A test reasoning configuration
---
`;

// A valid LOGIC.md with steps used for compile tool tests.
const VALID_LOGIC_MD_WITH_STEPS = `---
spec_version: "1.0"
name: test-workflow
description: A test workflow
reasoning:
  strategy: cot
steps:
  analyze:
    description: Analyze the input
    instructions: Analyze the following input carefully
---
`;

describe("MCP server integration", () => {
	// -----------------------------------------------------------------------
	// Phase 17 baseline tests (kept intact, counts updated for Phase 19)
	// -----------------------------------------------------------------------

	it("server responds to initialize", async () => {
		const client = await createTestClient();
		assert.ok(client, "client should be truthy after connect (initialize succeeds)");
	});

	it("tools/list returns exactly 7 tools", async () => {
		const client = await createTestClient();
		const result = await client.listTools();
		assert.ok(Array.isArray(result.tools), "result.tools should be an array");
		assert.strictEqual(result.tools.length, 7, "should have 7 tools registered");

		const names = result.tools.map((t) => t.name);
		assert.ok(names.includes("logic_md_parse"), "should include logic_md_parse");
		assert.ok(names.includes("logic_md_validate"), "should include logic_md_validate");
		assert.ok(names.includes("logic_md_lint"), "should include logic_md_lint");
		assert.ok(names.includes("logic_md_list_templates"), "should include logic_md_list_templates");
		assert.ok(names.includes("logic_md_init"), "should include logic_md_init");
		assert.ok(names.includes("logic_md_compile_step"), "should include logic_md_compile_step");
		assert.ok(
			names.includes("logic_md_compile_workflow"),
			"should include logic_md_compile_workflow",
		);
	});

	it("resources/list returns exactly 2 resources", async () => {
		const client = await createTestClient();
		const result = await client.listResources();
		assert.ok(Array.isArray(result.resources), "result.resources should be an array");
		assert.strictEqual(result.resources.length, 2, "should have 2 resources registered");

		const uris = result.resources.map((r) => r.uri);
		assert.ok(uris.includes("logic-md://schema"), "should include logic-md://schema");
		assert.ok(uris.includes("logic-md://spec"), "should include logic-md://spec");
	});

	it("server name is logic-md", async () => {
		const client = await createTestClient();
		const version = client.getServerVersion();
		assert.ok(version, "server version info should exist");
		assert.ok(
			version?.name?.includes("logic-md"),
			`server name should include 'logic-md', got: ${version?.name}`,
		);
	});

	// -----------------------------------------------------------------------
	// TEST-01: Tool integration tests
	// -----------------------------------------------------------------------

	describe("logic_md_parse", () => {
		it("returns success:true for valid LOGIC.md content", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_parse",
				arguments: { content: VALID_LOGIC_MD },
			});
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.strictEqual(
				parsed.success,
				true,
				`parsed.success should be true, got: ${JSON.stringify(parsed)}`,
			);
		});

		it("returns success:false for invalid (empty) content", async () => {
			const client = await createTestClient();
			const result = await client.callTool({ name: "logic_md_parse", arguments: { content: "" } });
			// parse returns a result object, not an infrastructure error
			assert.ok(!result.isError, "empty content parse should return a result, not isError");
			const parsed = JSON.parse(result.content[0].text);
			assert.strictEqual(
				parsed.success,
				false,
				`parsed.success should be false for empty content, got: ${JSON.stringify(parsed)}`,
			);
		});
	});

	describe("logic_md_validate", () => {
		it("returns valid:true for valid LOGIC.md content", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_validate",
				arguments: { content: VALID_LOGIC_MD },
			});
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.strictEqual(
				parsed.valid,
				true,
				`parsed.valid should be true, got: ${JSON.stringify(parsed)}`,
			);
		});
	});

	describe("logic_md_lint", () => {
		it("returns issues array and summary for valid LOGIC.md content", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_lint",
				arguments: { content: VALID_LOGIC_MD },
			});
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.ok(
				Array.isArray(parsed.issues),
				`parsed.issues should be an array, got: ${JSON.stringify(parsed)}`,
			);
			assert.ok(
				parsed.summary !== undefined && parsed.summary.total !== undefined,
				`parsed.summary should have a total field, got: ${JSON.stringify(parsed.summary)}`,
			);
		});
	});

	describe("logic_md_list_templates", () => {
		it("returns non-empty templates array", async () => {
			const client = await createTestClient();
			const result = await client.callTool({ name: "logic_md_list_templates", arguments: {} });
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.ok(
				Array.isArray(parsed.templates),
				`parsed.templates should be an array, got: ${JSON.stringify(parsed)}`,
			);
			assert.ok(
				parsed.templates.length > 0,
				`templates should be non-empty, got length: ${parsed.templates.length}`,
			);
		});
	});

	describe("isError handling", () => {
		it("returns isError:true when neither content nor file_path is provided", async () => {
			const client = await createTestClient();
			const result = await client.callTool({ name: "logic_md_parse", arguments: {} });
			assert.strictEqual(result.isError, true, "should set isError:true when no input provided");
			const text = result.content[0].text;
			assert.ok(
				text.includes("Either content or file_path is required"),
				`error message should mention required fields, got: ${text}`,
			);
		});
	});

	// -----------------------------------------------------------------------
	// TEST-02: Resource integration tests
	// -----------------------------------------------------------------------

	describe("logic-md://schema resource", () => {
		it("returns a parseable JSON Schema object", async () => {
			const client = await createTestClient();
			const result = await client.readResource({ uri: "logic-md://schema" });
			assert.ok(result.contents.length > 0, "schema resource should have contents");
			const schema = JSON.parse(result.contents[0].text);
			assert.strictEqual(
				typeof schema,
				"object",
				`schema should be an object, got: ${typeof schema}`,
			);
			assert.ok(schema !== null, "schema should not be null");
			// JSON Schema objects typically have 'type' or 'properties'
			const hasSchemaKeys =
				schema.type !== undefined ||
				schema.properties !== undefined ||
				schema.$schema !== undefined;
			assert.ok(
				hasSchemaKeys,
				`schema should have expected JSON Schema keys, got keys: ${Object.keys(schema).join(", ")}`,
			);
		});
	});

	describe("logic-md://spec resource", () => {
		it("returns non-empty markdown containing LOGIC.md", async () => {
			const client = await createTestClient();
			const result = await client.readResource({ uri: "logic-md://spec" });
			assert.ok(result.contents.length > 0, "spec resource should have contents");
			const text = result.contents[0].text;
			assert.ok(
				typeof text === "string" && text.length > 0,
				"spec text should be a non-empty string",
			);
			assert.ok(
				text.includes("LOGIC.md"),
				`spec should mention 'LOGIC.md', got first 100 chars: ${text.slice(0, 100)}`,
			);
		});
	});

	// -----------------------------------------------------------------------
	// Phase 19: Compile tool integration tests
	// -----------------------------------------------------------------------

	describe("logic_md_compile_step", () => {
		it("returns compiled step data for valid LOGIC.md with steps", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_compile_step",
				arguments: { content: VALID_LOGIC_MD_WITH_STEPS, step_name: "analyze" },
			});
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.ok(
				typeof parsed.systemPromptSegment === "string" && parsed.systemPromptSegment.length > 0,
				`parsed.systemPromptSegment should be a non-empty string, got: ${JSON.stringify(parsed.systemPromptSegment)}`,
			);
			assert.ok(
				typeof parsed.tokenEstimate === "number" && parsed.tokenEstimate > 0,
				`parsed.tokenEstimate should be a number > 0, got: ${parsed.tokenEstimate}`,
			);
			assert.strictEqual(
				parsed.metadata.stepName,
				"analyze",
				`parsed.metadata.stepName should be 'analyze', got: ${parsed.metadata.stepName}`,
			);
		});
	});

	describe("logic_md_compile_workflow", () => {
		it("returns execution plan for valid LOGIC.md with steps", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_compile_workflow",
				arguments: { content: VALID_LOGIC_MD_WITH_STEPS },
			});
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.ok(
				Array.isArray(parsed.executionPlan) && parsed.executionPlan.length > 0,
				`parsed.executionPlan should be a non-empty array, got: ${JSON.stringify(parsed.executionPlan)}`,
			);
			assert.ok(
				Array.isArray(parsed.dagLevels),
				`parsed.dagLevels should be an array, got: ${JSON.stringify(parsed.dagLevels)}`,
			);
			assert.ok(
				parsed.metadata !== undefined && typeof parsed.metadata.totalSteps === "number",
				`parsed.metadata.totalSteps should be a number, got: ${JSON.stringify(parsed.metadata)}`,
			);
		});
	});

	describe("logic_md_init", () => {
		it("returns template content for a valid template name", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_init",
				arguments: { template: "minimal" },
			});
			assert.ok(!result.isError, `should not be an error, got: ${JSON.stringify(result)}`);
			const parsed = JSON.parse(result.content[0].text);
			assert.ok(
				typeof parsed.content === "string" && parsed.content.length > 0,
				`parsed.content should be a non-empty string, got: ${JSON.stringify(parsed.content)}`,
			);
			assert.strictEqual(
				parsed.template_used,
				"minimal",
				`parsed.template_used should be 'minimal', got: ${parsed.template_used}`,
			);
		});
	});

	describe("logic_md_init error", () => {
		it("returns isError:true for nonexistent template", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_init",
				arguments: { template: "nonexistent-template-xyz" },
			});
			assert.strictEqual(result.isError, true, `should return isError:true for unknown template`);
		});
	});

	// -----------------------------------------------------------------------
	// TEST-03: Path traversal prevention
	// -----------------------------------------------------------------------

	describe("path traversal prevention", () => {
		it("rejects ../ escape attempt", async () => {
			const client = await createTestClient();
			const result = await client.callTool({
				name: "logic_md_parse",
				arguments: { file_path: "../../../etc/passwd" },
			});
			assert.strictEqual(result.isError, true, "should return isError:true for ../ path traversal");
			const text = result.content[0].text;
			assert.ok(
				text.toLowerCase().includes("outside") ||
					text.toLowerCase().includes("not allowed") ||
					text.toLowerCase().includes("working directory"),
				`rejection message should indicate path is outside allowed area, got: ${text}`,
			);
		});

		it("rejects symlink pointing outside cwd", async () => {
			const symlinkPath = join(process.cwd(), "test-symlink-escape.logic.md");
			try {
				symlinkSync("/tmp", symlinkPath);
				const client = await createTestClient();
				const result = await client.callTool({
					name: "logic_md_parse",
					arguments: { file_path: "test-symlink-escape.logic.md" },
				});
				assert.strictEqual(
					result.isError,
					true,
					"should return isError:true for symlink pointing outside cwd",
				);
			} finally {
				try {
					unlinkSync(symlinkPath);
				} catch {}
			}
		});
	});
});
