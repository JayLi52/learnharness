import React, { act } from "react";
(globalThis as Record<string, unknown>).React = React;
import assert from "node:assert/strict";
import { it } from "node:test";
import { parseHTML } from "linkedom";
import { QoderCliSettings } from "../components/settings/qoder-cli.tsx";
import type { AgentSettings } from "../src/core/settings.ts";

it("External CLI connects project context without overwriting existing agent settings; failed saves remain visible", async () => {
	const dom = parseHTML("<html><body><div id='root'></div></body></html>");
	const globals = globalThis as Record<string, unknown>;
	const previous = new Map<string, PropertyDescriptor | undefined>();
	let agent: AgentSettings = { tools: { research: true, visual: false }, search: { engine: "brave" }, qoderResearch: { enabled: false, projectPath: "/private/project" } };
	let failSave = false;
	const writes: AgentSettings[] = [];
	for (const [key, value] of Object.entries({ window: dom.window, document: dom.document,
		CustomEvent: dom.window.CustomEvent, navigator: globals.navigator ?? { userAgent: "" },
		HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
		fetch: async (url: string, init?: RequestInit) => {
			if (url === "/api/settings") return Response.json({ settings: { version: 1, agent } });
			assert.equal(url, "/api/settings/agent");
			assert.equal(init?.method, "PUT");
			const next = JSON.parse(init.body as string) as AgentSettings;
			writes.push(next);
			if (failSave) return Response.json({ error: "Save rejected" }, { status: 400 });
			agent = next;
			return Response.json({ settings: { version: 1, agent } });
		},
	})) {
		previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
	}
	const { createRoot } = await import("react-dom/client");
	const root = createRoot(document.getElementById("root")!);
	try {
		await act(async () => root.render(<QoderCliSettings />));
		const toggle = document.querySelector<HTMLButtonElement>('[aria-label="Connect Qoder project context"]')!;
		assert.equal(toggle.getAttribute("aria-checked"), "false");
		assert.equal(document.querySelector<HTMLInputElement>('[data-testid="qoder-project-path"]')!.value, "/private/project");
		// An unrelated setting changes after the component loaded.
		agent = { ...agent, tools: { research: true, visual: true } };
		await act(async () => toggle.click());
		assert.deepEqual(writes[0], { tools: { research: true, visual: true }, search: { engine: "brave" }, qoderResearch: { enabled: true, projectPath: "/private/project" } });
		assert.equal(toggle.getAttribute("aria-checked"), "true");
		failSave = true;
		await act(async () => toggle.click());
		assert.equal(toggle.getAttribute("aria-checked"), "true");
		assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Save rejected/);
	} finally {
		act(() => root.unmount());
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete globals[key];
		}
	}
});
