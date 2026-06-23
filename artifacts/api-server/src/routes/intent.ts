import { Router, type IRouter } from "express";
import { getOpenAI } from "@workspace/integrations-openai-ai-server";
import {
  MineIntentBody,
  MineIntentResponse,
  GenerateCopyBody,
  GenerateCopyResponse,
  ResolveQuestionsBody,
  ResolveQuestionsResponse,
  type ExtractedIntent,
  type MinedIntentResult,
  type GeneratedCopy,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Allowed select values — mirror the form's options in
// artifacts/launchframe/src/lib/intent.ts and home.tsx. The AI output is
// constrained to these so it never invents a value the form cannot render.
const ORG_TYPES = [
  "local service business",
  "software/app startup",
  "agency/consultancy",
  "restaurant/food",
  "nonprofit",
  "church/faith organization",
  "personal brand",
  "product shop",
  "community project",
] as const;

const TONES = [
  "professional",
  "bold",
  "elegant",
  "warm",
  "playful",
  "faith-based",
  "community-focused",
] as const;

const CTAS = [
  "book a call",
  "start free trial",
  "request a demo",
  "book catering",
  "request a quote",
  "view menu",
  "donate",
  "contact us",
  "shop now",
  "learn more",
  "get involved",
] as const;

const TECH_STACKS = [
  "html-css",
  "html-css-js",
  "react",
  "nextjs",
  "replit-fullstack",
] as const;

// Essential fields the product treats as required for a strong build prompt.
const ESSENTIAL_FIELDS: Array<keyof ExtractedIntent> = [
  "businessName",
  "organizationType",
  "primaryGoal",
  "audience",
];

const emptyIntent = (): ExtractedIntent => ({
  projectName: "",
  businessName: "",
  founderName: "",
  organizationType: "",
  primaryGoal: "",
  audience: "",
  services: [],
  pages: [],
  tone: "",
  toneNuance: "",
  callToAction: "",
  callToActionCustom: "",
  technologyStack: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
});

const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

// Coerce a model-provided select value to an allowed option, else "".
const constrain = (v: unknown, allowed: readonly string[]): string => {
  const s = asString(v).toLowerCase();
  return allowed.includes(s) ? s : "";
};

// Normalize raw model JSON into the canonical, schema-valid intent. Any field
// the model omits or fills with an out-of-range value is reduced to a safe
// default so the response always conforms to ExtractedIntent.
function normalizeIntent(raw: unknown): ExtractedIntent {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    projectName: asString(obj.projectName),
    businessName: asString(obj.businessName),
    founderName: asString(obj.founderName),
    organizationType: constrain(obj.organizationType, ORG_TYPES),
    primaryGoal: asString(obj.primaryGoal),
    audience: asString(obj.audience),
    services: asStringArray(obj.services),
    pages: asStringArray(obj.pages),
    tone: constrain(obj.tone, TONES),
    toneNuance: asString(obj.toneNuance),
    callToAction: constrain(obj.callToAction, CTAS),
    callToActionCustom: asString(obj.callToActionCustom),
    technologyStack: constrain(obj.technologyStack, TECH_STACKS),
    contactEmail: asString(obj.contactEmail),
    contactPhone: asString(obj.contactPhone),
    notes: asString(obj.notes),
  };
}

const isFilled = (intent: ExtractedIntent, field: keyof ExtractedIntent): boolean => {
  const value = intent[field];
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
};

const ALL_FIELDS = Object.keys(emptyIntent()) as Array<keyof ExtractedIntent>;

// Human-readable labels for missing-field messaging on the client.
const FIELD_LABELS: Record<keyof ExtractedIntent, string> = {
  projectName: "Project name",
  businessName: "Business / organization name",
  founderName: "Founder name",
  organizationType: "Organization type",
  primaryGoal: "Primary goal",
  audience: "Target audience",
  services: "Services / features",
  pages: "Pages",
  tone: "Brand tone",
  toneNuance: "Tone nuance",
  callToAction: "Call to action",
  callToActionCustom: "Custom CTA text",
  technologyStack: "Technology stack",
  contactEmail: "Contact email",
  contactPhone: "Contact phone",
  notes: "Notes",
};

