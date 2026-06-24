import { describe, it, expect } from "vitest";
import { splitList, formDataToIntent, parseBrainDump, type FormData } from "./intent";

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

  it("strips leading 'and' from the last item of an Oxford-comma list", () => {
    expect(splitList("allergens, serving sizes, pickup times, and pricing")).toEqual([
      "allergens",
      "serving sizes",
      "pickup times",
      "pricing",
    ]);
  });

  it("strips leading 'or' from the last item of an or-terminated list", () => {
    expect(splitList("phone, email, or contact form")).toEqual([
      "phone",
      "email",
      "contact form",
    ]);
  });

  it("does not mutate words that start with 'and' or 'or' mid-word", () => {
    expect(splitList("android app, order management, ongoing support")).toEqual([
      "android app",
      "order management",
      "ongoing support",
    ]);
  });

  it("strips 'and' prefix when clause starts with 'and'", () => {
    expect(
      splitList("lead intake from phone calls, Facebook messages, referrals, and website forms")
    ).toEqual([
      "lead intake from phone calls",
      "Facebook messages",
      "referrals",
      "website forms",
    ]);
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
        "callToActionCustom",
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
        "toneNuance",
      ].sort(),
    );
  });
});

describe("parseBrainDump — business name extraction", () => {
  it("extracts business name from a labeled line", () => {
    const intent = parseBrainDump("Business: Iron Rod Steel\nGoal: generate leads");
    expect(intent.businessName).toBe("Iron Rod Steel");
  });

  it("infers business name from a short unlabeled first line (≤5 words, no terminal punctuation)", () => {
    const intent = parseBrainDump("Bright Smile Dental\nGoal: book appointments");
    expect(intent.businessName).toBe("Bright Smile Dental");
  });

  it("infers business name from 'Company is a ...' opening in a single-paragraph dump", () => {
    const intent = parseBrainDump(
      "Iron Rod Steel is a structural steel fabrication company. We want to generate leads from local contractors.",
    );
    expect(intent.businessName).toBe("Iron Rod Steel");
  });

  it("does not infer business name from a lowercase opening that lacks the pattern", () => {
    const intent = parseBrainDump("we are a dental practice trying to book appointments online.");
    expect(intent.businessName).toBe("");
  });

  it("does not overwrite a labeled business name with the paragraph heuristic", () => {
    const intent = parseBrainDump(
      "Business: Apex Steel\nApex Steel is a fabrication company. We want more leads.",
    );
    expect(intent.businessName).toBe("Apex Steel");
  });
});

describe("parseBrainDump — project name normalization", () => {
  it("strips stray leading 'a' before a capital letter (select-all artifact)", () => {
    const intent = parseBrainDump("aSlimInvoice\nGoal: get more freelance clients");
    expect(intent.businessName).toBe("SlimInvoice");
  });

  it("strips stray 'a' from labeled business name", () => {
    const intent = parseBrainDump("Business: aSlimInvoice\nGoal: generate revenue");
    expect(intent.businessName).toBe("SlimInvoice");
  });

  it("strips leading 'So, ' opener from inferred name", () => {
    const intent = parseBrainDump("So, SlimInvoice\nGoal: get more freelance clients");
    expect(intent.businessName).toBe("SlimInvoice");
  });

  it("strips leading 'my ' possessive from labeled name", () => {
    const intent = parseBrainDump("Business: my BriefStack");
    expect(intent.businessName).toBe("BriefStack");
  });

  it("does not strip legitimate multi-word business names", () => {
    const intent = parseBrainDump("Business: Iron Rod Steel");
    expect(intent.businessName).toBe("Iron Rod Steel");
  });

  it("does not strip names that start with intentional lowercase", () => {
    const intent = parseBrainDump("Business: eBay Clone");
    expect(intent.businessName).toBe("eBay Clone");
  });
});

