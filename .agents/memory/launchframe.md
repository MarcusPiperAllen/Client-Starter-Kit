---
name: LaunchFrame Intent Miner
description: Durable design decisions behind the AI Intent Miner and Universal Build Prompt
---

# LaunchFrame AI Intent Miner

- **Stateless by design.** No DB, transcripts, accounts, voice, or chat history. The miner is a one-shot brain-dump → build-prompt generator. Do not add persistence "to remember" past runs; any refinement must pass prior intent from the client, not store it server-side.
  - **Why:** product decision for this tool's scope.

- **AI is best-effort; the rule-based parser is the guaranteed baseline.** The server only ever returns AI results, and the client falls back to its local parser on ANY failure (tagging the result as a fallback). Keep that parser working — it is the offline contract, not dead code.
  - **How to apply:** never let an AI dependency become required for the brain-dump flow to function.

- **AI integration must never be required at boot.** Initialize the OpenAI client lazily (on first request), never at module import, so a missing/unprovisioned integration degrades to the fallback path instead of crashing the API server.
  - **Why:** a prior review rejected an import-time throw that could take down the whole server when env vars were absent.

- **Field labels exist in two places (server route + client lib) and must stay mirrored.** If the set of intent fields changes, update both or the AI panel and the fallback panel will report different fields.

- **Allowed select values are constrained in the server prompt/normalizer to match the form's dropdowns.** If the form's options change, update the prompt constraints too, or the AI can emit values the form can't represent.

- **The mined-result snapshot goes stale.** Clear it on any manual form edit, New Project, and Restore Draft so old suggestions/projectKind never leak into a freshly edited build prompt.

- **One unified, kind-adaptive build prompt.** Always self-contained with gap-filling guidance (palette/type/styling/responsive/a11y); the software kind additionally specifies app requirements (features/data/auth) + verification. Driven by detected project kind, not just org type.

- **The miner is a reasoning intake strategist, not a field extractor.** Its job is messy idea → complete, build-ready intent → strong starter build prompt for downstream coding agents. It must INFER typical features/pages/audience for the project type (not copy labels), use `notes` to carry assumptions + deferred defaults, and use `suggestions` to flag genuinely missing/uncertain items the human should confirm.
  - **Why:** explicit product framing — this is a niche reasoning engine, a proof-of-concept, not a generic chatbot or a better regex.
  - **Benchmark:** a messy dump describing LaunchFrame itself must yield intent complete enough to generate a prompt that could rebuild LaunchFrame. The behavior lives in the server SYSTEM_PROMPT (routes/intent.ts); tune it there.