const SYSTEM_PROMPT = `You are LaunchFrame's Intent Miner: a specialized prompt-architecture assistant, not a generic chatbot and not a label extractor. Your only job is to understand messy project intent and convert it into a complete, build-ready project brief that will power ONE Universal Agent Build Prompt for a downstream AI coding agent (Replit Agent, Claude Code, Cursor, Gemini, ChatGPT, etc.).

Think like a trained intake strategist. Before filling fields, reason through the project:
- What is the user really trying to build, beneath the messy wording?
- What kind of project is this: website, SaaS app, internal tool, personal brand, nonprofit, community project, or local business site?
- Who is the audience, even if it is only implied?
- What features, pages, or screens does a project of THIS type normally require to be credible and usable?
- What information is missing or ambiguous?
- What assumptions are reasonable to make on the founder's behalf, versus what must be left for the human to confirm?
- What should the downstream coding agent be explicitly instructed to build, and what should it be free to decide using sensible defaults?

Do not merely copy labels or phrases from the transcript. Infer. Connect the dots. Fill in what an experienced strategist would reasonably expect for this project type, while staying honest about what is genuinely unknown. The benchmark: given a rich brain dump describing a project, your output should be complete enough that the generated build prompt could actually start building that project.

Rules:
- Fill every field you can confidently infer or reasonably assume from project type and context. Infer typical "services"/"pages"/"screens" for the project type even when the dump does not list them explicitly. Leave a field empty ("" or []) only when there is genuinely no basis to infer it; never invent specific contact details, personal names, or real-world facts that were not stated or strongly implied.
- "organizationType" MUST be one of: ${ORG_TYPES.join(", ")} (or "" if none fits).
- "tone" MUST be one of: ${TONES.join(", ")} (or "").
- "toneNuance": a short verbatim phrase (3–8 words) capturing the user's specific tone language beyond the constrained enum, e.g. "modern, not corporate" or "bold but approachable". Capture exact language from the input. Use "" if the user said nothing specific about style or vibe.
- "callToAction" MUST be one of: ${CTAS.join(", ")} (or "").
- "callToActionCustom": if the user specifies an exact CTA phrase beyond a standard option (e.g. "Join the revolution", "Start building today"), capture it verbatim here. Use "" when no custom phrase was given.
- "technologyStack" MUST be one of: ${TECH_STACKS.join(", ")} (or ""). Choose "replit-fullstack" when the project needs accounts/login, a database, dashboards, or backend logic; choose a simpler option for a marketing/brochure site.
- "services" is a list of offerings, features, programs, products, screens, or menu items — for software, treat this as the core feature/screen list. "pages" is a list of desired site pages/sections (exclude Home and Contact, which are implied).
- "projectKind" is "software" when the project is an app/SaaS/tool with features, accounts, or data; "website" when it is primarily an informational/marketing/brochure presence.
- "notes" is where you capture strategic context the build prompt should carry but that has no dedicated field: the reasonable assumptions you made, defaults you are leaving to the coding agent, and any important nuance about what the project is really for.
- "suggestions" is a short list (max 5) that flags MISSING or UNCERTAIN items the human should confirm or decide — phrased for the founder (e.g. "No target audience stated — I assumed small business owners; confirm or adjust", "Consider adding a Pricing page", "Auth requirements are unclear — confirm whether users need accounts"). Prioritize the gaps that most affect what gets built.
- contactEmail/contactPhone: extract only if present in the text.`;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "object",
      additionalProperties: false,
      properties: {
        projectName: { type: "string" },
        businessName: { type: "string" },
        founderName: { type: "string" },
        organizationType: { type: "string", enum: ["", ...ORG_TYPES] },
        primaryGoal: { type: "string" },
        audience: { type: "string" },
        services: { type: "array", items: { type: "string" } },
        pages: { type: "array", items: { type: "string" } },
        tone: { type: "string", enum: ["", ...TONES] },
        toneNuance: { type: "string" },
        callToAction: { type: "string", enum: ["", ...CTAS] },
        callToActionCustom: { type: "string" },
        technologyStack: { type: "string", enum: ["", ...TECH_STACKS] },
        contactEmail: { type: "string" },
        contactPhone: { type: "string" },
        notes: { type: "string" },
      },
      required: [
        "projectName",
        "businessName",
        "founderName",
        "organizationType",
        "primaryGoal",
        "audience",
        "services",
        "pages",
        "tone",
        "toneNuance",
        "callToAction",
        "callToActionCustom",
        "technologyStack",
        "contactEmail",
        "contactPhone",
        "notes",
      ],
    },
    projectKind: { type: "string", enum: ["website", "software"] },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["intent", "projectKind", "suggestions"],
} as const;

