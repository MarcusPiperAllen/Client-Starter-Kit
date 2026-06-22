import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  MineIntentBody,
  MineIntentResponse,
  type ExtractedIntent,
  type MinedIntentResult,
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

const SYSTEM_PROMPT = `You are an expert product analyst for an agency that turns rough founder brain dumps into structured website/software project briefs.

Read the user's messy, possibly label-free brain dump and infer a complete, accurate project intent. Reason about the business, audience, goals, and what matters — do not just pattern-match labels.

Rules:
- Fill every field you can confidently infer. Leave a field empty ("" or []) only when there is genuinely no signal; do not hallucinate contact details, names, or services that were not implied.
- "organizationType" MUST be one of: ${ORG_TYPES.join(", ")} (or "" if none fits).
- "tone" MUST be one of: ${TONES.join(", ")} (or "").
- "callToAction" MUST be one of: ${CTAS.join(", ")} (or "").
- "technologyStack" MUST be one of: ${TECH_STACKS.join(", ")} (or ""). Choose "replit-fullstack" when the project needs accounts/login, a database, dashboards, or backend logic; choose a simpler option for a marketing/brochure site.
- "services" is a list of offerings, features, programs, products, or menu items. "pages" is a list of desired site pages/sections (exclude Home and Contact, which are implied).
- "projectKind" is "software" when the project is an app/SaaS/tool with features, accounts, or data; "website" when it is primarily an informational/marketing/brochure presence.
- "suggestions" is a short list (max 5) of concrete, actionable recommendations about gaps or improvements, phrased for the founder (e.g. "No target audience detected — specify who this is for", "Consider adding a Pricing page", "A clear call to action like 'Book a Call' would strengthen conversions"). Base them on what is actually missing or weak in the dump.
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
    completion = await openai.chat.completions.create({
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

export default router;
