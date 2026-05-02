import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ArrowLeft, Loader2, Frame, Save, RotateCcw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  projectName: string;
  businessName: string;
  orgType: string;
  goal: string;
  audience: string;
  services: string;
  pages: string;
  tone: string;
  email: string;
  phone: string;
  cta: string;
  notes: string;
}

const AUTOSAVE_KEY = "launchframe-autosave";
const DRAFT_KEY = "launchframe-draft";

const emptyData: FormData = {
  projectName: "",
  businessName: "",
  orgType: "",
  goal: "",
  audience: "",
  services: "",
  pages: "",
  tone: "",
  email: "",
  phone: "",
  cta: "",
  notes: "",
};

function readStorage(key: string): FormData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as FormData;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: FormData): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function hasDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

export default function Home() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(() => readStorage(AUTOSAVE_KEY) ?? emptyData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOutputMode, setIsOutputMode] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [draftExists, setDraftExists] = useState<boolean>(hasDraft);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setAutoSaveStatus("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      writeStorage(AUTOSAVE_KEY, formData);
      setAutoSaveStatus("saved");
      const clearTimer = setTimeout(() => setAutoSaveStatus("idle"), 2500);
      return () => clearTimeout(clearTimer);
    }, 800);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof FormData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveDraft = () => {
    const ok = writeStorage(DRAFT_KEY, formData);
    if (ok) {
      setDraftExists(true);
      toast({ title: "Draft saved", description: "You can restore this draft anytime.", duration: 2000 });
    } else {
      toast({ title: "Could not save draft", description: "Storage may be unavailable.", duration: 3000, variant: "destructive" });
    }
  };

  const handleRestoreDraft = () => {
    const draft = readStorage(DRAFT_KEY);
    if (draft) {
      setFormData(draft);
      toast({ title: "Draft restored", description: "Your saved draft has been loaded.", duration: 2000 });
    } else {
      toast({ title: "No draft found", description: "Save a draft first.", duration: 2000 });
    }
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsOutputMode(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 600);
  };

  const handleBackToForm = () => {
    setIsOutputMode(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopy = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${title} copied to clipboard.`,
      duration: 2000,
    });
  };

  if (isOutputMode) {
    return <OutputView formData={formData} onBack={handleBackToForm} onCopy={handleCopy} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-4">
            <Frame className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">LaunchFrame</h1>
          <p className="mt-3 text-lg text-muted-foreground">Internal website planning tool.</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <CardTitle>Project Intake</CardTitle>
            <CardDescription>Fill out client details to generate a website plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                placeholder="e.g. Acme Corp Redesign"
                data-testid="input-project-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessName">Business / Organization Name</Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="e.g. Acme Corp"
                data-testid="input-business-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgType">Organization Type</Label>
              <Select value={formData.orgType} onValueChange={handleSelectChange("orgType")}>
                <SelectTrigger id="orgType" data-testid="select-org-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nonprofit">Nonprofit</SelectItem>
                  <SelectItem value="local service business">Local Service Business</SelectItem>
                  <SelectItem value="personal brand">Personal Brand</SelectItem>
                  <SelectItem value="product shop">Product Shop</SelectItem>
                  <SelectItem value="community project">Community Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">Primary Website Goal</Label>
              <Textarea
                id="goal"
                name="goal"
                value={formData.goal}
                onChange={handleInputChange}
                placeholder="e.g. Get more leads for our consulting services."
                data-testid="textarea-goal"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">What do you want visitors to do or feel after seeing this site? Be specific.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                name="audience"
                value={formData.audience}
                onChange={handleInputChange}
                placeholder="e.g. Families in Memphis looking for catering"
                data-testid="input-audience"
              />
              <p className="text-xs text-muted-foreground">Be specific — who exactly is this for? The more detail, the better the copy.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="services">Services, Programs, or Products</Label>
              <Textarea
                id="services"
                name="services"
                value={formData.services}
                onChange={handleInputChange}
                placeholder="e.g. Tax Consulting, Bookkeeping, Payroll"
                data-testid="textarea-services"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Separate each item with a comma. For food businesses, list menu items — they'll be grouped under "Menu Highlights" automatically.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pages">Desired Pages</Label>
              <Textarea
                id="pages"
                name="pages"
                value={formData.pages}
                onChange={handleInputChange}
                placeholder="e.g. About, Services, Pricing, Blog"
                data-testid="textarea-pages"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">List pages beyond Home and Contact — those are added automatically. Separate with commas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="tone">Brand Tone</Label>
                <Select value={formData.tone} onValueChange={handleSelectChange("tone")}>
                  <SelectTrigger id="tone" data-testid="select-tone">
                    <SelectValue placeholder="Select tone..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="elegant">Elegant</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="faith-based">Faith-based</SelectItem>
                    <SelectItem value="community-focused">Community-focused</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cta">Call to Action</Label>
                <Select value={formData.cta} onValueChange={handleSelectChange("cta")}>
                  <SelectTrigger id="cta" data-testid="select-cta">
                    <SelectValue placeholder="Select CTA..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book a call">Book a Call</SelectItem>
                    <SelectItem value="book catering">Book Catering</SelectItem>
                    <SelectItem value="request a quote">Request a Quote</SelectItem>
                    <SelectItem value="view menu">View Menu</SelectItem>
                    <SelectItem value="donate">Donate</SelectItem>
                    <SelectItem value="contact us">Contact Us</SelectItem>
                    <SelectItem value="shop now">Shop Now</SelectItem>
                    <SelectItem value="learn more">Learn More</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="hello@example.com"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                  data-testid="input-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Any other details..."
                data-testid="textarea-notes"
                className="resize-none"
              />
            </div>

            <div className="pt-2 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={handleSaveDraft}
                  data-testid="button-save-draft"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={handleRestoreDraft}
                  disabled={!draftExists}
                  data-testid="button-restore-draft"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Draft
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="h-5 flex items-center" data-testid="status-autosave">
                  {autoSaveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      Auto-saved
                    </span>
                  )}
                  {autoSaveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {draftExists ? "Draft available" : "No draft saved"}
                </span>
              </div>

              <Button
                className="w-full h-12 text-lg font-medium"
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="button-generate"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Plan...
                  </>
                ) : (
                  "Generate Website Plan"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Output View Component ---

function OutputView({
  formData,
  onBack,
  onCopy,
}: {
  formData: FormData;
  onBack: () => void;
  onCopy: (text: string, title: string) => void;
}) {
  const { businessName, orgType, goal, audience, services, pages, tone, email, phone, cta } = formData;

  const bizName = businessName || "Your Business";
  const goalDisplay = goal || "build a strong online presence";
  const audienceDisplay = audience || "your community";
  const toneDisplay = tone || "professional";
  const ctaLabel = cta || "get in touch";
  const ctaUpper = ctaLabel.charAt(0).toUpperCase() + ctaLabel.slice(1);

  // --- Deduplicated navigation ---
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
  const reservedNav = new Set(["home", "contact"]);
  const rawPages = pages ? pages.split(",").map(p => p.trim()).filter(Boolean) : [];
  const filteredPages = rawPages.filter(p => !reservedNav.has(norm(p)));
  const navItems = ["Home", ...filteredPages, "Contact"];
  const navString = navItems.join(" • ");

  // --- Food / menu context detection ---
  const foodKeywords = [
    "brisket","chicken","ribs","mac","potato","salad","wings","pizza","taco","burger",
    "sandwich","soup","steak","seafood","pasta","sushi","bbq","cake","pie","dessert",
    "appetizer","entree","platter","catering","menu","dish","food","drink","beverage",
    "cocktail","coffee","latte","espresso","brunch","breakfast","lunch","dinner",
    "smoked","grilled","fried","roasted","baked","pulled pork","hot dog","sub","wrap",
  ];
  const checkFood = (text: string) => {
    const lower = (text || "").toLowerCase();
    return foodKeywords.some(k => lower.includes(k));
  };
  const isMenuContext = checkFood(services) || checkFood(goal) || checkFood(businessName);

  const servicesList = services ? services.split(",").map(s => s.trim()).filter(Boolean) : [];

  const servicesSectionTitle = isMenuContext
    ? "Menu Highlights"
    : orgType === "nonprofit" ? "Our Programs"
    : orgType === "personal brand" ? "What I Offer"
    : "What We Offer";

  // --- Derived copy helpers ---
  // Strip leading "to " and trailing period from goal for inline use
  const cleanGoal = goalDisplay.replace(/^to\s+/i, "").replace(/\.$/, "").toLowerCase();

  // First listed service — used to anchor benefit-focused copy
  const coreService = servicesList.length > 0 ? servicesList[0] : null;

  // Try to pull a location/city out of the audience field
  // e.g. "Families in Memphis" → "Memphis"  |  "homeowners in the Dallas area" → "Dallas area"
  const extractLocation = (text: string): string | null => {
    const m = text.match(/\bin\s+(?:the\s+)?([A-Z][a-zA-Z\s\-]+?)(?:\s+(?:area|region|community|metro)|[,.]|$)/);
    return m ? m[1].trim() : null;
  };
  const location = extractLocation(audience);

  // Describe a service item in one line based on keywords in its name
  const describeService = (name: string): string => {
    const n = name.toLowerCase();
    if (/lawn|mow|landscap|yard|grass/.test(n)) return "Keep your outdoor spaces looking their best year-round.";
    if (/clean|sanitiz|janitorial|housekeep/.test(n)) return "Thorough, dependable cleaning you won't have to think twice about.";
    if (/book|account|payroll|tax|financ/.test(n)) return "Accurate and organized so you can focus on running your business.";
    if (/plumb|pipe|drain|leak/.test(n)) return "Fast, reliable repairs that get your home back to normal.";
    if (/electric|wiring|panel|outlet/.test(n)) return "Safe, code-compliant work done by experienced professionals.";
    if (/coach|consult|strateg|advise/.test(n)) return "Practical guidance that moves the needle on what matters most.";
    if (/design|brand|logo|graphic/.test(n)) return "Visuals that represent you well and leave a lasting impression.";
    if (/photo|video|film|edit/.test(n)) return "High-quality content that tells your story with clarity and style.";
    if (/tutor|teach|train|educat/.test(n)) return "Clear, patient instruction tailored to where you are right now.";
    if (/web|site|seo|digital|market/.test(n)) return "Online presence that brings in the right people at the right time.";
    if (/hair|nail|salon|spa|massage|beauty/.test(n)) return "Professional care in a welcoming, relaxing environment.";
    if (/repair|fix|install|maintain/.test(n)) return "Handled properly the first time — no callbacks, no excuses.";
    if (/deliver|ship|transport|logistic/.test(n)) return "Reliable pickup and delivery, on your schedule.";
    if (/event|wedding|party|celebrat/.test(n)) return "Expertly coordinated so you can enjoy every moment.";
    if (/health|fitness|nutrit|wellness/.test(n)) return "Practical support for feeling better and staying that way.";
    if (/legal|law|contract|attorney/.test(n)) return "Clear advice that protects your interests without the confusion.";
    if (/childcar|daycar|babysit|nanny/.test(n)) return "Safe, nurturing care you can feel good about every day.";
    if (/pest|exterminate|rodent|bug/.test(n)) return "Effective treatment with minimal disruption to your home or business.";
    if (/paint|coat|finish|stain/.test(n)) return "Clean lines and lasting results that make a visible difference.";
    if (/move|relocat|haul|junk/.test(n)) return "Efficient, careful service that takes the stress out of moving.";
    if (/print|sign|banner|wrap/.test(n)) return "Sharp, attention-grabbing materials that represent your brand.";
    if (/insur|protect|coverage|policy/.test(n)) return "Simple, straightforward coverage that fits your life.";
    if (/real estate|property|rent|lease|home buy/.test(n)) return "Honest guidance through one of the biggest decisions you'll make.";
    return "Delivered with care and consistent attention to quality.";
  };

  // --- Homepage sections by type ---
  const getSections = (): string[] => {
    if (isMenuContext) return ["Hero", "Menu Highlights", "About", "Book or Order", "Contact"];
    switch (orgType) {
      case "nonprofit": return ["Hero", "Our Mission", "Programs & Services", "Impact Stories", "Get Involved", "Contact"];
      case "product shop": return ["Hero", "Featured Products", "Why Choose Us", "Testimonials", "Newsletter Signup", "Contact"];
      case "personal brand": return ["Hero", "About Me", "Services", "Portfolio / Work", "Testimonials", "Contact"];
      case "local service business": return ["Hero", "Services", "Why Choose Us", "Service Area", "Customer Reviews", "Contact"];
      case "community project": return ["Hero", "About the Project", "How to Get Involved", "Events", "Team", "Contact"];
      default: return ["Hero", "About", "Services", "Testimonials", "Call to Action", "Contact"];
    }
  };
  const sectionsList = getSections();

  // --- Hero headline: benefit-focused, audience used for context only ---
  const getHeadline = (): string => {
    if (isMenuContext) {
      return coreService
        ? `${bizName} — ${coreService} Worth Coming Back For`
        : `${bizName} — Good Food, Done Right`;
    }
    switch (orgType) {
      case "nonprofit":
        return cleanGoal
          ? `${bizName} — ${cleanGoal.charAt(0).toUpperCase() + cleanGoal.slice(1)}`
          : `${bizName} — Making a Difference`;
      case "local service business":
        if (coreService && location) return `${bizName} — Reliable ${coreService} in ${location}`;
        if (coreService) return `${bizName} — ${coreService} Done Right`;
        return `${bizName} — Dependable Service You Can Count On`;
      case "personal brand":
        return cleanGoal
          ? `${bizName} — ${cleanGoal.charAt(0).toUpperCase() + cleanGoal.slice(1)}`
          : `${bizName} — Helping You Move Forward`;
      case "product shop":
        return coreService
          ? `${bizName} — ${coreService} Built to Last`
          : `${bizName} — Quality Products, Simple Process`;
      case "community project":
        return location
          ? `${bizName} — Rooted in ${location}`
          : `${bizName} — Stronger Together`;
      default:
        return coreService
          ? `${bizName} — Professional ${coreService} That Delivers`
          : `${bizName} — Built to Serve`;
    }
  };

  // --- Hero subheadline: explains what they do, no raw audience paste ---
  const getSubheadline = (): string => {
    if (isMenuContext) {
      return `Fresh, made-to-order food for events, gatherings, and everyday cravings. ${ctaUpper} today.`;
    }
    // Build a natural "what we do" sentence from services + goal
    const offeringPhrase = servicesList.length >= 2
      ? `${servicesList[0]} and ${servicesList[1].toLowerCase()}`
      : coreService
        ? coreService.toLowerCase()
        : "quality service";
    const locationPhrase = location ? ` in the ${location} area` : "";

    const byTone: Record<string, string> = {
      professional: `Providing ${offeringPhrase}${locationPhrase} with professionalism and reliability. ${ctaUpper} today.`,
      bold: `${offeringPhrase.charAt(0).toUpperCase() + offeringPhrase.slice(1)}${locationPhrase} — done with no compromise. ${ctaUpper} now.`,
      elegant: `Refined ${offeringPhrase}${locationPhrase}, delivered with care and precision. ${ctaUpper}.`,
      warm: `We specialize in ${offeringPhrase}${locationPhrase} and treat every client like a neighbor. ${ctaUpper} whenever you're ready.`,
      playful: `We do ${offeringPhrase}${locationPhrase} — and we actually love doing it. ${ctaUpper}!`,
      "faith-based": `Offering ${offeringPhrase}${locationPhrase} with integrity and a heart for service. ${ctaUpper}.`,
      "community-focused": `${offeringPhrase.charAt(0).toUpperCase() + offeringPhrase.slice(1)}${locationPhrase}, built around the people we serve. ${ctaUpper}.`,
    };
    return byTone[toneDisplay] ?? `Professional ${offeringPhrase}${locationPhrase}. ${ctaUpper} today.`;
  };

  const headline = getHeadline();
  const subheadline = getSubheadline();

  // --- About section: human tone, service-grounded, goal-specific ---
  const getAbout = (): string => {
    const offeringList = servicesList.length > 0
      ? servicesList.slice(0, 3).join(", ").toLowerCase()
      : "quality services";
    const goalSentence = cleanGoal ? ` We started ${bizName} with one goal in mind: ${cleanGoal}.` : "";

    const byTone: Record<string, string> = {
      professional:
        `${bizName} is a ${orgType || "business"} specializing in ${offeringList}.${goalSentence} We take pride in doing the work right and standing behind everything we deliver.`,
      bold:
        `${bizName} is built on one standard: no shortcuts.${goalSentence} We offer ${offeringList} because we believe people deserve work that actually holds up.`,
      elegant:
        `${bizName} brings together ${offeringList} under one roof — with the kind of attention to detail that makes a real difference.${goalSentence}`,
      warm:
        `${bizName} was started because we saw a real need — and we knew we could help.${goalSentence} We specialize in ${offeringList} and treat every client the way we'd want to be treated ourselves.`,
      playful:
        `We're ${bizName}, and we genuinely love what we do.${goalSentence} Whether it's ${offeringList}, we show up ready and make sure you leave happy.`,
      "faith-based":
        `${bizName} was founded on faith and a calling to serve.${goalSentence} We provide ${offeringList} with honesty, compassion, and a commitment to doing what's right.`,
      "community-focused":
        `${bizName} is part of this community — not just a business in it.${goalSentence} We offer ${offeringList} because we believe local matters and people deserve reliable help close to home.`,
    };
    return byTone[toneDisplay] ?? `${bizName} provides ${offeringList} with a focus on quality and dependability.${goalSentence}`;
  };

  // --- Services section: each item gets a one-line description ---
  const getServicesDraft = (): string => {
    if (servicesList.length === 0) {
      return "Add your services, programs, or products in the form above — they'll appear here.";
    }
    if (isMenuContext) {
      const intro = `Here's a look at what ${bizName} brings to the table:`;
      return `${intro}\n\n${servicesList.map(s => `• ${s}`).join("\n")}`;
    }
    const introByType: Record<string, string> = {
      nonprofit: "Our programs are designed to create lasting change:",
      "personal brand": "Here's how I can help you:",
      "product shop": "Our products are built with you in mind:",
      "local service business": "We handle it all — here's what we do:",
      "community project": "Get involved and make a difference:",
    };
    const intro = introByType[orgType] ?? `Here's what ${bizName} offers:`;
    const items = servicesList
      .map(s => `• ${s}\n  ${describeService(s)}`)
      .join("\n\n");
    return `${intro}\n\n${items}`;
  };

  // --- CTA section ---
  const getCtaDraft = (): string => {
    const locationNote = location ? ` in ${location}` : "";
    const byCtaKey: Record<string, string> = {
      "book a call": `Ready to talk? Schedule a call and we'll figure out exactly what you need — no pressure, no runaround.`,
      "book catering": `Planning an event${locationNote}? Let ${bizName} handle the food. Fill out a request and we'll take it from there.`,
      "request a quote": `Every job is different. Tell us about yours and we'll get you a straight answer and a fair quote.`,
      "view menu": `Take a look at what ${bizName} is serving — fresh options, consistent quality, and something for everyone.`,
      "donate": `Your contribution goes directly toward ${cleanGoal || "the work that matters most"}. Every dollar makes a difference.`,
      "contact us": `Have a question? We're easy to reach and happy to help. Send us a message and we'll get back to you promptly.`,
      "shop now": `Browse our full selection and find what you're looking for — straightforward, no-nonsense shopping.`,
      "learn more": `Want to know more about ${bizName} and what we do? Take a look around — we think you'll find it worth your time.`,
    };
    return byCtaKey[cta] ?? `${bizName} is ready to help. Reach out and let's get started.`;
  };

  const contactDraft = [
    email ? `Email: ${email}` : null,
    phone ? `Phone: ${phone}` : null,
  ].filter(Boolean).join("\n") || "Email: hello@example.com\nPhone: (555) 123-4567";

  // --- Replit Agent Prompt: structured and immediately usable ---
  const promptDraft = `Build a clean, fully responsive multi-page website for the following client. Use only pure HTML5 and CSS3 — no JavaScript frameworks, no CSS frameworks, no external libraries except Google Fonts.

## Client
- Business Name: ${bizName}
- Type: ${orgType || "local service business"}
- Brand Tone: ${toneDisplay}
- Primary Goal: ${goalDisplay}
- Target Audience: ${audienceDisplay}

## Pages
${navItems.map(p => `- ${p}`).join("\n")}

## ${isMenuContext ? "Menu / Food Offerings" : "Services / Offerings"}
${servicesList.length > 0 ? servicesList.map(s => `- ${s}`).join("\n") : "- [Add services or products here]"}

## Copy to Use
- Hero Headline: ${headline}
- Hero Subheadline: ${subheadline}
- CTA Button Label: ${ctaUpper}
- About: ${getAbout()}

## Contact
- Email: ${email || "hello@example.com"}
- Phone: ${phone || "(555) 123-4567"}

## Technical Requirements
- Semantic HTML5: use header, nav, main, section, footer
- Sticky navigation with a working hamburger menu for mobile (toggle with JavaScript)
- Fully responsive using CSS Flexbox and Grid — no horizontal scroll on any screen size
- CSS custom properties (variables) for all colors and fonts
- Google Fonts selected to match the "${toneDisplay}" tone
- All sections in one scrollable page: Hero, About, ${isMenuContext ? "Menu Highlights" : "Services"}, CTA, Footer/Contact
- Smooth scroll behavior
- Sections accessible via nav anchor links
- Footer with contact info and copyright`;

  // --- Tone-aware font selection ---
  const fontByTone: Record<string, { query: string; family: string }> = {
    professional: { query: "Inter:wght@400;500;700", family: "'Inter', sans-serif" },
    bold: { query: "Oswald:wght@500;700&family=Open+Sans:wght@400;600", family: "'Oswald', sans-serif" },
    elegant: { query: "Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lato:wght@300;400", family: "'Playfair Display', serif" },
    warm: { query: "Lato:wght@300;400;700&family=Merriweather:wght@300;400", family: "'Lato', sans-serif" },
    playful: { query: "Nunito:wght@400;600;800", family: "'Nunito', sans-serif" },
    "faith-based": { query: "Merriweather:wght@300;400;700&family=Lato:wght@400;700", family: "'Merriweather', serif" },
    "community-focused": { query: "Nunito:wght@400;600;800", family: "'Nunito', sans-serif" },
  };
  const font = fontByTone[toneDisplay] ?? fontByTone.professional;

  // --- Tone-aware color palette ---
  const colorByTone: Record<string, { primary: string; hover: string; bg: string; text: string; muted: string; darkBg: boolean }> = {
    professional: { primary: "#2563eb", hover: "#1d4ed8", bg: "#f8fafc", text: "#0f172a", muted: "#475569", darkBg: false },
    bold:         { primary: "#dc2626", hover: "#b91c1c", bg: "#0f172a", text: "#f8fafc", muted: "#94a3b8", darkBg: true },
    elegant:      { primary: "#1e1b4b", hover: "#312e81", bg: "#faf9f7", text: "#1e1b4b", muted: "#6b7280", darkBg: false },
    warm:         { primary: "#c2410c", hover: "#9a3412", bg: "#fffbf0", text: "#1c1917", muted: "#78716c", darkBg: false },
    playful:      { primary: "#7c3aed", hover: "#6d28d9", bg: "#faf5ff", text: "#1e1b4b", muted: "#6b7280", darkBg: false },
    "faith-based":       { primary: "#1d4ed8", hover: "#1e40af", bg: "#f0f9ff", text: "#0c1445", muted: "#4b5563", darkBg: false },
    "community-focused": { primary: "#059669", hover: "#047857", bg: "#f0fdf4", text: "#052e16", muted: "#4b5563", darkBg: false },
  };
  const c = colorByTone[toneDisplay] ?? colorByTone.professional;
  const headerBg = c.darkBg ? "#1e293b" : "#ffffff";
  const navLinkColor = c.darkBg ? "#e2e8f0" : c.muted;

  // --- Starter HTML ---
  const htmlDraft = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bizName}</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${font.query}&display=swap" rel="stylesheet">