const SIMPLICITY_SIGNALS = [
  "no backend", "no server", "no database", "no code", "no developer",
  "simple", "basic", "beginner", "volunteers", "limited budget", "low budget",
  "just html", "one page", "single page",
];

const ORG_SIMPLE_STACKS: Partial<Record<string, string>> = {
  "nonprofit":                 "html-css-js",
  "church/faith organization": "html-css-js",
  "community project":         "html-css-js",
  "local service business":    "html-css-js",
  "restaurant/food":           "html-css-js",
  "personal brand":            "html-css-js",
};

// Fills an EMPTY technologyStack using content signals — never overrides an
// explicit user choice or a value already set by the miner.
function suggestTechStack(intent: ExtractedIntent): string {
  if (intent.technologyStack) return intent.technologyStack;
  const corpus = `${intent.notes} ${intent.primaryGoal}`.toLowerCase();
  if (SIMPLICITY_SIGNALS.some((s) => corpus.includes(s))) return "html-css-js";
  const orgDefault = ORG_SIMPLE_STACKS[intent.organizationType];
  if (orgDefault) return orgDefault;
  return "";
}

router.post("/intent/mine", async (req, res) => {
  const parsed = MineIntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A non-empty 'text' field is required." });
    return;
  }

  const { text } = parsed.data;

  let completion;
  try {
    completion = await getOpenAI().chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "mined_intent",
          strict: true,
          schema: RESPONSE_JSON_SCHEMA,
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "intent mining: AI request failed");
    res.status(502).json({ error: "The AI miner is currently unavailable." });
    return;
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    req.log.error("intent mining: empty AI response");
    res.status(502).json({ error: "The AI miner returned an empty response." });
    return;
  }

  let rawResult: Record<string, unknown>;
  try {
    rawResult = JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    req.log.error({ err }, "intent mining: failed to parse AI JSON");
    res.status(502).json({ error: "The AI miner returned malformed output." });
    return;
  }

  const rawIntent = normalizeIntent(rawResult.intent);
  const intent: ExtractedIntent = { ...rawIntent, technologyStack: suggestTechStack(rawIntent) };
  const projectKind = rawResult.projectKind === "software" ? "software" : "website";
  const suggestions = asStringArray(rawResult.suggestions).slice(0, 5);

  const filledFields = ALL_FIELDS.filter((f) => isFilled(intent, f)).map((f) => FIELD_LABELS[f]);
  const missingFields = ESSENTIAL_FIELDS.filter((f) => !isFilled(intent, f)).map(
    (f) => FIELD_LABELS[f],
  );

  const result: MinedIntentResult = {
    intent,
    projectKind,
    filledFields,
    missingFields,
    suggestions,
    source: "ai",
  };

  // Validate our own response against the generated contract before sending.
  const validated = MineIntentResponse.parse(result);
  res.json(validated);
});

// ---------------------------------------------------------------------------
// Copy Intelligence Layer: turn a structured intent into polished marketing
// copy. The deterministic template engine on the client remains the fallback,
// so on any AI failure we return 502 and the client uses its templates.
// ---------------------------------------------------------------------------

