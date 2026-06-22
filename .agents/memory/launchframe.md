---
name: LaunchFrame build-prompt generator
description: Architecture decisions for the LaunchFrame artifact (intent model, intentional Replit mention)
---

# LaunchFrame

- The app turns a project intake form into ONE agent-agnostic "Universal Agent Build Prompt". All generation lives in `artifacts/launchframe/src/pages/home.tsx` (single large component file by design).

- Canonical model is `ExtractedIntent` (services/pages are `string[]`). The form (`FormData`) is only the editable surface; `formDataToIntent()` normalizes it and is the **intended plug-in point for a future "mind-dump miner"**. Keep all outputs deriving from the intent passed to `OutputView`, never from raw form fields.
  **Why:** the product direction is intent-mining; the seam exists so new ingestion paths (paste/transcript) can reuse the whole output pipeline.

- The string "Replit Agent" still appears ONCE in the build-prompt intro, as one of several example agents (Claude Code, Cursor, Replit Agent, Gemini, ChatGPT). This is intentional and agent-agnostic — do NOT "de-Replit" it. The internal select value `"replit-fullstack"` is also kept deliberately (label is "Full-Stack Web App") for saved-draft compatibility.
  **How to apply:** if a grep for "Replit" flags these, leave them.

- Out of scope for this product (do not add unless explicitly asked): AI/LLM providers, transcripts/voice, paid providers, vector-DB/RAG, user accounts. Save/Restore Draft + autosave are existing features — keep them working.