</head>
<body>

    <header>
        <nav class="container nav-inner">
            <div class="logo">${bizName}</div>
            <button class="nav-toggle" aria-label="Toggle menu">&#9776;</button>
            <ul class="nav-links" id="nav-links">
                ${navItems.map(item => `<li><a href="#${item.toLowerCase().replace(/\s+/g, "-")}">${item}</a></li>`).join("\n                ")}
            </ul>
        </nav>
    </header>

    <main>

        <section class="hero" id="home">
            <div class="container">
                <h1>${headline}</h1>
                <p class="hero-sub">${subheadline}</p>
                <a href="#contact" class="btn btn-primary">${ctaUpper}</a>
            </div>
        </section>

        <section class="about" id="about">
            <div class="container">
                <h2>About Us</h2>
                <p>${getAbout()}</p>
            </div>
        </section>

        <section class="services" id="${isMenuContext ? "menu" : "services"}">
            <div class="container">
                <h2>${servicesSectionTitle}</h2>
                <div class="service-grid">
                    ${servicesList.length > 0
                      ? servicesList.map(s => `<div class="service-card"><h3>${s}</h3></div>`).join("\n                    ")
                      : `<div class="service-card"><h3>[Service 1]</h3></div>
                    <div class="service-card"><h3>[Service 2]</h3></div>`}
                </div>
            </div>
        </section>

        <section class="cta-section" id="cta">
            <div class="container">
                <h2>${getCtaDraft()}</h2>
                <a href="#contact" class="btn btn-light">${ctaUpper}</a>
            </div>
        </section>

    </main>

    <footer id="contact">
        <div class="container">
            <h2>Contact</h2>
            ${email ? `<p>Email: <a href="mailto:${email}">${email}</a></p>` : ""}
            ${phone ? `<p>Phone: <a href="tel:${phone}">${phone}</a></p>` : ""}
            <p class="copyright">&copy; ${new Date().getFullYear()} ${bizName}. All rights reserved.</p>
        </div>
    </footer>

    <script>
        const toggle = document.querySelector('.nav-toggle');
        const links = document.getElementById('nav-links');
        toggle.addEventListener('click', () => links.classList.toggle('open'));
    </script>