const COPY_SYSTEM_PROMPT = `You are LaunchFrame's Copy Intelligence Layer: a senior brand and conversion copywriter. You are given a STRUCTURED project brief (already extracted and validated) and must write the high-value marketing copy for the project's landing page. You are not a chatbot and not a summarizer — you write copy a real founder would be proud to ship.

You will receive: business name, founder name, organization type, project kind (website vs software/app), primary goal, target audience, brand tone, call to action, the list of services/features, and any notes. Write copy that reads as if it was written specifically for THIS business — concrete, benefit-led, and human.

Write the following:
- heroHeadline: a short, punchy hook (roughly 4-10 words). It must be a real headline that sells an outcome or promise — NOT a truncated restatement of the goal, and NOT just "Business — goal". You may include the business name when it reads naturally, but prioritize a compelling hook over a label.
- heroSubheadline: one or two sentences (roughly 12-30 words) that expand on the headline, name the audience or the value, and lead naturally toward the call to action. No fragments.
- about: a founder-voice About section of 2-4 sentences. For a personal brand, write in first person ("I"); otherwise write in the brand's voice ("we"). Convey why the business exists and who it serves. Do not paste the goal verbatim.
- features: one entry per provided service/feature, in the same order. "name" MUST match the provided service text verbatim. "description" is ONE specific, benefit-led sentence about that feature — each description must be distinct (never a generic placeholder like "a focused feature that handles X cleanly").
- seoTitle: a clean, search-friendly page title, ideally under 60 characters, that includes the business name and the core value. Not a chopped sentence fragment.
- metaDescription: a compelling meta description under 155 characters that describes the offering and invites action. Complete sentences, no truncation.
- ctaCopy: if callToActionCustom is non-empty, use it verbatim as the button label and CTA phrase. If callToActionCustom is empty, derive natural copy from the callToAction enum value (e.g. "book a call" → "Book a Free Call"). Write 1-2 sentences motivating the reader to take the action.
- keywords: generate 4–6 buyer-intent search phrases a potential customer would type when actively shopping for this solution. Derive phrases from audience + core service offering + geography or niche when available. Examples for a freelance proposal tool: "proposal software for freelancers", "client proposal app for designers". Do NOT use feature names, technology terms, or company names as keywords. Every phrase must read as something a real person would type into a search bar.

Rules:
- Tone: use tone as the category anchor. If toneNuance is non-empty, treat it as a more specific override — "bold but approachable" should read warmer than "bold" alone. Let toneNuance shape word choice, sentence rhythm, and energy throughout all copy fields.
- Match the requested brand tone exactly. Adapt vocabulary to website vs software/app (e.g. "your team", "workflow", "platform" for software; service/community language for a website).
- Be specific and credible. Do not invent facts, statistics, prices, names, or claims that were not provided or strongly implied.
- Plain text only. No markdown, no surrounding quotation marks, no emoji, no double-quote characters inside the copy.
- If a field has no basis (e.g. no services were provided), still return a sensible, on-brand value; for features, return an empty array only when no services were provided.`;

const COPY_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    heroHeadline: { type: "string" },
    heroSubheadline: { type: "string" },
    about: { type: "string" },
    features: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    seoTitle: { type: "string" },
    metaDescription: { type: "string" },
    ctaCopy: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: [
    "heroHeadline",
    "heroSubheadline",
    "about",
    "features",
    "seoTitle",
    "metaDescription",
    "ctaCopy",
    "keywords",
  ],
} as const;

