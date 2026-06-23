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

# LaunchFrame Copy Intelligence Layer

- **Same AI-best-effort + template-fallback contract as the miner.** POST /intent/copy generates marketing copy VALUES (hero headline/sub, about, per-feature descriptions, SEO title, meta, CTA) from an existing ExtractedIntent. On ANY failure the client falls back to the deterministic template generators and tags the result `source:"fallback"` (badge + toast). The templates are the offline contract, not dead code.
- **Only copy VALUES change — never structure.** The Universal Build Prompt layout, HTML scaffold, SEO pack layout, and form flow stay identical; AI output is merged as `copy?.field || template`. Do not let copy generation reshape the prompt/scaffold.
- **Never trust model-supplied feature names — anchor to `intent.services` verbatim.** The server rebuilds `features[]` from the input services (preserving order/spelling) and pairs each with the model's description by lowercased-name match, index as fallback. The frontend maps AI feature descriptions by lowercased service name, so renamed names would silently drop descriptions.
  - **Why:** a review caught that accepting model names breaks the frontend name→description map and violates the verbatim-name contract.
- **Reject incomplete AI copy → 502 → fallback.** All high-value fields (heroHeadline, heroSubheadline, about, ctaCopy, seoTitle, metaDescription) must be non-empty after sanitize, or return 502 so the client uses templates instead of rendering blanks. `GenerateCopyResponse.parse` only enforces string type, not non-empty — the explicit guard is required.
- **sanitizeCopy strips double/smart quotes → single and collapses whitespace** so AI copy drops safely into HTML attributes in the scaffold without escaping work.

# LaunchFrame Output-Surface Consistency

- **Keywords have one resolved source; never re-resolve inline.** Use `resolvedKeywords` (AI `copy.keywords` if non-empty, else deterministic `seoKeywords`) for every output surface (SEO pack + build prompt + any future surface). Empty AI keywords are intentionally allowed — the `/intent/copy` 502 guard excludes `keywords` on purpose; the client backfill guarantees a non-empty list whenever a project is described (`seoKeywords` is non-empty because `cleanGoal`/`goalDisplay` has a default).
  - **Why:** two forked inline resolutions had drifted; consolidating prevents surfaces showing different keywords.
- **Tone nuance palette lives in `cm`, not `c`.** `c` = base preset tone palette (`colorByTone[toneDisplay]`); `cm` = nuance-modified palette (free-text `toneNuance` shifts it, e.g. dark/minimal/warm). The generated CSS scaffold AND the prompt's "Suggested colors" line must read `cm` so the stated colors match the emitted scaffold. Using `c` for any scaffold/prompt color is a bug (nuance dark-mode silently dropped).
