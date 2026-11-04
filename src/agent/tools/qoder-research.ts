import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentSettings } from "../../core/settings.ts";
import { toToolResult } from "../tool-execute.ts";
import { runQoderResearch } from "../subagents/qoder-research.ts";

export type QoderResearchSettings = NonNullable<AgentSettings["qoderResearch"]>;
const schema = Type.Object({
	question: Type.String({ minLength: 1, description: "A specific research question, with the learning context and prior findings needed to answer it." }),
});

/** Optional capability inside the existing researcher loop. The CLI has its
 * own bounded execution and consumes the loop's abort signal; it must not use
 * the short filesystem-tool timeout or change the global tool guard. */
export function createQoderResearchTool(
	settings: () => QoderResearchSettings,
	run: typeof runQoderResearch = runQoderResearch,
): AgentTool<typeof schema> {
	return {
		name: "qoder_research",
		label: "Qoder project research",
		description: "Ask the connected Qoder CLI to research the configured local project, call chains, implementation, intranet MCP sources, skills and memory. Qoder can also search the web. Returns evidence for your research brief, with source references and uncertainty. The project directory comes only from user settings; do not infer private-project behavior from public web results.",
		parameters: schema,
		execute: async (_id, input, signal) => {
			signal?.throwIfAborted();
			const config = settings();
			if (!config.enabled) return toToolResult("Qoder is disabled. Do not claim to have consulted the connected project.");
			try {
				const brief = await run(input.question, { projectPath: config.projectPath ?? "", abortSignal: signal });
				signal?.throwIfAborted();
				return toToolResult(brief.length > 40_000 ? `${brief.slice(0, 40_000)}\n\n[Truncated at 40000 characters; ask a narrower follow-up.]` : brief);
			} catch (error) {
				if (signal?.aborted) throw error;
				return toToolResult(`Qoder research unavailable: ${error instanceof Error ? error.message : "external CLI failed"}. Report this gap; do not invent local or intranet evidence.`);
			}
		},
	};
}
