// The editable form surface. Mirrors the intake fields the user fills in.
export interface FormData {
  projectName: string;
  businessName: string;
  founderName: string;
  orgType: string;
  goal: string;
  audience: string;
  services: string;
  pages: string;
  tone: string;
  email: string;
  phone: string;
  cta: string;
  techStack: string;
  notes: string;
}

// Canonical internal model. The form (FormData) is the editable surface; every
// generated output is derived from this normalized structure. A future
// mind-dump miner can produce an ExtractedIntent directly, drop it into the
// form for user review/edit, and reuse the exact same output pipeline.
export interface ExtractedIntent {
  projectName: string;
  businessName: string;
  founderName: string;
  organizationType: string;
  primaryGoal: string;
  audience: string;
  services: string[];
  pages: string[];
  tone: string;
  toneNuance: string;
  callToAction: string;
  callToActionCustom: string;
  technologyStack: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

// Splits a comma-separated string into trimmed, non-empty items. Drops empty
// segments produced by trailing/leading/repeated commas and whitespace-only
// entries.
export const splitList = (value: string): string[] =>
  value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];

// The seam between the editable form and the canonical model. The future
// mind-dump miner will produce an ExtractedIntent here instead of the form.
export function formDataToIntent(data: FormData): ExtractedIntent {
  return {
    projectName: data.projectName.trim(),
    businessName: data.businessName.trim(),
    founderName: data.founderName.trim(),
    organizationType: data.orgType,
    primaryGoal: data.goal.trim(),
    audience: data.audience.trim(),
    services: splitList(data.services),
    pages: splitList(data.pages),
    tone: data.tone,
    toneNuance: "",
    callToAction: data.cta,
    callToActionCustom: "",
    technologyStack: data.techStack,
    contactEmail: data.email.trim(),
    contactPhone: data.phone.trim(),
    notes: data.notes.trim(),
  };
}

// The inverse of formDataToIntent: lay a canonical intent back onto the
// editable form surface. The mind-dump miner produces an ExtractedIntent, and
// this maps it into FormData so the user can review and edit before generating.
export function intentToFormData(intent: ExtractedIntent): FormData {
  return {
    projectName: intent.projectName,
    businessName: intent.businessName,
    founderName: intent.founderName,
    orgType: intent.organizationType,
    goal: intent.primaryGoal,
    audience: intent.audience,
    services: intent.services.join(", "),
    pages: intent.pages.join(", "),
    tone: intent.tone,
    cta: intent.callToAction,
    techStack: intent.technologyStack,
    email: intent.contactEmail,
    phone: intent.contactPhone,
    notes: intent.notes,
  };
}

// Project kind drives how the build prompt is framed (informational website
// vs. a software product/SaaS with features, data, and auth).
export type ProjectKind = "website" | "software";

export function deriveProjectKind(intent: ExtractedIntent): ProjectKind {
  return intent.organizationType === "software/app startup" ||
    intent.technologyStack === "replit-fullstack"
    ? "software"
    : "website";
}

// Human-readable labels, mirrored on the server (routes/intent.ts) so the
// fallback path surfaces the same gap accounting the AI path produces.
const ESSENTIAL_FIELDS: Array<keyof ExtractedIntent> = [
  "businessName",
  "organizationType",
  "primaryGoal",
  "audience",
];

// Mirror of the server's FIELD_LABELS (routes/intent.ts) so the fallback path
// reports the same fields and ordering as the AI path.
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

const intentFieldFilled = (intent: ExtractedIntent, field: keyof ExtractedIntent): boolean => {
  const value = intent[field];
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
};

export interface IntentSummary {
  filledFields: string[];
  missingFields: string[];
  suggestions: string[];
}

// Computes filled/missing essential fields plus simple gap-based suggestions.
// Used for the rule-based fallback so its result mirrors the AI miner's shape.
export function summarizeIntent(intent: ExtractedIntent): IntentSummary {
  const labeledFields = Object.keys(FIELD_LABELS) as Array<keyof ExtractedIntent>;
  const filledFields = labeledFields
    .filter((f) => intentFieldFilled(intent, f))
    .map((f) => FIELD_LABELS[f]);
  const missingFields = ESSENTIAL_FIELDS.filter((f) => !intentFieldFilled(intent, f)).map(
    (f) => FIELD_LABELS[f],
  );

  const suggestions: string[] = [];
  if (!intentFieldFilled(intent, "audience"))
    suggestions.push("No target audience detected — specify who this is for.");
  if (!intentFieldFilled(intent, "primaryGoal"))
    suggestions.push("No clear goal detected — state what visitors should do.");
  if (!intentFieldFilled(intent, "callToAction"))
    suggestions.push("Add a clear call to action to strengthen conversions.");
  if (!intentFieldFilled(intent, "tone"))
    suggestions.push("No brand tone set — pick one so the design feels intentional.");
  if (!intentFieldFilled(intent, "services"))
    suggestions.push("List your key services or features so the site has substance.");

  return { filledFields, missingFields, suggestions };
}

