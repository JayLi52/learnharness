"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentSettings, UserSettings } from "@/src/core";
import { notifySettingsSaved, useSettingsSaved } from "@/components/settings-signal";
import { CommitInput, Toggle } from "./controls";

/** External context connection, separate from Claude Code's model provider. */
export function QoderCliSettings() {
	const [config, setConfig] = useState<NonNullable<AgentSettings["qoderResearch"]>>({});
	const [loaded, setLoaded] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const request = useRef<AbortController | null>(null);
	const read = useCallback(async () => {
		request.current?.abort();
		const controller = new AbortController();
		request.current = controller;
		setLoaded(false);
		try {
			const response = await fetch("/api/settings", { cache: "no-store", signal: controller.signal });
			if (!response.ok) throw new Error();
			const body = await response.json() as { settings: UserSettings | null };
			if (!controller.signal.aborted) {
				setConfig(body.settings?.agent?.qoderResearch ?? {});
				setLoaded(true);
				setError(null);
			}
		} catch { if (!controller.signal.aborted) setError("Could not load Qoder settings."); }
	}, []);
	useEffect(() => { void read(); return () => request.current?.abort(); }, [read]);
	useSettingsSaved((section) => { if (section === "agent") void read(); });

	async function save(patch: NonNullable<AgentSettings["qoderResearch"]>) {
		if (!loaded || saving) return;
		request.current?.abort();
		const controller = new AbortController();
		request.current = controller;
		setSaving(true);
		setError(null);
		try {
			// The existing API replaces a whole section: re-read immediately so
			// unrelated agent settings are preserved rather than sending stale state.
			const latest = await fetch("/api/settings", { cache: "no-store", signal: controller.signal });
			if (!latest.ok) throw new Error("Could not read current settings.");
			const current = await latest.json() as { settings: UserSettings | null };
			const agent = current.settings?.agent ?? {};
			const response = await fetch("/api/settings/agent", { method: "PUT", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...agent, qoderResearch: { ...agent.qoderResearch, ...patch } }), signal: controller.signal });
			const body = await response.json() as { settings?: UserSettings; error?: string };
			if (!response.ok || !body.settings?.agent?.qoderResearch) throw new Error(body.error ?? "Could not save Qoder settings.");
			if (!controller.signal.aborted) {
				setConfig(body.settings.agent.qoderResearch);
				notifySettingsSaved("agent");
			}
		} catch (err) {
			if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not save Qoder settings.");
		} finally { setSaving(false); }
	}

	return <div className="space-y-2" data-testid="qoder-cli-settings">
		<div className="flex items-center gap-3">
			<span className="font-prose text-(length:--lh-prose-size) text-foreground">Qoder</span>
			<Toggle label="Connect Qoder project context" checked={config.enabled === true} disabled={!loaded || saving} onChange={(enabled) => void save({ enabled })} />
		</div>
		<fieldset disabled={!loaded || saving} className="flex flex-wrap items-center gap-3">
			<span className="text-xs text-muted-foreground">Project directory</span>
			<CommitInput value={config.projectPath ?? ""} placeholder="Absolute project path" ariaLabel="Qoder project directory" testid="qoder-project-path" onCommit={(projectPath) => void save({ projectPath })} />
		</fieldset>
		<p className="text-xs leading-relaxed text-muted-foreground">Connect local project context to the existing researcher through Qoder CLI, including its MCP, skills, memory and web research. Install and sign in to Qoder externally. Qoder controls its own access and billing.</p>
		{error && <p role="alert" className="text-xs text-red-400">{error}</p>}
	</div>;
}
