import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, it } from "node:test";
import { runQoderResearch } from "../src/agent/subagents/qoder-research.ts";
import { parseAgentSettingsBody } from "../src/server/settings-body.ts";
import { sanitizeUserSettings } from "../src/core/settings.ts";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lh-qoder-test-"));
after(() => fs.rmSync(directory, { recursive: true, force: true }));

it("Qoder settings survive parsing and sanitizing; invalid paths and types fail", () => {
	const qoderResearch = { enabled: true, projectPath: directory };
	assert.deepEqual(parseAgentSettingsBody({ qoderResearch }), { ok: true, settings: { qoderResearch } });
	assert.deepEqual(sanitizeUserSettings({ version: 1, agent: { qoderResearch } })!.agent?.qoderResearch, qoderResearch);
	assert.equal(parseAgentSettingsBody({ qoderResearch: { projectPath: "relative/path" } }).ok, false);
	assert.equal(parseAgentSettingsBody({ qoderResearch: { enabled: "true" } }).ok, false);
});

it("Qoder runs in the project with native config and prompt on stdin, returns complete evidence", async () => {
	let activity = "";
	const spawnProcess = ((command: string, args: string[], options: Parameters<typeof spawn>[2]) => {
		assert.equal(command, process.execPath);
		assert.deepEqual(args, ["--print", "--output-format", "text", "--permission-mode", "plan"]);
		assert.equal(options?.cwd, fs.realpathSync(directory));
		return spawn(process.execPath, ["-e", "let task='';process.stdin.on('data',d=>task+=d);process.stdin.on('end',()=>{if(!task.includes('native context question'))process.exit(2);process.stdout.write('Architecture evidence: src/main.ts:12; uncertainty: MCP unavailable')})"], options);
	}) as typeof spawn;
	const brief = await runQoderResearch("native context question", { projectPath: directory, binary: process.execPath, spawnProcess, onActivity: (value) => { activity = value; } });
	assert.match(brief, /src\/main.ts:12/);
	assert.match(activity, /Qoder/);
});

it("Qoder failures and empty output are explicit, not web-research fallbacks", async () => {
	for (const script of ["process.exit(3)", "process.stdin.resume();process.stdin.on('end',()=>process.exit(0))"]) {
		const spawnProcess = ((_command: string, _args: string[], options: Parameters<typeof spawn>[2]) => spawn(process.execPath, ["-e", script], options)) as typeof spawn;
		await assert.rejects(runQoderResearch("q", { projectPath: directory, binary: process.execPath, spawnProcess }), /exited with code 3|produced no brief/);
	}
});

it("Qoder cancellation terminates a live child", async () => {
	const controller = new AbortController();
	const spawnProcess = ((_command: string, _args: string[], options: Parameters<typeof spawn>[2]) => spawn(process.execPath, ["-e", "process.stdin.resume();setInterval(()=>{},1000)"], options)) as typeof spawn;
	const pending = runQoderResearch("q", { projectPath: directory, binary: process.execPath, spawnProcess, abortSignal: controller.signal, onActivity: () => controller.abort() });
	await assert.rejects(pending, /aborted/);
});

it("Windows CLI shims safely handle executable paths with spaces and Chinese research text", { skip: process.platform !== "win32" }, async () => {
	const script = path.join(directory, "fake-agent.cjs");
	const binary = path.join(directory, "qoder cli & fixture.cmd");
	fs.writeFileSync(script, "let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{if(!input.includes('研究调用链'))process.exit(9);process.stdout.write('研究结论：入口 src/main.ts:12')})");
	fs.writeFileSync(binary, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
	assert.equal(await runQoderResearch("研究调用链", { projectPath: directory, binary }), "研究结论：入口 src/main.ts:12");
});