</body>
</html>`;

  // --- Starter CSS (tone-aware) ---
  const cssDraft = `:root {
    --primary: ${c.primary};
    --primary-hover: ${c.hover};
    --bg: ${c.bg};
    --text: ${c.text};
    --muted: ${c.muted};
    --card-bg: #ffffff;
    --font: ${font.family};
}

*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html { scroll-behavior: smooth; }

body {
    font-family: var(--font);
    background-color: var(--bg);
    color: var(--text);
    line-height: 1.7;
}

.container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 1.5rem;
}

/* ── Navigation ── */

header {
    background: ${headerBg};
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    position: sticky;
    top: 0;
    z-index: 100;
}

.nav-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 72px;
}

.logo {
    font-weight: 800;
    font-size: 1.4rem;
    color: var(--primary);
    text-decoration: none;
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-links a {
    text-decoration: none;
    color: ${navLinkColor};
    font-weight: 600;
    font-size: 0.95rem;
    transition: color 0.2s;
}

.nav-links a:hover { color: var(--primary); }

.nav-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--primary);
}

/* ── Hero ── */

.hero {
    padding: 7rem 0;
    text-align: center;
    background: ${c.darkBg ? "#1e293b" : "var(--card-bg)"};
}

.hero h1 {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 1.25rem;
    color: ${c.darkBg ? "#f8fafc" : "var(--text)"};
}

