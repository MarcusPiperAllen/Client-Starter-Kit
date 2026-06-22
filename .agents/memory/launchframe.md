---
name: LaunchFrame Intent Miner
description: How the AI Intent Miner and Universal Build Prompt fit together in LaunchFrame
---

# LaunchFrame AI Intent Miner

- **Stateless by design.** The miner has NO DB, transcripts, accounts, voice, or chat history. POST /api/intent/mine takes `{text}` and returns `{intent, projectKind, filledFields, missingFields, suggestions, source}`. Do not add persistence.
  - **Why:** product decision — the tool is a one-shot brain-dump → prompt generator, not a session app.

- **AI path + rule-based fallback live side by side.** Server returns `source:"ai"` only. The client (home.tsx `runMiner`) falls back to the local `parseBrainDump` + `summarizeIntent` on ANY mutation error and tags `source:"fallback"`. Keep `parseBrainDump` working — it is the offline baseline, not dead code.

- **FIELD_LABELS must stay mirrored in two places:** `artifacts/api-server/src/routes/intent.ts` and `artifacts/launchframe/src/lib/intent.ts` (full `Record<keyof ExtractedIntent,string>`, includes `notes`). If you add an ExtractedIntent field, update both or the AI and fallback panels report different fields.

- **Allowed select values are constrained in the server SYSTEM_PROMPT / normalizeIntent** to match the form's dropdowns (orgType, tone, callToAction, techStack). The AI is instructed to pick only from these sets. If the form options change, update the prompt constraints too.

- **Two brain-dump entry points:** "Review & fill form" (default — fills the intake form + shows analysis panel) and "Auto-build prompt" (secondary — mines then jumps straight to output). Auto-build builds output from the MERGED form (`formDataToIntent(merged)`), not the raw mined subset, so pre-existing manual entries survive.

- **`mineMeta` is a snapshot and goes stale.** It is cleared on any manual form edit (handleInputChange/handleSelectChange), New Project, and Restore Draft so stale suggestions/projectKind never leak into the build prompt. OutputView uses `mineMeta?.projectKind ?? deriveProjectKind(intent)`.

- **One unified build prompt, kind-adaptive (T007).** `buildPrompt` in OutputView (home.tsx) always emits a self-contained prompt with a "Fill-the-Gaps Instructions" block (palette/typography/styling/responsive/a11y). When `projectKind==="software"` it also emits "Application Requirements" (features/screens/data model/auth/persistence) and a software verification line. Driven by the `projectKind` prop, not just orgType.

- **OpenAI via Replit AI Integrations** (lib/integrations-openai-ai-server, trimmed to client-only, exports `{ openai }`). No user API key — billed to credits. Env: AI_INTEGRATIONS_OPENAI_BASE_URL + _API_KEY.