// ---------------------------------------------------------------------------
// Mind-dump miner: rule-based extraction of unstructured notes -> intent.
// No paid AI provider required. Two complementary strategies:
//   1. "Label: value" lines (Business:, Goal:, Services:, ...) are parsed
//      directly into the matching field.
//   2. Free-form text is mined for emails, phones, and keyword-matched select
//      values (organization type, tone, CTA, tech stack); leftover prose is
//      kept as notes / goal so nothing the user typed is lost.
// ---------------------------------------------------------------------------

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Returns the canonical select value whose keyword set first matches the text.
const matchKeyword = (text: string, table: ReadonlyArray<readonly [string, readonly string[]]>): string => {
  if (!text) return "";
  for (const [value, keywords] of table) {
    for (const kw of keywords) {
      if (new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(text)) return value;
    }
  }
  return "";
};

// Maps recognized line labels to form fields. Order is irrelevant (exact match).
const LABEL_MAP: Record<string, keyof FormData> = {
  "project": "projectName", "project name": "projectName",
  "business": "businessName", "business name": "businessName",
  "company": "businessName", "company name": "businessName",
  "organization": "businessName", "organization name": "businessName",
  "org name": "businessName", "brand": "businessName", "name": "businessName",
  "founder": "founderName", "founder name": "founderName", "owner": "founderName",
  "your name": "founderName", "my name": "founderName", "contact name": "founderName",
  "type": "orgType", "org type": "orgType", "organization type": "orgType",
  "business type": "orgType", "industry": "orgType", "category": "orgType",
  "goal": "goal", "goals": "goal", "primary goal": "goal", "objective": "goal", "purpose": "goal",
  "audience": "audience", "target audience": "audience", "target": "audience",
  "customers": "audience", "target market": "audience", "clients": "audience",
  "services": "services", "service": "services", "products": "services",
  "offerings": "services", "features": "services", "programs": "services", "menu": "services",
  "pages": "pages", "page": "pages", "sections": "pages",
  "tone": "tone", "brand tone": "tone", "vibe": "tone", "style": "tone",
  "cta": "cta", "call to action": "cta", "action": "cta",
  "tech": "techStack", "tech stack": "techStack", "stack": "techStack",
  "technology": "techStack", "technology stack": "techStack",
  "build type": "techStack", "framework": "techStack",
  "email": "email", "e-mail": "email", "contact email": "email",
  "phone": "phone", "tel": "phone", "telephone": "phone",
  "contact phone": "phone", "mobile": "phone",
  "notes": "notes", "note": "notes", "other": "notes", "misc": "notes", "additional notes": "notes",
};

const ORG_TYPE_KEYWORDS = [
  ["restaurant/food", ["restaurant", "cafe", "café", "coffee shop", "bakery", "diner", "bistro", "eatery", "catering", "food truck", "menu", "kitchen", "pizzeria", "brewery"]],
  ["church/faith organization", ["church", "ministry", "ministries", "faith", "worship", "congregation", "parish", "gospel", "chapel"]],
  ["nonprofit", ["nonprofit", "non-profit", "non profit", "charity", "ngo", "foundation"]],
  ["software/app startup", ["software", "saas", "app startup", "mobile app", "web app", "startup", "application", "tech company"]],
  ["agency/consultancy", ["agency", "consultancy", "consulting", "consultant", "studio", "marketing firm"]],
  ["product shop", ["ecommerce", "e-commerce", "online store", "store", "boutique", "retail", "merch", "storefront", "shop"]],
  ["personal brand", ["personal brand", "portfolio", "freelance", "freelancer", "coach", "influencer", "solopreneur"]],
  ["community project", ["community project", "community group", "grassroots", "neighborhood association"]],
  ["local service business", ["plumbing", "plumber", "hvac", "electrician", "landscaping", "lawn care", "cleaning", "contractor", "roofing", "salon", "barber", "spa", "repair", "handyman", "local service", "dentist", "dental", "clinic", "medical", "doctor", "chiropractor", "attorney", "lawyer", "law firm", "accountant", "accounting", "bookkeeping", "fitness", "gym", "auto repair", "mechanic", "photographer", "photography", "real estate", "realtor", "tutoring"]],
] as const;

