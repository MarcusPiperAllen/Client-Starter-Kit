import { describe, it, expect } from "vitest";
import { splitList, formDataToIntent, type FormData } from "./intent";

describe("splitList", () => {
  it("returns an empty array for an empty string", () => {
    expect(splitList("")).toEqual([]);
  });

  it("returns an empty array for a whitespace-only string", () => {
    expect(splitList("   ")).toEqual([]);
  });

  it("returns an empty array for commas-only input", () => {
    expect(splitList(",,, ,")).toEqual([]);
  });

  it("splits a comma-separated list and trims each item", () => {
    expect(splitList("About,  Services , Pricing")).toEqual([
      "About",
      "Services",
      "Pricing",
    ]);
  });

  it("drops empty segments from trailing, leading, and repeated commas", () => {
    expect(splitList(",About,,Services, ,Pricing,")).toEqual([
      "About",
      "Services",
      "Pricing",
    ]);
  });

  it("preserves duplicate entries (dedup is not its job)", () => {
    expect(splitList("Blog, Blog, blog")).toEqual(["Blog", "Blog", "blog"]);
  });

  it("handles a single item with surrounding whitespace", () => {
    expect(splitList("  Tax Consulting  ")).toEqual(["Tax Consulting"]);
  });
});

const baseForm: FormData = {
  projectName: "  Acme Site  ",
  businessName: "  Acme Corp  ",
  founderName: "  Marcus Piper  ",
  orgType: "agency/consultancy",
  goal: "  Get more leads  ",
  audience: "  Small business owners  ",
  services: "Brand Strategy, Web Design , SEO",
  pages: "About, , Pricing,",
  tone: "professional",
  email: "  hello@acme.com  ",
  phone: "  555-1234  ",
  cta: "book a call",
  techStack: "react",
  notes: "  internal note  ",
};

describe("formDataToIntent", () => {
  it("maps form fields to the canonical intent field names", () => {
    const intent = formDataToIntent(baseForm);
    expect(intent.organizationType).toBe("agency/consultancy");
    expect(intent.primaryGoal).toBe("Get more leads");
    expect(intent.callToAction).toBe("book a call");
    expect(intent.technologyStack).toBe("react");
    expect(intent.contactEmail).toBe("hello@acme.com");
    expect(intent.contactPhone).toBe("555-1234");
  });

  it("trims string fields", () => {
    const intent = formDataToIntent(baseForm);
    expect(intent.projectName).toBe("Acme Site");
    expect(intent.businessName).toBe("Acme Corp");
    expect(intent.founderName).toBe("Marcus Piper");
    expect(intent.audience).toBe("Small business owners");
    expect(intent.notes).toBe("internal note");
  });

  it("converts comma-separated services and pages into clean arrays", () => {
    const intent = formDataToIntent(baseForm);
    expect(intent.services).toEqual(["Brand Strategy", "Web Design", "SEO"]);
    expect(intent.pages).toEqual(["About", "Pricing"]);
  });

  it("produces empty arrays when list fields are blank", () => {
    const intent = formDataToIntent({ ...baseForm, services: "", pages: "   " });
    expect(intent.services).toEqual([]);
    expect(intent.pages).toEqual([]);
  });

  it("does not trim select-style fields that come from controlled inputs", () => {
    const intent = formDataToIntent({
      ...baseForm,
      orgType: "nonprofit",
      tone: "warm",
      cta: "donate",
      techStack: "nextjs",
    });
    expect(intent.organizationType).toBe("nonprofit");
    expect(intent.tone).toBe("warm");
    expect(intent.callToAction).toBe("donate");
    expect(intent.technologyStack).toBe("nextjs");
  });

  it("returns all expected keys", () => {
    const intent = formDataToIntent(baseForm);
    expect(Object.keys(intent).sort()).toEqual(
      [
        "audience",
        "businessName",
        "callToAction",
        "contactEmail",
        "contactPhone",
        "founderName",
        "notes",
        "organizationType",
        "pages",
        "primaryGoal",
        "projectName",
        "services",
        "technologyStack",
        "tone",
      ].sort(),
    );
  });
});
