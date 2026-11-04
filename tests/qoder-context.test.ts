import assert from "node:assert/strict";
import { it } from "node:test";
import { createFauxCore, fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import { runResearcherAgent } from "../src/agent/subagents/researcher.ts";
import { createQoderResearchTool } from "../src/agent/tools/qoder-research.ts";
import { jobTools } from "../src/agent/tools/jobs.ts";
import type { JobStore } from "../src/core/ports.ts";

it("disabled Qoder preserves the original researcher prompt and tool list exactly", async () => {
	const snapshots: unknown[] = [];
	for (const configured of [false, true]) {
		const faux = createFauxCore({});
		faux.setResponses([(ctx) => {
			const system = ctx.messages.find((m) => m.role === "system")!;
			assert.equal(system.role, "system");
			if (system.role === "system") snapshots.push({ content: system.content, tools: system.toolsAdded });
			return fauxAssistantMessage([fauxText("Original researcher")]);
		}]);
		assert.equal(await runResearcherAgent("Public research", {
			engine: { model: faux.getModel(), streamFn: faux.streamSimple },
			...(configured ? { qoderResearch: () => ({ enabled: false, projectPath: "/private" }) } : {}),
			qoderRun: async () => { throw new Error("disabled CLI must never run"); },
		}), "Original researcher");
	}
	assert.deepEqual(snapshots[0], snapshots[1]);
});

it("the original researcher can consult Qoder and receives local evidence before writing its brief", async () => {
	const faux = createFauxCore({});
	let calls = 0;
	faux.setResponses([
		(ctx) => {
			const system = ctx.messages.find((m) => m.role === "system")!;
			assert.equal(system.role, "system");
			if (system.role === "system") {
				assert.ok(system.toolsAdded?.some((t) => t.name === "web_search"));
				assert.ok(system.toolsAdded?.some((t) => t.name === "web_fetch"));
				assert.ok(system.toolsAdded?.some((t) => t.name === "qoder_research"));
			}
			return fauxAssistantMessage([fauxToolCall("qoder_research", { question: "Explain request flow" }, { id: "local-context" })], { stopReason: "toolUse" });
		},
		(ctx) => {
			const evidence = ctx.messages.find((m) => m.role === "toolResult" && m.toolCallId === "local-context");
			assert.ok(evidence && evidence.role === "toolResult");
			assert.match(JSON.stringify(evidence.content), /src\/entry.ts:12/);
			assert.match(JSON.stringify(evidence.content), /MCP deployment details unavailable/);
			return fauxAssistantMessage([fauxText("Research brief: entry is src/entry.ts:12; deployment remains unverified.")]);
		},
	]);
	const brief = await runResearcherAgent("Teach the connected project's request lifecycle", {
		engine: { model: faux.getModel(), streamFn: faux.streamSimple },
		qoderResearch: () => ({ enabled: true, projectPath: "/configured/project" }),
		qoderRun: async (question, options) => {
			calls++;
			assert.equal(question, "Explain request flow");
			assert.equal(options.projectPath, "/configured/project");
			return "Source: src/entry.ts:12. Gap: MCP deployment details unavailable.";
		},
	});
	assert.equal(calls, 1);
	assert.match(brief, /src\/entry.ts:12/);
});

it("Qoder failures become explicit research gaps and disabling blocks later calls", async () => {
	let enabled = true;
	let calls = 0;
	const tool = createQoderResearchTool(() => ({ enabled, projectPath: "/configured/project" }), async () => { calls++; throw new Error("MCP unavailable"); });
	assert.match(JSON.stringify((await tool.execute!("first", { question: "q" })).content), /MCP unavailable/);
	enabled = false;
	assert.match(JSON.stringify((await tool.execute!("second", { question: "q" })).content), /disabled/);
	assert.equal(calls, 1);
});

it("the teacher discovers the connected project through its existing research tool", () => {
	const ctx = { chatId: "fixture", jobStore: {} as JobStore, spawn: () => {} };
	const original = jobTools(ctx);
	const connected = jobTools({ ...ctx, qoderProjectPath: "/configured/project" });
	assert.deepEqual(Object.keys(connected), Object.keys(original));
	assert.deepEqual(connected.research!.parameters, original.research!.parameters);
	assert.ok(connected.research!.description.startsWith(original.research!.description));
	assert.match(connected.research!.description, /configured\/project/);
});
