/**
 * LLM Adapter Interface
 * Pluggable adapters for different LLM providers
 */

export class LLMAdapter {
	/**
	 * Call an LLM with a system prompt and user message
	 * @param {string} model - Model identifier (e.g., "claude-sonnet-3-5")
	 * @param {string} systemPrompt - System message
	 * @param {string} userPrompt - User message
	 * @param {object} options - Optional: temperature, max_tokens, timeout_ms
	 * @returns {Promise<{content: string, stopReason: string, inputTokens: number, outputTokens: number}>}
	 */
	async call(model, systemPrompt, userPrompt, options = {}) {
		throw new Error("Not implemented");
	}
}

/**
 * Claude Adapter - Calls Anthropic Claude models
 */
export class ClaudeAdapter extends LLMAdapter {
	constructor() {
		super();
		this.client = null;
	}

	async _ensureClient() {
		if (this.client) return;
		try {
			const { default: Anthropic } = await import("@anthropic-ai/sdk");
			this.client = new Anthropic({
				apiKey: process.env.ANTHROPIC_API_KEY,
			});
		} catch (error) {
			throw new Error("Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk");
		}
	}

	async call(model, systemPrompt, userPrompt, options = {}) {
		await this._ensureClient();
		const { temperature = 0.7, max_tokens = 4096, timeout_ms = 30000 } = options;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

		try {
			const response = await this.client.messages.create({
				model,
				max_tokens,
				temperature,
				system: systemPrompt,
				messages: [
					{
						role: "user",
						content: userPrompt,
					},
				],
			});

			clearTimeout(timeoutId);

			const content = response.content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("\n");

			return {
				content,
				stopReason: response.stop_reason,
				inputTokens: response.usage.input_tokens,
				outputTokens: response.usage.output_tokens,
			};
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
		}
	}
}

/**
 * OpenAI-Compatible Adapter - Calls OpenAI, Nvidia NIM, or any OpenAI-compatible API
 */
export class OpenAIAdapter extends LLMAdapter {
	constructor(baseURL = null, apiKeyEnv = "OPENAI_API_KEY") {
		super();
		this.client = null;
		this.baseURL = baseURL;
		this.apiKeyEnv = apiKeyEnv;
	}

	async _ensureClient() {
		if (this.client) return;
		try {
			const { default: OpenAI } = await import("openai");
			const apiKey = process.env[this.apiKeyEnv];
			if (!apiKey) {
				throw new Error(`Missing API key: set ${this.apiKeyEnv} environment variable`);
			}
			const opts = { apiKey };
			if (this.baseURL) opts.baseURL = this.baseURL;
			this.client = new OpenAI(opts);
		} catch (error) {
			if (error.code === "ERR_MODULE_NOT_FOUND") {
				throw new Error("OpenAI SDK not installed. Run: npm install openai");
			}
			throw error;
		}
	}

	async call(model, systemPrompt, userPrompt, options = {}) {
		await this._ensureClient();
		const { temperature = 0.7, max_tokens = 4096, timeout_ms = 30000 } = options;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

		try {
			const response = await this.client.chat.completions.create({
				model,
				max_tokens,
				temperature,
				messages: [
					{
						role: "system",
						content: systemPrompt,
					},
					{
						role: "user",
						content: userPrompt,
					},
				],
			});

			clearTimeout(timeoutId);

			return {
				content: response.choices[0].message.content,
				stopReason: response.choices[0].finish_reason,
				inputTokens: response.usage.prompt_tokens,
				outputTokens: response.usage.completion_tokens,
			};
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
		}
	}
}

/**
 * Mock LLM Adapter - Returns deterministic mock responses for dry-run testing
 */
export class MockLLMAdapter extends LLMAdapter {
	constructor(mockResponses = {}) {
		super();
		this.mockResponses = mockResponses;
	}

