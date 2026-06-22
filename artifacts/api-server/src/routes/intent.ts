import { Router, type IRouter } from "express";
import { getOpenAI } from "@workspace/integrations-openai-ai-server";
import {
  MineIntentBody,
  MineIntentResponse,
  GenerateCopyBody,
  GenerateCopyResponse,
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
  callToAction: "",
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
    callToAction: constrain(obj.callToAction, CTAS),
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
  callToAction: "Call to action",
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
- "callToAction" MUST be one of: ${CTAS.join(", ")} (or "").
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
        callToAction: { type: "string", enum: ["", ...CTAS] },
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
        "callToAction",
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

  const intent = normalizeIntent(rawResult.intent);
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
- ctaCopy: 1-2 sentences of call-to-action section copy that motivates the reader to take the selected action.

Rules:
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
  },
  required: [
    "heroHeadline",
    "heroSubheadline",
    "about",
    "features",
    "seoTitle",
    "metaDescription",
    "ctaCopy",
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
  push("Call to action", intent.callToAction);
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

export default router;