.hero-sub {
    font-size: 1.15rem;
    color: ${c.darkBg ? "#94a3b8" : "var(--muted)"};
    max-width: 600px;
    margin: 0 auto 2.5rem;
}

/* ── Buttons ── */

.btn {
    display: inline-block;
    padding: 0.9rem 2rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 700;
    font-size: 1rem;
    transition: background-color 0.2s, transform 0.1s;
    cursor: pointer;
    border: none;
}

.btn:active { transform: scale(0.98); }

.btn-primary {
    background-color: var(--primary);
    color: white;
}

.btn-primary:hover { background-color: var(--primary-hover); }

.btn-light {
    background-color: white;
    color: var(--primary);
}

.btn-light:hover { background-color: #f1f5f9; }

/* ── Sections ── */

section { padding: 5.5rem 0; }

h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    margin-bottom: 1.5rem;
    text-align: center;
}

/* ── About ── */

.about { text-align: center; }

.about p {
    font-size: 1.1rem;
    color: var(--muted);
    max-width: 700px;
    margin: 0 auto;
}

/* ── Services / Menu ── */

.service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
}

.service-card {
    background: var(--card-bg);
    border: 1px solid #e2e8f0;
    padding: 2rem;
    border-radius: 0.75rem;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.service-card h3 {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
}

/* ── CTA Section ── */

.cta-section {
    background: var(--primary);
    color: white;
    text-align: center;
    padding: 5.5rem 0;
}

.cta-section h2 {
    color: white;
    max-width: 680px;
    margin: 0 auto 2rem;
}

/* ── Footer ── */

footer {
    background: #1e293b;
    color: white;
    text-align: center;
    padding: 4rem 0;
}

footer h2 { color: white; margin-bottom: 1.5rem; }

footer p { color: #94a3b8; margin-bottom: 0.5rem; }

footer a { color: #e2e8f0; text-decoration: none; }

footer a:hover { color: white; }

.copyright { margin-top: 2rem; font-size: 0.85rem; }

/* ── Responsive ── */

@media (max-width: 768px) {
    .nav-toggle { display: block; }

    .nav-links {
        display: none;
        flex-direction: column;
        gap: 0;
        position: absolute;
        top: 72px;
        left: 0;
        right: 0;
        background: ${headerBg};
        border-top: 1px solid #e2e8f0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .nav-links.open { display: flex; }

    .nav-links li a {
        display: block;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #f1f5f9;
    }

    .hero { padding: 4.5rem 0; }

    section { padding: 3.5rem 0; }

    .service-grid { grid-template-columns: 1fr; }
}`;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-8 pb-8 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold">Plan Generated</h1>
            <p className="text-muted-foreground mt-1">Review, copy, and build.</p>
          </div>
          <Button variant="outline" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OutputCard title="1. Suggested Navigation" content={navString} onCopy={onCopy} />
          <OutputCard title="2. Homepage Section Plan" content={sectionsList.map((s, i) => `${i + 1}. ${s}`).join("\n")} onCopy={onCopy} />
          <OutputCard title="3. Hero Copy" content={`Headline: ${headline}\n\nSubheadline: ${subheadline}`} onCopy={onCopy} />
          <OutputCard title="4. About Section Draft" content={getAbout()} onCopy={onCopy} />
          <OutputCard title={`5. ${servicesSectionTitle} Draft`} content={getServicesDraft()} onCopy={onCopy} />
          <OutputCard title="6. Call-to-Action Section" content={getCtaDraft()} onCopy={onCopy} />
          <OutputCard title="7. Contact Section" content={contactDraft} onCopy={onCopy} className="md:col-span-2" />
        </div>

        <CodeCard title="8. Copyable Replit Agent Prompt" code={promptDraft} onCopy={onCopy} />
        <CodeCard title="9. Copyable Starter HTML" code={htmlDraft} onCopy={onCopy} language="html" />
        <CodeCard title="10. Copyable Starter CSS" code={cssDraft} onCopy={onCopy} language="css" />
      </div>
    </div>
  );
}

function OutputCard({ title, content, onCopy, className = "" }: { title: string; content: string; onCopy: (text: string, title: string) => void; className?: string }) {
  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="pb-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onCopy(content, title)}>
            <Copy className="w-3 h-3 mr-1" /> Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">{content}</pre>
      </CardContent>
    </Card>
  );
}

function CodeCard({ title, code, onCopy, language = "text" }: { title: string; code: string; onCopy: (text: string, title: string) => void; language?: string }) {
  return (
    <Card className="shadow-sm border-border overflow-hidden">
      <CardHeader className="pb-3 border-b border-border bg-muted/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="secondary" size="sm" onClick={() => onCopy(code, title)}>
            <Copy className="w-4 h-4 mr-2" /> Copy Full {language.toUpperCase()}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="bg-zinc-950 p-4 max-h-[400px] overflow-y-auto">
          <pre className="text-zinc-50 font-mono text-sm whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