describe("parseBrainDump — tone nuance detection", () => {
  it("detects 'dark mode' from free text and populates toneNuance", () => {
    const intent = parseBrainDump("ThriftMarket\nCool marketplace. Dark mode by default.");
    expect(intent.toneNuance).toContain("dark mode");
  });

  it("detects 'dark by default' phrasing", () => {
    const intent = parseBrainDump("App site. Dark by default, Gen Z aesthetic.");
    expect(intent.toneNuance).toContain("dark mode");
  });

  it("detects 'luxury' from free text", () => {
    const intent = parseBrainDump("Luxury boutique for premium clients.");
    expect(intent.toneNuance).toContain("luxury");
  });

  it("detects 'minimal' / 'minimalist' from free text", () => {
    const intent = parseBrainDump("We want a clean, minimalist portfolio site.");
    expect(intent.toneNuance).toContain("minimal");
  });

  it("detects 'not corporate' phrase", () => {
    const intent = parseBrainDump("Warm tone, not corporate — friendly and direct.");
    expect(intent.toneNuance).toContain("not corporate");
  });

  it("detects multiple nuance signals and joins them", () => {
    const intent = parseBrainDump("We want a luxury minimal experience.");
    expect(intent.toneNuance).toContain("luxury");
    expect(intent.toneNuance).toContain("minimal");
  });

  it("returns empty toneNuance when no nuance signal is present", () => {
    const intent = parseBrainDump("Business: Acme Corp\nGoal: get more leads");
    expect(intent.toneNuance).toBe("");
  });
});

describe("parseBrainDump — smart CTA extraction", () => {
  it("maps 'join waitlist' to callToActionCustom 'Join Waitlist'", () => {
    const intent = parseBrainDump("I want a join waitlist form above the fold.");
    expect(intent.callToActionCustom).toBe("Join Waitlist");
  });

  it("maps 'waitlist signup' to callToActionCustom 'Join Waitlist'", () => {
    const intent = parseBrainDump("SlimInvoice — waitlist signup for beta users.");
    expect(intent.callToActionCustom).toBe("Join Waitlist");
  });

  it("maps 'early access' to callToActionCustom 'Get Early Access'", () => {
    const intent = parseBrainDump("Get early access to our new platform.");
    expect(intent.callToActionCustom).toBe("Get Early Access");
  });

  it("maps 'volunteer' to callToAction 'get involved' and callToActionCustom 'Volunteer Today'", () => {
    const intent = parseBrainDump("Nonprofit site. We need people to volunteer and help.");
    expect(intent.callToAction).toBe("get involved");
    expect(intent.callToActionCustom).toBe("Volunteer Today");
  });

  it("maps 'donate' to callToAction 'donate'", () => {
    const intent = parseBrainDump("Charity site. Please donate to support our mission.");
    expect(intent.callToAction).toBe("donate");
  });

  it("maps 'give' to callToAction 'donate'", () => {
    const intent = parseBrainDump("Help us grow. Give today to make a difference.");
    expect(intent.callToAction).toBe("donate");
  });

  it("maps 'make a gift' to callToAction 'donate'", () => {
    const intent = parseBrainDump("Encourage supporters to make a gift to the foundation.");
    expect(intent.callToAction).toBe("donate");
  });

  it("maps 'book a call' to callToAction 'book a call'", () => {
    const intent = parseBrainDump("Coaching site. Book a call to get started.");
    expect(intent.callToAction).toBe("book a call");
  });

  it("maps 'get a quote' to callToAction 'request a quote'", () => {
    const intent = parseBrainDump("Plumbing company. Get a quote for your repair.");
    expect(intent.callToAction).toBe("request a quote");
  });

  it("maps 'get estimate' to callToAction 'request a quote'", () => {
    const intent = parseBrainDump("Roofing contractor. Get estimate for your project.");
    expect(intent.callToAction).toBe("request a quote");
  });

  it("donate + volunteer: donation CTA takes priority, callToActionCustom is empty", () => {
    const intent = parseBrainDump(
      "We are a nonprofit. Please donate to support our cause. We also need people to volunteer.",
    );
    expect(intent.callToAction).toBe("donate");
    expect(intent.callToActionCustom ?? "").toBe("");
  });

  it("volunteer-only: maps to callToAction 'get involved' and callToActionCustom 'Volunteer Today'", () => {
    const intent = parseBrainDump(
      "Community garden — we need people to volunteer every Saturday.",
    );
    expect(intent.callToAction).toBe("get involved");
    expect(intent.callToActionCustom).toBe("Volunteer Today");
  });
});