	async call(model, systemPrompt, userPrompt, options = {}) {
		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 100));

		const key = `${model}:${userPrompt.substring(0, 50)}`;
		const cached = this.mockResponses[key];

		if (cached) {
			return {
				content: cached,
				stopReason: "end_turn",
				inputTokens: Math.floor(Math.random() * 100) + 50,
				outputTokens: Math.floor(Math.random() * 200) + 100,
			};
		}

		// Generate deterministic mock response based on task
		return this.generateMockResponse(model, systemPrompt, userPrompt);
	}

	generateMockResponse(model, systemPrompt, userPrompt) {
		// Detect task type from system prompt or user prompt
		if (userPrompt.includes("code") || userPrompt.includes("review")) {
			return {
				content: JSON.stringify(
					{
						review_result: {
							verdict: "request-changes",
							critical_issues: [
								{
									file: "src/auth.js",
									line: 42,
									issue: "SQL injection vulnerability in user query",
									fix: "Use parameterized queries",
								},
							],
							major_issues: [
								{
									file: "src/api.js",
									line: 18,
									issue: "Missing error handling on file read",
									fix: "Wrap in try-catch and return proper error response",
								},
							],
							minor_issues: [
								{
									file: "src/utils.js",
									line: 5,
									issue: "Inconsistent variable naming",
								},
							],
							summary:
								"The code change introduces important functionality but has critical security issues that must be addressed before merge.",
						},
					},
					null,
					2,
				),
				stopReason: "end_turn",
				inputTokens: 245,
				outputTokens: 342,
			};
		}

		if (userPrompt.includes("research") || userPrompt.includes("investigate")) {
			return {
				content: JSON.stringify(
					{
						research_report: {
							research_question: "How is AI impacting the software development industry?",
							key_findings: [
								{
									finding: "Code generation with AI is increasing developer productivity by 20-40%",
									supporting_evidence: [
										"Stack Overflow developer survey 2024 showed 43% of developers use AI tools",
										"GitHub Copilot reported 46% faster task completion",
									],
									source_refs: ["github-copilot-study", "stackoverflow-2024"],
								},
								{
									finding: "AI-assisted testing reduces bug detection time",
									supporting_evidence: [
										"Multiple studies show 30-50% reduction in test case generation time",
									],
									source_refs: ["acm-software-testing-2024"],
								},
								{
									finding: "Security concerns remain about AI-generated code quality",
									supporting_evidence: [
										"OWASP reported vulnerabilities in AI-generated code samples",
									],
									source_refs: ["owasp-ai-security-2024"],
								},
							],
							sources: [
								{ name: "GitHub Copilot Study", type: "industry", reliability: "high" },
								{
									name: "Stack Overflow Developer Survey 2024",
									type: "industry",
									reliability: "high",
								},
								{ name: "ACM Software Testing Research", type: "academic", reliability: "high" },
							],
							confidence_levels: { overall: "high" },
							conclusion:
								"AI is significantly impacting software development with productivity gains, though security and quality concerns require ongoing attention.",
						},
					},
					null,
					2,
				),
				stopReason: "end_turn",
				inputTokens: 198,
				outputTokens: 456,
			};
		}

		if (userPrompt.includes("security") || userPrompt.includes("vulnerability")) {
			return {
				content: JSON.stringify(
					{
						audit_report: {
							vulnerabilities: [
								{
									id: "VULN-001",
									title: "SQL Injection in User Authentication",
									severity: "critical",
									cwe_id: "CWE-89",
									description:
										"User input is directly concatenated into SQL query without parameterization",
									location: { file: "src/auth.js", line: 42 },
									remediation: "Use prepared statements or ORM with parameterized queries",
								},
								{
									id: "VULN-002",
									title: "Hardcoded API Key",
									severity: "critical",
									cwe_id: "CWE-798",
									description: "API key exposed in source code",
									location: { file: "config.js", line: 5 },
									remediation: "Move to environment variables or secrets manager",
								},
								{
									id: "VULN-003",
									title: "Missing Input Validation",
									severity: "high",
									cwe_id: "CWE-20",
									description: "File upload endpoint does not validate file type",
									location: { file: "src/upload.js", line: 28 },
									remediation: "Validate file extension and MIME type on server",
								},
							],
							severity_summary: {
								critical: 2,
								high: 1,
								medium: 0,
								low: 0,
							},
							remediation_plan: [
								{
									priority: 1,
									action: "Fix SQL injection and API key exposure",
									effort: "medium",
									timeline: "immediate",
								},
								{
									priority: 2,
									action: "Add input validation to file upload",
									effort: "low",
									timeline: "within 1 week",
								},
							],
							risk_score: 82,
						},
					},
					null,
					2,
				),
				stopReason: "end_turn",
				inputTokens: 312,
				outputTokens: 523,
			};
		}

		// Generic mock response
		return {
			content: "This is a mock LLM response for testing purposes.",
			stopReason: "end_turn",
			inputTokens: 100,
			outputTokens: 150,
		};
	}
}

/**
 * Create an adapter based on model name
 * @param {string} model - Model identifier
 * @param {object} mockResponses - Optional mock responses for dry-run
 * @returns {Promise<LLMAdapter>}
 */
export async function createAdapter(model, mockResponses = null) {
	if (mockResponses) {
		return new MockLLMAdapter(mockResponses);
	}

	if (model.startsWith("claude")) {
		return new ClaudeAdapter();
	}

	if (model.startsWith("gpt")) {
		return new OpenAIAdapter();
	}

	// Nvidia NIM models (meta/llama, nvidia/, mistralai/, etc.)
	if (model.includes("/") || process.env.NVIDIA_API_KEY) {
		return new OpenAIAdapter("https://integrate.api.nvidia.com/v1", "NVIDIA_API_KEY");
	}

	throw new Error(`Unknown model: ${model}`);
}

export default {
	LLMAdapter,
	ClaudeAdapter,
	OpenAIAdapter,
	MockLLMAdapter,
	createAdapter,
};
