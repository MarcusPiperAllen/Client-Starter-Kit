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
  callToAction: string;
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
    callToAction: data.cta,
    technologyStack: data.techStack,
    contactEmail: data.email.trim(),
    contactPhone: data.phone.trim(),
    notes: data.notes.trim(),
  };
}
