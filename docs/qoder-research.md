# Qoder background research

LearnHarness can connect local project context through Qoder CLI: architecture, call chains,
implementation details, intranet sources and public web research. The existing researcher can
call the optional `qoder_research` tool and use its evidence in the normal research brief.
The teacher then teaches, asks questions and connects knowledge through the existing workflow.
Qoder is not registered as a model provider and does not appear in model pickers.

## Setup

1. Install and sign in to Qoder CLI on the machine running the LearnHarness server, under the
   same OS user. Verify that Qoder can research your project and access its MCP/skills/memory.
2. Make `qodercli` discoverable on PATH. On macOS/Linux, `qoder` is also discovered. Windows
   IDE launchers called `qoder.cmd` are not automatically used because they may open the IDE.
   If needed, set `QODER_CLI_BIN` to the absolute CLI executable or Windows `.cmd` launcher
   before starting LearnHarness. Explicit invalid paths fail rather than selecting another CLI.
3. Open **Settings → Providers → External CLI → Qoder**, enter the fixed **Project directory**,
   and enable **Connect Qoder project context**. The path is on the server filesystem; `~/` is supported.
4. Ask to learn how something works in the project. The teacher dispatches a normal background
   research job; its report arrives through the existing job delivery mechanism.

The existing researcher still uses its configured LearnHarness model. Its web/PDF tools,
model/key checks, background delivery and usage tracking stay in place. Qoder owns its own
additional model choice, authentication and billing; its costs are not included in the
researcher's reported model usage. Qoder project, user, MCP, skills and memory configuration remains active because the
worker runs in the configured project directory. The lesson context and prior findings needed
for a follow-up must be included in each research task; CLI sessions are not resumed automatically.

The worker runs `--print --output-format text --permission-mode plan`, with the task sent over
stdin. The prompt requests research only, file/line references, intranet/public citations and
explicit uncertainty. Plan mode and Qoder's own permission rules govern tools, including MCP;
this is not an OS sandbox or an enforcement of LearnHarness's built-in file-reader boundary.
Inaccessible tools or sources should be reported as gaps. No permission bypass is added.

The existing job UI shows the researcher calling `qoder_research` and supports cancellation. Cancellation terminates
the process tree, with platform-dependent best-effort cleanup. A run is bounded to 30 minutes
and 2 MiB stdout. Missing CLI, login/permission failures, empty reports and process failures
are returned as explicit tool results to the researcher. Private-project facts remain unverified
when Qoder is unavailable; the prompt says not to substitute invented or public-project evidence. Turning the
switch off changes subsequent jobs, not an already running worker. Restart recovery reruns
unfinished jobs with current settings, as with other background research jobs.

## Doubao public search

Qoder is off by default. When disabled, its tool and project-specific prompt additions are absent;
the original researcher prompt, tools and flow remain. Its web tools remain available when Qoder is enabled too.
**Doubao Custom** and **Doubao Global** are independent search-engine options, configured
through the existing keys UI or `DOUBAO_CUSTOM_API_KEY` / `DOUBAO_GLOBAL_API_KEY`.
Use search-service API keys, not Ark model keys. Custom supports subscription and pay-as-you-go;
Global supports pay-as-you-go. Select the intended engine explicitly when multiple keys exist.
Automatic selection preserves existing engine priority, then Custom, then Global. A missing
pinned key or a request error never switches editions automatically.

Protocols: [Custom](https://docs.volcengine.com/docs/networked-search/networked-search?lang=zh),
[Global](https://docs.volcengine.com/docs/networked-search/doubao-search-global-edition?lang=zh),
[Qoder script mode](https://docs.qoder.com/cli/run-in-scripts),
[Qoder CLI reference](https://docs.qoder.com/cli/cli-reference).

Automated tests use synthetic processes and mocked HTTP, not live Qoder/intranet credentials
or paid Doubao requests. Actual account access and research quality must be verified locally.