// Render the structured intent into a compact, readable brief for the model.
function intentToBrief(intent: ExtractedIntent, projectKind: string): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label}: ${value.trim()}`);
  };
  push("Business name", intent.businessName);
  push("Founder name", intent.founderName);
  push("Organization type", intent.organizationType);
  lines.push(`Project kind: ${projectKind}`);
  push("Primary goal", intent.primaryGoal);
  push("Target audience", intent.audience);
  push("Brand tone", intent.tone);
  push("Tone nuance", intent.toneNuance);
  push("Call to action", intent.callToAction);
  push("Custom CTA phrase", intent.callToActionCustom);
  if (intent.services.length > 0)
    lines.push(`Services/features (write one description each, names verbatim): ${intent.services.join("; ")}`);
  push("Notes", intent.notes);
  return lines.join("\n");
}

// Strip characters that would break HTML attributes / read as model noise, and
// collapse whitespace. Keeps the copy plain-text and scaffold-safe.
const sanitizeCopy = (v: unknown): string =>
  asString(v).replace(/["“”]/g, "'").replace(/\s+/g, " ").trim();

router.post("/intent/copy", async (req, res) => {
  const parsed = GenerateCopyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid 'intent' and 'projectKind' are required." });
    return;
  }

  const { intent, projectKind } = parsed.data;

  let completion;
  try {
    completion = await getOpenAI().chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: COPY_SYSTEM_PROMPT },
        { role: "user", content: intentToBrief(intent, projectKind) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_copy",
          strict: true,
          schema: COPY_RESPONSE_JSON_SCHEMA,
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "copy generation: AI request failed");
    res.status(502).json({ error: "The AI copywriter is currently unavailable." });
    return;
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    req.log.error("copy generation: empty AI response");
    res.status(502).json({ error: "The AI copywriter returned an empty response." });
    return;
  }

  let rawResult: Record<string, unknown>;
  try {
    rawResult = JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    req.log.error({ err }, "copy generation: failed to parse AI JSON");
    res.status(502).json({ error: "The AI copywriter returned malformed output." });
    return;
  }

  // Anchor feature names to the input services verbatim. The model may rewrite
  // or reorder names; the frontend maps AI descriptions by exact (lowercased)
  // service name, so we never trust model-supplied names. We pair each input
  // service with the model's description by name match, falling back to index.
  const rawFeatures = Array.isArray(rawResult.features) ? rawResult.features : [];
  const aiFeatures = rawFeatures.map((f) => {
    const obj = (f ?? {}) as Record<string, unknown>;
    return { name: asString(obj.name), description: sanitizeCopy(obj.description) };
  });
  const byName = new Map<string, string>();
  aiFeatures.forEach((f) => {
    if (f.name && f.description) byName.set(f.name.toLowerCase(), f.description);
  });
  const features = intent.services
    .map((service, i) => {
      const description =
        byName.get(service.toLowerCase()) || aiFeatures[i]?.description || "";
      return { name: service, description };
    })
    .filter((f) => f.name && f.description);

  const result: GeneratedCopy = {
    heroHeadline: sanitizeCopy(rawResult.heroHeadline),
    heroSubheadline: sanitizeCopy(rawResult.heroSubheadline),
    about: sanitizeCopy(rawResult.about),
    features,
    seoTitle: sanitizeCopy(rawResult.seoTitle),
    metaDescription: sanitizeCopy(rawResult.metaDescription),
    ctaCopy: sanitizeCopy(rawResult.ctaCopy),
    keywords: asStringArray(rawResult.keywords),
    source: "ai",
  };

  // If the model returned blanks for any high-value copy field, treat it as a
  // failure so the client falls back to its template copy rather than rendering
  // low-value or empty AI copy.
  if (
    !result.heroHeadline ||
    !result.heroSubheadline ||
    !result.about ||
    !result.ctaCopy ||
    !result.seoTitle ||
    !result.metaDescription
  ) {
    req.log.error("copy generation: AI response missing essential copy");
    res.status(502).json({ error: "The AI copywriter returned incomplete copy." });
    return;
  }

  // Validate our own response against the generated contract before sending.
  const validated = GenerateCopyResponse.parse(result);
  res.json(validated);
});

// ── Intent Resolution Layer ──────────────────────────────────────────────────
// Generates up to 3 ranked clarifying questions for a partially-filled intent.
// Uses AI when available; falls back to a deterministic set from missing fields.

type RQAnswerType = "boolean" | "single-select" | "multi-select" | "short-text";

interface RQItem {
  id: string;
  questionText: string;
  rationale: string;
  answerType: RQAnswerType;
  options: string[];
  targetFields: string[];
  priority: "architectural" | "content";
}

const FIELD_QUESTION_MAP: Partial<Record<keyof ExtractedIntent, Omit<RQItem, "id">>> = {
  organizationType: {
    questionText: "What type of organization is this?",
    rationale:    "Organization type drives the template, tone defaults, and build prompt structure.",
    answerType:   "single-select",
    options:      [...ORG_TYPES],
    targetFields: ["organizationType"],
    priority:     "architectural",
  },
  technologyStack: {
    questionText: "What technology stack should this project use?",
    rationale:    "The stack determines the starter code, build instructions, and complexity tier.",
    answerType:   "single-select",
    options:      [...TECH_STACKS],
    targetFields: ["technologyStack"],
    priority:     "architectural",
  },
  primaryGoal: {
    questionText: "What is the main goal of this project?",
    rationale:    "The primary goal anchors the hero headline, meta description, and build prompt.",
    answerType:   "short-text",
    options:      [],
    targetFields: ["primaryGoal"],
    priority:     "architectural",
  },
  businessName: {
    questionText: "What should we call this business or project?",
    rationale:    "The name appears in the hero, SEO title, footer, and prompt header.",
    answerType:   "short-text",
    options:      [],
    targetFields: ["businessName", "projectName"],
    priority:     "content",
  },
  tone: {
    questionText: "What tone should the website use?",
    rationale:    "Tone shapes copy style, CSS palette, and brand voice.",
    answerType:   "single-select",
    options:      [...TONES],
    targetFields: ["tone"],
    priority:     "content",
  },
  callToAction: {
    questionText: "What should the primary call to action be?",
    rationale:    "The CTA appears on every hero button and closing section.",
    answerType:   "single-select",
    options:      [...CTAS],
    targetFields: ["callToAction"],
    priority:     "content",
  },
  audience: {
    questionText: "Who is the primary audience for this project?",
    rationale:    "Audience language shapes the hero copy and feature descriptions.",
    answerType:   "short-text",
    options:      [],
    targetFields: ["audience"],
    priority:     "content",
  },
  contactEmail: {
    questionText: "What email address should visitors use to reach out?",
    rationale:    "Contact email appears in the footer, contact section, and mailto links.",
    answerType:   "short-text",
    options:      [],
    targetFields: ["contactEmail"],
    priority:     "content",
  },
};

// Priority order: architectural fields first, then content. Within each tier,
// most-impactful-first. Only fields with a template entry are surfaced.
const FIELD_PRIORITY_ORDER: Array<keyof ExtractedIntent> = [
  "organizationType",
  "technologyStack",
  "primaryGoal",
  "businessName",
  "tone",
  "callToAction",
  "audience",
  "contactEmail",
];

function buildFallbackQuestions(intent: ExtractedIntent, suggestions: string[]): RQItem[] {
  const questions: RQItem[] = [];

  for (const field of FIELD_PRIORITY_ORDER) {
    if (questions.length >= 3) break;
    if (isFilled(intent, field)) continue;
    const template = FIELD_QUESTION_MAP[field];
    if (!template) continue;
    questions.push({ id: `q_${field}`, ...template });
  }

  // If slots remain, surface suggestions that signal architectural decisions.
  if (questions.length < 3) {
    const archSignals = ["auth", "login", "payment", "pricing", "role", "account", "database"];
    for (const suggestion of suggestions.slice(0, 3)) {
      if (questions.length >= 3) break;
      if (archSignals.some((s) => suggestion.toLowerCase().includes(s))) {
        questions.push({
          id:           `q_suggestion_${questions.length}`,
          questionText: suggestion,
          rationale:    "This architectural decision affects the build prompt and starter code scaffolding.",
          answerType:   "boolean",
          options:      ["Yes, include this", "No, skip for now"],
          targetFields: ["notes"],
          priority:     "architectural",
        });
      }
    }
  }

  return questions;
}

const QUESTIONS_SYSTEM_PROMPT = `You are LaunchFrame's Resolution Strategist. You receive a partially-filled project brief and identify the 1-3 most impactful gaps to resolve before a developer can build the project.