const TONE_KEYWORDS = [
  ["faith-based", ["faith", "faith-based", "christian", "biblical", "gospel", "scripture", "worship"]],
  ["community-focused", ["community", "community-focused", "grassroots", "neighborly", "inclusive", "togetherness"]],
  ["playful", ["playful", "fun", "quirky", "whimsical", "lighthearted", "casual", "cheeky"]],
  ["bold", ["bold", "edgy", "daring", "confident", "punchy", "energetic", "strong"]],
  ["elegant", ["elegant", "luxury", "luxurious", "sophisticated", "refined", "premium", "upscale", "classy", "high-end"]],
  ["warm", ["warm", "friendly", "welcoming", "inviting", "approachable", "caring", "cozy", "compassionate"]],
  ["professional", ["professional", "corporate", "formal", "trustworthy", "polished", "businesslike"]],
] as const;

const CTA_KEYWORDS = [
  ["start free trial", ["free trial", "start trial", "sign up free", "try it free"]],
  ["request a demo", ["demo", "request a demo", "book a demo", "schedule a demo"]],
  ["book catering", ["book catering", "catering"]],
  ["book a call", ["book a call", "schedule a call", "consultation", "discovery call", "book an appointment", "appointment", "book now", "schedule a visit"]],
  ["request a quote", ["quote", "estimate", "get a quote", "get estimate"]],
  ["view menu", ["view menu", "see menu", "our menu", "menu"]],
  ["donate", ["donate", "donation", "give now", "give today", "make a gift", "support our cause", "support our mission", "support us", "give"]],
  ["shop now", ["shop now", "buy now", "purchase", "order now", "add to cart", "order online"]],
  ["get involved", ["get involved", "volunteer", "sign up to volunteer", "join us", "become a member"]],
  ["contact us", ["contact us", "get in touch", "reach out", "contact"]],
  ["learn more", ["learn more", "find out more", "read more"]],
] as const;

const TECH_KEYWORDS = [
  ["nextjs", ["next.js", "nextjs", "next js"]],
  ["react", ["react", "react.js", "reactjs"]],
  ["replit-fullstack", ["full-stack", "fullstack", "full stack", "database", "backend", "user accounts", "login", "authentication", "auth", "dashboard", "sign in", "user login"]],
  ["html-css-js", ["javascript", "vanilla js", "interactive", "js"]],
  ["html-css", ["html", "css", "static site", "static", "simple site", "landing page"]],
] as const;

// Detects visual/aesthetic nuance phrases in free text to populate toneNuance.
// Captures signals like "dark mode", "luxury", "minimal", "not corporate" so
// the existing cm palette modifier fires automatically from the brain dump,
// not just from the manual Tone Nuance form field.
const NUANCE_DETECTORS: ReadonlyArray<readonly [string, RegExp]> = [
  ["dark mode",        /\bdark\s+mode\b|\bdark\s+by\s+default\b/i],
  ["luxury",           /\bluxury\b|\bluxurious\b/i],
  ["minimal",          /\bminimal\b|\bminimalist\b/i],
  ["not corporate",    /\bnot\s+corporate\b|\bnon-corporate\b/i],
  ["modern and clean", /\bmodern\b.{0,30}\bclean\b|\bclean\b.{0,30}\bmodern\b/i],
  ["bold",             /\bbold\b/i],
  ["playful",          /\bplayful\b/i],
] as const;

function detectNuance(text: string): string {
  const found: string[] = [];
  for (const [phrase, re] of NUANCE_DETECTORS) {
    if (re.test(text)) {
      found.push(phrase);
      if (found.length >= 3) break;
    }
  }
  return found.join(", ");
}

// Strips common prefix artifacts from extracted project/business names so
// accidental leading characters ("aSlimInvoice" from select-all), informal
// openers ("So, MyApp", "my BriefStack"), and stray articles don't pollute
// the field. Conservative: only strips patterns clearly not part of the name.
function normalizeProjectName(name: string): string {
  if (!name) return name;
  let result = name;
  // Stray lowercase 'a' immediately before a capital letter (select-all artifact)
  result = result.replace(/^a(?=[A-Z])/, "");
  // Leading "so," / "so " opener (e.g. "So, BriefStack" -> "BriefStack")
  result = result.replace(/^so[,\s]+/i, "");
  // Leading "my " possessive (e.g. "my BriefStack" -> "BriefStack")
  result = result.replace(/^my\s+/i, "");
  return result.trim();
}

export function parseBrainDump(text: string): ExtractedIntent {
  const intent: ExtractedIntent = {
    projectName: "", businessName: "", founderName: "", organizationType: "",
    primaryGoal: "", audience: "", services: [], pages: [], tone: "", toneNuance: "",
    callToAction: "", callToActionCustom: "", technologyStack: "", contactEmail: "", contactPhone: "", notes: "",
  };

  const raw: Partial<Record<keyof FormData, string>> = {};
  let leftover: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/^[\s\-*•·\u2013\u2014>]+/, "").trim();
    if (!cleaned) continue;
    const colon = cleaned.indexOf(":");
    if (colon > 0 && colon <= 30) {
      const label = cleaned.slice(0, colon).trim().toLowerCase();
      const value = cleaned.slice(colon + 1).trim();
      const field = LABEL_MAP[label];
      if (field && value) {
        raw[field] = raw[field] ? `${raw[field]}, ${value}` : value;
        continue;
      }
    }
    leftover.push(cleaned);
  }

  const splitItems = (v: string): string[] =>
    v.split(/[,;\n]|\sand\s/i).map((s) => s.trim()).filter(Boolean);

  intent.projectName = normalizeProjectName(raw.projectName ?? "");
  intent.businessName = normalizeProjectName(raw.businessName ?? "");
  intent.founderName = raw.founderName ?? "";
  intent.primaryGoal = raw.goal ?? "";
  intent.audience = raw.audience ?? "";
  intent.services = raw.services ? splitItems(raw.services) : [];
  intent.pages = raw.pages ? splitItems(raw.pages) : [];

  intent.organizationType = matchKeyword(raw.orgType ?? "", ORG_TYPE_KEYWORDS) || matchKeyword(text, ORG_TYPE_KEYWORDS);
  intent.tone = matchKeyword(raw.tone ?? "", TONE_KEYWORDS) || matchKeyword(text, TONE_KEYWORDS);
  intent.callToAction = matchKeyword(raw.cta ?? "", CTA_KEYWORDS) || matchKeyword(text, CTA_KEYWORDS);
  intent.technologyStack = matchKeyword(raw.techStack ?? "", TECH_KEYWORDS) || matchKeyword(text, TECH_KEYWORDS);

  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  intent.contactEmail = (raw.email?.match(emailRe) ?? text.match(emailRe))?.[0] ?? "";

  const phoneFrom = (s: string): string => (s.match(/[+(]?\d[\d\s().-]{7,}\d/)?.[0] ?? "").trim();
  intent.contactPhone = raw.phone ? phoneFrom(raw.phone) : phoneFrom(text);

  // Heuristics for free-form prose (no labels). A brain dump often opens with
  // the business name, and a goal sentence usually contains an intent verb.
  if (!intent.businessName && leftover.length > 0) {
    const first = leftover[0];
    // Strip common informal openers before applying name-extraction heuristics.
    const firstNorm = first.replace(/^so[,\s]+/i, "").replace(/^my\s+/i, "").trim();
    if (firstNorm.split(/\s+/).length <= 5 && firstNorm.length <= 60 && !/[.!?]$/.test(firstNorm)) {
      intent.businessName = normalizeProjectName(firstNorm);
      leftover = leftover.slice(1);
    } else {
      // Single-paragraph dump: infer name from "CompanyName is a ..." opening sentence.
      const m = firstNorm.match(/^([A-Z][A-Za-z0-9 &'.-]{1,50}?)\s+(?:is|are|was)\s+(?:a|an|the)\b/);
      if (m) intent.businessName = normalizeProjectName(m[1].trim());
    }
  }
  if (!intent.primaryGoal) {
    const goalLine = leftover.find((l) => /\b(want|wants|goal|need|increase|drive|grow|generate|attract|get more|sell|help)\b/i.test(l));
    if (goalLine) {
      intent.primaryGoal = goalLine;
      leftover = leftover.filter((l) => l !== goalLine);
    }
  }

  // Detect custom CTA phrases that have no standard option (waitlist, early
  // access) and route them to callToActionCustom so effectiveCta in the UI
  // shows the specific phrase rather than a generic fallback.
  // Guard: if a donation-family CTA was captured, do not let volunteer text
  // override it with "Volunteer Today". Donation intent takes priority.
  if (!intent.callToActionCustom) {
    if (/\b(join\s+(?:the\s+)?waitlist|waitlist\s+signup)\b/i.test(text)) {
      intent.callToActionCustom = "Join Waitlist";
    } else if (/\b(get\s+early\s+access|early\s+access)\b/i.test(text)) {
      intent.callToActionCustom = "Get Early Access";
    } else if (/\bvolunteer\b/i.test(text) && intent.callToAction !== "donate") {
      // "volunteer" maps to the standard "get involved" CTA; add a friendlier
      // custom phrase so the generated output shows "Volunteer Today".
      // Only fire when donation is NOT the primary CTA.
      intent.callToActionCustom = "Volunteer Today";
      if (!intent.callToAction) intent.callToAction = "get involved";
    }
  }

  // Detect visual/aesthetic nuance from the brain dump and route it to
  // toneNuance so the cm palette modifier fires automatically without the user
  // needing to fill in the Tone Nuance field manually.
  intent.toneNuance = detectNuance(text);

  const notesParts: string[] = [];
  if (raw.notes) notesParts.push(raw.notes);
  if (leftover.length) notesParts.push(leftover.join(" "));
  intent.notes = notesParts.join(" ").trim();

  return intent;
}