Rank by impact:
  1. ARCHITECTURAL (highest): authentication, user accounts, payments, pricing tiers, user roles, database needs, external API integrations, MVP scope decisions.
  2. CONTENT (lower): missing business name, contact info, tone preference, CTA wording.

Rules:
- Never ask about a field that is already filled in the intent JSON.
- Cap at 3 questions. Prefer 1-2 high-impact questions over padding with low-value ones.
- For answerType "boolean", always use options: ["Yes, include this", "No, skip for now"] and set targetFields to ["notes"].
- For constrained fields, use answerType "single-select" and include the exact allowed options:
    organizationType: ${ORG_TYPES.join(", ")}
    tone: ${TONES.join(", ")}
    callToAction: ${CTAS.join(", ")}
    technologyStack: ${TECH_STACKS.join(", ")}
- For free-text fields, use answerType "short-text" and options [].
- targetFields must be valid ExtractedIntent keys: projectName, businessName, founderName, organizationType, primaryGoal, audience, services, pages, tone, callToAction, technologyStack, contactEmail, contactPhone, notes.
- "options" is always required — use [] for short-text questions.`;

const QUESTIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id:           { type: "string" },
          questionText: { type: "string" },
          rationale:    { type: "string" },
          answerType:   { type: "string", enum: ["boolean", "single-select", "multi-select", "short-text"] },
          options:      { type: "array", items: { type: "string" } },
          targetFields: { type: "array", items: { type: "string" } },
          priority:     { type: "string", enum: ["architectural", "content"] },
        },
        required: ["id", "questionText", "rationale", "answerType", "options", "targetFields", "priority"],
      },
    },
  },
  required: ["questions"],
} as const;

router.post("/intent/questions", async (req, res) => {
  const parsed = ResolveQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "A valid 'intent', 'projectKind', 'suggestions', and 'missingFields' are required." });
    return;
  }

  const { intent, projectKind, suggestions } = parsed.data;

  let questions: RQItem[];
  let source: "ai" | "fallback" = "ai";

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: QUESTIONS_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ intent, projectKind, suggestions }, null, 2) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "resolve_questions",
          strict: true,
          schema: QUESTIONS_JSON_SCHEMA,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const rawResult = JSON.parse(content) as Record<string, unknown>;
    const rawQuestions = Array.isArray(rawResult.questions) ? rawResult.questions : [];

    const validTypes: RQAnswerType[] = ["boolean", "single-select", "multi-select", "short-text"];
    questions = rawQuestions
      .slice(0, 3)
      .map((q, i): RQItem | null => {
        if (!q || typeof q !== "object") return null;
        const obj = q as Record<string, unknown>;
        const answerType = asString(obj.answerType);
        if (!validTypes.includes(answerType as RQAnswerType)) return null;
        const targetFields = asStringArray(obj.targetFields);
        if (!targetFields.length) return null;
        const questionText = asString(obj.questionText);
        if (!questionText) return null;
        return {
          id:           asString(obj.id) || `q_ai_${i}`,
          questionText,
          rationale:    asString(obj.rationale),
          answerType:   answerType as RQAnswerType,
          options:      asStringArray(obj.options),
          targetFields,
          priority:     asString(obj.priority) === "architectural" ? "architectural" : "content",
        };
      })
      .filter((q): q is RQItem => q !== null);

    if (questions.length === 0) throw new Error("No valid questions in AI response");
  } catch (err) {
    req.log.warn({ err }, "questions: AI failed — using deterministic fallback");
    questions = buildFallbackQuestions(intent, suggestions);
    source = "fallback";
  }

  const validated = ResolveQuestionsResponse.parse({ questions, source });
  res.json(validated);
});

export default router;
