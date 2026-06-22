import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ArrowLeft, Loader2, Frame, Save, RotateCcw, CheckCircle2, AlertCircle, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type FormData, type ExtractedIntent, splitList, formDataToIntent } from "@/lib/intent";

interface ValidationErrors {
  businessName?: string;
  orgType?: string;
  goal?: string;
  audience?: string;
}

const AUTOSAVE_KEY = "launchframe-autosave";
const DRAFT_KEY = "launchframe-draft";
const AUTOSAVE_TTL_MS = 8 * 60 * 60 * 1000;

const emptyData: FormData = {
  projectName: "",
  businessName: "",
  founderName: "",
  orgType: "",
  goal: "",
  audience: "",
  services: "",
  pages: "",
  tone: "",
  email: "",
  phone: "",
  cta: "",
  techStack: "",
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

function readAutosave(): FormData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.savedAt === "number") {
      if (Date.now() - parsed.savedAt > AUTOSAVE_TTL_MS) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return null;
      }
      return parsed.data as FormData;
    }
    localStorage.removeItem(AUTOSAVE_KEY);
    return null;
  } catch {
    return null;
  }
}

function writeAutosave(data: FormData): void {
  try {
    const { email, phone, ...safe } = data; // eslint-disable-line @typescript-eslint/no-unused-vars
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ data: safe, savedAt: Date.now() }));
  } catch { /* ignore */ }
}

function hasDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

function validate(data: FormData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.businessName.trim()) errors.businessName = "Business / Organization Name is required.";
  if (!data.orgType) errors.orgType = "Organization Type is required.";
  if (!data.goal.trim()) errors.goal = "Primary Website Goal is required.";
  if (!data.audience.trim()) errors.audience = "Target Audience is required.";
  return errors;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export default function Home() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(() => {
    const saved = readAutosave();
    if (!saved) return emptyData;
    return {
      ...emptyData,
      ...saved,
      techStack: saved.techStack ?? "",
      founderName: saved.founderName ?? "",
      // email/phone excluded from autosave — always start blank
      email: "",
      phone: "",
    };
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOutputMode, setIsOutputMode] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [draftExists, setDraftExists] = useState<boolean>(hasDraft);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [intent, setIntent] = useState<ExtractedIntent | null>(null);
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
      writeAutosave(formData);
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
    // Clear the validation error for this field as the user types
    if (name in validationErrors) {
      setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSelectChange = (name: keyof FormData) => (value: string) => {
    if (name === "orgType" && value !== formData.orgType) {
      setFormData((prev) => ({ ...prev, orgType: value, services: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (name in validationErrors) {
      setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
    }
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

  const getDraftLabel = (): string => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return "No draft saved";
      const d = JSON.parse(raw) as Partial<FormData>;
      return d.businessName ? `Draft: ${d.businessName}` : "Draft available";
    } catch { return "Draft available"; }
  };

  const handleRestoreDraft = () => {
    const draft = readStorage(DRAFT_KEY);
    if (draft) {
      setFormData({ ...emptyData, ...draft, techStack: draft.techStack ?? "", founderName: draft.founderName ?? "" });
      setValidationErrors({});
      toast({ title: "Draft restored", description: "Your saved draft has been loaded.", duration: 2000 });
    } else {
      toast({ title: "No draft found", description: "Save a draft first.", duration: 2000 });
    }
  };

  const handleNewProject = () => {
    setShowClearConfirm(true);
  };

  const handleNewProjectConfirmed = () => {
    setFormData(emptyData);
    setValidationErrors({});
    setShowClearConfirm(false);
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
  };

  const handleGenerate = () => {
    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstErrorField = Object.keys(errors)[0];
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIntent(formDataToIntent(formData));
      setIsOutputMode(true);
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
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

  if (isOutputMode && intent) {
    return <OutputView intent={intent} onBack={handleBackToForm} onCopy={handleCopy} />;
  }

  const hasErrors = !!(
    validationErrors.businessName ||
    validationErrors.orgType ||
    validationErrors.goal ||
    validationErrors.audience
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-4">
            <Frame className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">LaunchFrame</h1>
          <p className="mt-3 text-lg text-muted-foreground">Turn project details into a copy-ready build prompt for any AI coding agent.</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Project Intake</CardTitle>
                <CardDescription>Fill out the project details to generate your build prompt.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewProject}
                className="shrink-0 text-muted-foreground"
                data-testid="button-new-project"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                New Project
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {showClearConfirm && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-3">
                  Start a new project? Your current form data will be cleared.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleNewProjectConfirmed} data-testid="button-confirm-clear">
                    Yes, clear the form
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowClearConfirm(false)} data-testid="button-cancel-clear">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                placeholder="e.g. Smith Plumbing Website Refresh (optional)"
                data-testid="input-project-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">
                Business / Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="e.g. Acme Corp"
                data-testid="input-business-name"
                className={validationErrors.businessName ? "border-destructive" : ""}
              />
              {validationErrors.businessName && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {validationErrors.businessName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgType">
                Organization Type <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.orgType} onValueChange={handleSelectChange("orgType")}>
                <SelectTrigger
                  id="orgType"
                  data-testid="select-org-type"
                  className={validationErrors.orgType ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local service business">Local Service Business</SelectItem>
                  <SelectItem value="software/app startup">Software / App Startup</SelectItem>
                  <SelectItem value="agency/consultancy">Agency / Consultancy</SelectItem>
                  <SelectItem value="restaurant/food">Restaurant / Food Business</SelectItem>
                  <SelectItem value="nonprofit">Nonprofit</SelectItem>
                  <SelectItem value="church/faith organization">Church / Faith Organization</SelectItem>
                  <SelectItem value="personal brand">Personal Brand</SelectItem>
                  <SelectItem value="product shop">Product Shop</SelectItem>
                  <SelectItem value="community project">Community Project</SelectItem>
                </SelectContent>
              </Select>
              {validationErrors.orgType && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {validationErrors.orgType}
                </p>
              )}
            </div>

            {formData.orgType === "personal brand" && (
              <div className="space-y-2">
                <Label htmlFor="founderName">Your Name</Label>
                <Input
                  id="founderName"
                  name="founderName"
                  value={formData.founderName}
                  onChange={handleInputChange}
                  placeholder="e.g. Marcus Piper"
                  data-testid="input-founder-name"
                />
                <p className="text-xs text-muted-foreground">Used in first-person copy (About, subheadline). Leave blank to use your business name.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="goal">
                Primary Website Goal <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="goal"
                name="goal"
                value={formData.goal}
                onChange={handleInputChange}
                placeholder="e.g. Get more leads for our consulting services."
                data-testid="textarea-goal"
                className={`resize-none ${validationErrors.goal ? "border-destructive" : ""}`}
              />
              <p className="text-xs text-muted-foreground">What do you want visitors to do or feel after seeing this site? Be specific.</p>
              {validationErrors.goal && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {validationErrors.goal}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">
                Target Audience <span className="text-destructive">*</span>
              </Label>
              <Input
                id="audience"
                name="audience"
                value={formData.audience}
                onChange={handleInputChange}
                placeholder="e.g. Small business owners in Dallas looking for accounting help"
                data-testid="input-audience"
                className={validationErrors.audience ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Be specific — who exactly is this for? The more detail, the better the copy.</p>
              {validationErrors.audience && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {validationErrors.audience}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="services">
                {formData.orgType === "software/app startup"
                  ? "Key Features / Modules"
                  : formData.orgType === "agency/consultancy"
                  ? "Services Offered"
                  : formData.orgType === "nonprofit" || formData.orgType === "church/faith organization"
                  ? "Programs / Ministries / Services"
                  : formData.orgType === "restaurant/food"
                  ? "Menu Items / Offerings"
                  : "Services, Programs, or Products"}
              </Label>
              <Textarea
                id="services"
                name="services"
                value={formData.services}
                onChange={handleInputChange}
                placeholder={
                  formData.orgType === "software/app startup"
                    ? "e.g. User Dashboard, Analytics, API Access, Team Collaboration"
                    : formData.orgType === "agency/consultancy"
                    ? "e.g. Brand Strategy, Web Design, SEO, Content Marketing"
                    : formData.orgType === "nonprofit"
                    ? "e.g. Youth Mentorship, Job Training, Emergency Housing"
                    : "e.g. Tax Consulting, Bookkeeping, Payroll"
                }
                data-testid="textarea-services"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Separate each item with a comma.</p>
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
                    <SelectItem value="start free trial">Start Free Trial</SelectItem>
                    <SelectItem value="request a demo">Request a Demo</SelectItem>
                    <SelectItem value="book catering">Book Catering</SelectItem>
                    <SelectItem value="request a quote">Request a Quote</SelectItem>
                    <SelectItem value="view menu">View Menu</SelectItem>
                    <SelectItem value="donate">Donate</SelectItem>
                    <SelectItem value="contact us">Contact Us</SelectItem>
                    <SelectItem value="shop now">Shop Now</SelectItem>
                    <SelectItem value="learn more">Learn More</SelectItem>
                    <SelectItem value="get involved">Get Involved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="techStack">Preferred Build Type / Technology Stack</Label>
              <Select value={formData.techStack} onValueChange={handleSelectChange("techStack")}>
                <SelectTrigger id="techStack" data-testid="select-tech-stack">
                  <SelectValue placeholder="Select stack..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html-css">Simple HTML / CSS</SelectItem>
                  <SelectItem value="html-css-js">HTML / CSS / JavaScript</SelectItem>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="nextjs">Next.js</SelectItem>
                  <SelectItem value="replit-fullstack">Full-Stack Web App</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Guides the generated build prompt and starter code.</p>
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

            {hasErrors && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Please fill in the required fields before generating.
                </p>
              </div>
            )}

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
                  {draftExists ? getDraftLabel() : "No draft saved"}
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
                    Generating Build Prompt...
                  </>
                ) : (
                  "Generate Build Prompt"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Output View
// ---------------------------------------------------------------------------

function OutputView({
  intent,
  onBack,
  onCopy,
}: {
  intent: ExtractedIntent;
  onBack: () => void;
  onCopy: (text: string, title: string) => void;
}) {
  const {
    projectName,
    businessName,
    founderName,
    organizationType: orgType,
    primaryGoal: goal,
    audience,
    tone,
    callToAction: cta,
    technologyStack: techStack,
    contactEmail: email,
    contactPhone: phone,
    notes,
  } = intent;

  const bizName = businessName || "Your Business";
  const founderDisplay = founderName.trim() || bizName;
  const goalDisplay = goal || "build a strong online presence";
  const audienceDisplay = audience || "your community";
  const toneDisplay = tone || "professional";
  const ctaLabel = cta || "get in touch";
  const ctaUpper = cap(ctaLabel);

  // --- Proper noun capitalization helper ---
  const properNounMap: Record<string, string> = {
    linkedin: "LinkedIn", youtube: "YouTube", instagram: "Instagram",
    facebook: "Facebook", google: "Google", tiktok: "TikTok",
    wordpress: "WordPress", shopify: "Shopify", quickbooks: "QuickBooks",
    mailchimp: "Mailchimp", hubspot: "HubSpot",
  };
  const fixProperNouns = (s: string): string => {
    let result = s;
    for (const [key, val] of Object.entries(properNounMap)) {
      result = result.replace(new RegExp(`\\b${key}\\b`, "gi"), val);
    }
    return result;
  };

  // --- Navigation ---
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
  const reservedNav = new Set(["home", "contact"]);
  const rawPages = intent.pages;
  const filteredPages = rawPages.filter(p => !reservedNav.has(norm(p)));

  const getDefaultNavItems = (): string[] => {
    switch (orgType) {
      case "software/app startup":       return ["Home", "Features", "How It Works", "Pricing", "Testimonials", "Contact"];
      case "agency/consultancy":         return ["Home", "Services", "Our Process", "Work", "Testimonials", "Contact"];
      case "nonprofit":                  return ["Home", "About", "Programs", "Get Involved", "Donate", "Contact"];
      case "church/faith organization":  return ["Home", "Ministries", "Events", "About", "Give", "Contact"];
      case "personal brand":             return ["Home", "About", "Services", "Portfolio", "Testimonials", "Contact"];
      case "local service business":     return ["Home", "Services", "Why Choose Us", "Reviews", "Contact"];
      case "product shop":               return ["Home", "Shop", "Why Choose Us", "Testimonials", "Contact"];
      case "community project":          return ["Home", "About", "Get Involved", "Events", "Team", "Contact"];
      case "restaurant/food":            return ["Home", "Menu", "About", "Order", "Contact"];
      default:                           return ["Home", "About", "Services", "Contact"];
    }
  };

  const navItems = filteredPages.length > 0 ? ["Home", ...filteredPages, "Contact"] : getDefaultNavItems();
  const navString = navItems.join(" • ");

  const servicesList = intent.services;
  const servicesText = servicesList.join(", ");

  // --- Food/menu context: ONLY true for restaurant/food org type, or when org type is unspecified ---
  // This prevents food template bleed into SaaS, nonprofit, agency, etc.
  const isRestaurantType = orgType === "restaurant/food";
  const isSaasType = orgType === "software/app startup";
  const isAgencyType = orgType === "agency/consultancy";
  const isNonprofitType = orgType === "nonprofit";
  const isChurchType = orgType === "church/faith organization";
  const isPersonalBrand = orgType === "personal brand";

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

  // Food context is TRUE only when org type is restaurant/food, or when no org type is set AND food keywords appear
  const isMenuContext = isRestaurantType || (!orgType && (checkFood(servicesText) || checkFood(goal) || checkFood(businessName)));

  // --- Section title ---
  const servicesSectionTitle =
    isMenuContext ? "Menu Highlights"
    : isSaasType ? "Features"
    : isAgencyType ? "Our Services"
    : isNonprofitType ? "Our Programs"
    : isChurchType ? "Ministries & Programs"
    : isPersonalBrand ? "What I Offer"
    : "What We Offer";

  // --- Derived copy helpers ---
  const cleanGoal = goalDisplay.replace(/^to\s+/i, "").replace(/\.$/, "").toLowerCase();
  const coreService = servicesList.length > 0 ? servicesList[0] : null;
  const allServicesText = servicesList.join(" ").toLowerCase();

  const extractLocation = (text: string): string | null => {
    const m = text.match(/\bin\s+(?:the\s+)?([A-Z][a-zA-Z\s\-]+?)(?:\s+(?:area|region|community|metro)|[,.]|$)/);
    return m ? m[1].trim() : null;
  };
  const location = extractLocation(audience);

  // --- Service theme detection (only applies when org type isn't already specific) ---
  const getServiceTheme = (): string => {
    // Org-type-level shortcuts that bypass keyword matching
    if (isSaasType) return "saas";
    if (isAgencyType) return "agency";
    if (isNonprofitType) return "nonprofit";
    if (isChurchType) return "church";
    if (isRestaurantType) return "food";

    const t = allServicesText;
    if (/media.?box|tv.?box|set.?top|iptv|streaming.?box|kodi|firestick|roku|apple.?tv|entertainment.?box/.test(t)) return "home-entertainment";
    if (/wi.?fi|wifi|wireless|network|internet|router|hotspot/.test(t) && /setup|connect|install|config|support/.test(t)) return "tech-support";
    if (/remote|walkthrough|troubleshoot|device.?support|tech.?help|customer.?support/.test(t)) return "tech-support";
    if (/lawn|mow|landscap|yard|grass|tree|hedge|mulch|sod/.test(t)) return "lawn-care";
    if (/clean|sanitiz|janitorial|housekeep|maid|pressure.?wash/.test(t)) return "cleaning";
    if (/plumb|pipe|drain|leak|faucet|toilet|sewer/.test(t)) return "plumbing";
    if (/electric|wiring|panel|outlet|circuit|generator/.test(t)) return "electrical";
    if (/web|website|seo|digital.?market|social.?media|ppc|ads/.test(t)) return "digital-marketing";
    if (/hair|nail|salon|spa|massage|beauty|wax|lash|brow/.test(t)) return "beauty";
    if (/book|account|payroll|tax|financ|audit|cpa|quickbook/.test(t)) return "accounting";
    if (/coach|consult|strateg|advise|mentor|business.?plan/.test(t)) return "consulting";
    if (/photo|video|film|edit|shoot|reel|headshot/.test(t)) return "photography";
    if (/design|brand|logo|graphic|illustrat|print/.test(t)) return "design";
    if (/tutor|teach|train|educat|lesson|homework|sat|act/.test(t)) return "tutoring";
    if (/move|relocat|haul|junk|pack|storage/.test(t)) return "moving";
    if (/pest|exterminate|rodent|bug|termite|mosquito/.test(t)) return "pest-control";
    if (/paint|coat|finish|stain|drywall|prime/.test(t)) return "painting";
    if (/handyman|repair|fix|install|maintain|assemble/.test(t)) return "handyman";
    if (/childcar|daycar|babysit|nanny|preschool|afterschool/.test(t)) return "childcare";
    if (/health|fitness|gym|nutrit|wellness|yoga|personal.?train|pilates/.test(t)) return "wellness";
    if (/legal|law|contract|attorney|notary|estate.?plan/.test(t)) return "legal";
    if (/event|wedding|party|celebrat|decor|cater/.test(t) && !isNonprofitType) return "events";
    if (/real.?estate|property|rent|lease|home.?buy|realtor/.test(t)) return "real-estate";
    if (/insur|protect|coverage|policy|claim/.test(t)) return "insurance";
    if (/setup|install|config|support|troubleshoot|tech/.test(t)) return "tech-support";
    return "general";
  };
  const serviceTheme = getServiceTheme();

  // --- Benefit headline ---
  const getBenefitHeadline = (): string => {
    const loc = location ? ` in ${location}` : "";
    switch (serviceTheme) {
      case "saas":          return cleanGoal ? `${cap(cleanGoal)}` : "Software That Solves the Real Problem";
      case "agency":        return cleanGoal ? `${cap(cleanGoal)}` : "Strategy, Design, and Execution — Under One Roof";
      case "nonprofit":     return cleanGoal ? `${cap(cleanGoal)}` : "Making a Lasting Difference in Our Community";
      case "church":        return `A Place to Belong${loc ? `, ${loc}` : ""}`;
      case "food":          return `Fresh Food Worth Coming Back For`;
      case "home-entertainment": return "Simple TV Box Setup & Home Entertainment Support";
      case "tech-support":  return "Friendly Tech Help — Setup, Support & Troubleshooting";
      case "lawn-care":     return location ? `Reliable Lawn Care in ${location}` : "A Yard You Can Be Proud Of";
      case "cleaning":      return location ? `Professional Cleaning Services in ${location}` : "A Cleaner Space Without the Hassle";
      case "plumbing":      return "Fast Plumbing Repairs When You Need Them";
      case "electrical":    return "Safe, Professional Electrical Work You Can Trust";
      case "digital-marketing": return "Get Found Online and Bring in the Right Customers";
      case "beauty":        return "Look and Feel Your Best — Every Single Visit";
      case "accounting":    return "Financial Clarity So You Can Run Your Business With Confidence";
      case "consulting":    return "Practical Guidance That Moves Your Business Forward";
      case "photography":   return "Visuals That Tell Your Story the Right Way";
      case "design":        return "Design That Represents You and Attracts the Right People";
      case "tutoring":      return "Build Real Skills and Lasting Confidence";
      case "moving":        return `A Smoother Move${loc} — Start to Finish`;
      case "pest-control":  return "Get Rid of Pests and Keep Them Out for Good";
      case "painting":      return "Fresh Paint, Clean Results — On Time and On Budget";
      case "handyman":      return "Reliable Home Repairs Done Right the First Time";
      case "childcare":     return "Safe, Caring Support for Your Child Every Day";
      case "wellness":      return "Practical Health and Fitness Support That Fits Real Life";
      case "legal":         return "Straightforward Legal Help When You Need It Most";
      case "events":        return "Events That Run Smoothly and Feel Effortless";
      case "real-estate":   return `Buy, Sell, or Rent${loc} With Confidence`;
      case "insurance":     return "The Right Coverage, Explained in Plain Language";
      default:              return location ? `Dependable Service in ${location}` : "Quality Work You Can Count On";
    }
  };

  // --- Describe a single service/feature/program uniquely ---
  // Org-type-aware: each block handles the vocabulary for its category
  const describeService = (name: string): string => {
    const n = name.toLowerCase();

    // SaaS / App features
    if (isSaasType) {
      if (/dashboard|overview|home.?screen/.test(n)) return "A clear, real-time view of your key metrics and activity in one place.";
      if (/analytic|report|insight|stat/.test(n)) return "Dig into usage patterns and trends so you can make decisions backed by data.";
      if (/api|integration|webhook|connect/.test(n)) return "Connect to your existing tools and workflows without rebuilding from scratch.";
      if (/auth|login|sign.?in|user.?account|sso/.test(n)) return "Secure, streamlined authentication that keeps accounts protected without friction.";
      if (/team|collaborat|member|workspace/.test(n)) return "Invite teammates, assign roles, and work together without stepping on each other.";
      if (/notif|alert|reminder/.test(n)) return "Stay in the loop with timely notifications — in-app, email, or push.";
      if (/search|filter|sort/.test(n)) return "Find exactly what you need fast, with flexible search and filtering options.";
      if (/export|download|import|csv/.test(n)) return "Move your data in and out easily — exports in standard formats on demand.";
      if (/billing|subscript|payment|invoice|plan/.test(n)) return "Manage subscriptions, billing cycles, and invoices without leaving the platform.";
      if (/onboard|setup|wizard|getting.?start/.test(n)) return "Guide new users through setup quickly so they hit value before day one ends.";
      if (/mobile|ios|android|app/.test(n)) return "Access the full experience on any device — native iOS and Android apps included.";
      if (/task.?manag|to.?do.?list|task.?track/.test(n)) return "Organize, assign, and track tasks in one place — so nothing falls through the cracks.";
      if (/project.?manag|project.?track/.test(n)) return "Manage projects from kickoff to completion — with full visibility for everyone on the team.";
      if (/time.?track|time.?log|timeshee/.test(n)) return "Log hours accurately and see exactly where time is going — for better billing and smarter planning.";
      if (/schedul|calendar|appointment/.test(n)) return "Schedule meetings, manage availability, and coordinate time without the back-and-forth emails.";
      if (/workflow.?automat|automat.?workflow/.test(n)) return "Build automated workflows that eliminate repetitive manual steps and keep work moving on its own.";
      if (/automat|trigger/.test(n)) return "Automate repetitive tasks so your team can focus on work that actually matters.";
      if (/ai|smart|ml|intelligence|predict/.test(n)) return "Intelligent features that learn from your data and surface what matters most.";
      if (/support|help|ticket|chat|inbox/.test(n)) return "Built-in support tools so your team can respond to users without switching tabs.";
      if (/permiss|role|access|admin/.test(n)) return "Granular permissions let you control exactly who sees and does what.";
      return `A focused feature that handles ${name.toLowerCase()} cleanly, without added complexity.`;
    }

    // Agency / Consultancy services
    if (isAgencyType) {
      if (/brand|identity|logo/.test(n)) return "Build a visual identity that stands for something and is consistent everywhere it appears.";
      if (/strateg|positioning|roadmap/.test(n)) return "Turn ambiguous goals into a clear, actionable plan your team can execute against.";
      if (/web.?design|ui|ux|design/.test(n)) return "Interfaces that look sharp, feel intuitive, and serve the people using them.";
      if (/web.?dev|develop|code|build/.test(n)) return "Custom-built digital products — scoped clearly, delivered on schedule.";
      if (/seo|search.?optim/.test(n)) return "Sustainable organic search growth built on real content and technical precision.";
      if (/paid.?ads|ppc|google.?ads|facebook.?ads/.test(n)) return "Ad campaigns that hit the right audience with the right message at the right time.";
      if (/social.?media|content|copy/.test(n)) return "Consistent, on-brand content that builds an audience and earns engagement.";
      if (/email|campaign|newsletter/.test(n)) return "Email that people actually open — segmented, personalized, and timed well.";
      if (/analytic|data|report|measur/.test(n)) return "Clear reporting that shows what's working, what isn't, and what to do next.";
      if (/consult|advise|audit|assess/.test(n)) return "An outside perspective that cuts through internal assumptions and finds real leverage.";
      if (/photo|video|film|shoot/.test(n)) return "Professional visual production that gives your brand the quality it deserves.";
      if (/pr|public.?relat|media/.test(n)) return "Strategic media coverage that shapes how your brand is perceived in the market.";
      return `Professional ${name.toLowerCase()} services delivered with strategic clarity and measurable results.`;
    }

    // Nonprofit programs
    if (isNonprofitType) {
      if (/mentor|tutor|youth|teen|student|school/.test(n)) return "One-on-one and group support that gives young people the guidance they need to succeed.";
      if (/job|employ|career|workforce|train|skill/.test(n)) return "Practical skills training and job placement support that leads to real, lasting employment.";
      if (/hous|shelter|transitional|home/.test(n)) return "Safe, stable housing options and transition support for those working toward independence.";
      if (/food|meal|pantry|hunger|feed/.test(n)) return "Nutritious meals and food assistance for community members facing food insecurity.";
      if (/counsel|mental.?health|therapy|support.?group/.test(n)) return "Compassionate, accessible mental health support and peer programs for those in need.";
      if (/health|medical|clinic|wellness/.test(n)) return "Community health services that remove barriers to care and support lasting wellbeing.";
      if (/legal|advocate|right|justice/.test(n)) return "Free and low-cost legal advocacy to help people navigate systems that were not built for them.";
      if (/senior|elder|aging/.test(n)) return "Supportive programs that help seniors live with dignity, connection, and independence.";
      if (/child|family|parent/.test(n)) return "Family-centered programs that strengthen households and give children a better start.";
      if (/educat|literacy|read|learn/.test(n)) return "Education programs that build foundational skills and open doors to future opportunity.";
      if (/art|music|creat|cultur/.test(n)) return "Creative programs that nurture self-expression, cultural pride, and community identity.";
      if (/volunteer|community|outreach/.test(n)) return "Hands-on community service that connects volunteers with real, meaningful work.";
      return `A community program designed to ${name.toLowerCase()}, serving those who need it most.`;
    }

    // Church / Faith Organization
    if (isChurchType) {
      if (/worship|service|sunday|gather/.test(n)) return "A welcoming weekly gathering for worship, connection, and spiritual growth.";
      if (/youth|teen|student|kids/.test(n)) return "Age-appropriate programs that help young people grow in faith and community.";
      if (/small.?group|lifegroup|connect.?group|bible.?study/.test(n)) return "Smaller gatherings where members go deeper in faith and build real relationships.";
      if (/mission|outreach|serve/.test(n)) return "Local and global service opportunities that put faith into action.";
      if (/counsel|care|pastoral/.test(n)) return "Pastoral support and care for individuals and families walking through difficult seasons.";
      if (/preschool|nursery|children/.test(n)) return "A safe, nurturing space for the youngest members of your church family.";
      if (/women|men|ladies|gentlemen/.test(n)) return "Focused gatherings that build community and spiritual depth within your congregation.";
      if (/give|tithe|donat/.test(n)) return "Simple, secure giving options that support the work of the church and community.";
      if (/media|stream|podcast|sermon/.test(n)) return "Stay connected to messages and church content wherever you are, on any device.";
      if (/food.?pantry|food.?bank|hunger.?relief|hunger.?ministr/.test(n)) return "A food ministry that provides groceries and essential items to families facing food insecurity — with dignity and no barriers.";
      if (/communit.?meal|free.?meal|meal.?ministr|feeding/.test(n)) return "Regular community meals that bring people together around a table — nourishing bodies and building real connection.";
      if (/benevolen/.test(n)) return "A ministry of practical care — providing financial assistance and essential resources to individuals and families facing hardship.";
      if (/cloth|clothes.?closet|clothing.?ministr/.test(n)) return "Free clothing and essentials provided with dignity to individuals and families in the community.";
      if (/outreach/.test(n)) return "Hands-on outreach that takes the love and resources of the church beyond the walls and into the community where people live.";
      return `A ministry dedicated to ${name.toLowerCase()}, serving the congregation and surrounding community.`;
    }

    // Personal Brand / Coaching / Consulting
    if (isPersonalBrand || serviceTheme === "consulting") {
      if (/1.?on.?1|one.?on.?one|individual.?session|private.?session/.test(n)) return "Focused one-on-one sessions tailored entirely to where you are and where you want to go.";
      if (/group.?coach|mastermind|cohort|group.?program/.test(n)) return "A high-energy group environment where you learn alongside peers who are serious about growth.";
      if (/resume|cv/.test(n)) return "A professionally written resume that gets you noticed and opens the right doors.";
      if (/linkedin/.test(n)) return "A fully optimized LinkedIn profile that builds your authority and attracts the opportunities you want.";
      if (/interview.?prep|mock.?interview/.test(n)) return "Targeted coaching that builds your confidence and turns tough questions into clear, compelling answers.";
      if (/executive.?coach|leadership.?coach/.test(n)) return "Strategic coaching for leaders who want to sharpen their decision-making, grow their impact, and lead with clarity.";
      if (/career.?coach|career.?strateg|job.?search/.test(n)) return "A clear, personalized plan for your career move — from positioning to offers — built around your specific goals.";
      if (/business.?coach|business.?strateg|entrepreneur/.test(n)) return "Practical business coaching that cuts through the noise and focuses on what actually moves the needle.";
      if (/strateg|roadmap/.test(n)) return "A focused strategy session that turns big goals into a clear, prioritized action plan you can actually execute.";
      if (/mentor|accountability/.test(n)) return "Consistent guidance and accountability to keep you moving forward — even when motivation runs low.";
      if (/brand|personal.?brand/.test(n)) return "Build a personal brand that reflects who you really are and attracts the right clients, employers, or opportunities.";
      if (/speak|presentation|pitch/.test(n)) return "Develop the skills to present your ideas with clarity, confidence, and real credibility.";
      if (/workshop|training|course/.test(n)) return "Structured sessions that deliver real, actionable skills — not just theory.";
      if (/vip.?day|intensive|deep.?dive/.test(n)) return "An immersive, results-focused session where we tackle your biggest challenges and leave with a clear path forward.";
      if (/audit|review|assessment/.test(n)) return "A thorough review that surfaces what's working, what isn't, and exactly what to change next.";
      if (/advisory|consult/.test(n)) return "Expert guidance on-demand — without the overhead of a full-time hire.";
      return `Personalized ${name.toLowerCase()} support designed to get you real results, not just advice.`;
    }

    // Restaurant / Food
    if (isMenuContext) {
      if (/sandwich|sub|wrap/.test(n)) return "Fresh-made to order with quality ingredients — a go-to for a satisfying meal.";
      if (/salad/.test(n)) return "Crisp and fresh, made with care — a lighter option without sacrificing flavor.";
      if (/burger|smash/.test(n)) return "Juicy, built right, and worth every bite — a crowd favorite every time.";
      if (/pizza/.test(n)) return "Hand-crafted with quality toppings on a perfectly baked crust.";
      if (/taco|burrito|bowl/.test(n)) return "Bold, seasoned flavors in every bite — fresh ingredients, made to order.";
      if (/dessert|cake|pie|cookie|sweet/.test(n)) return "A sweet finish made fresh — the kind of ending that keeps people coming back.";
      if (/drink|beverage|cocktail|lemonade|tea/.test(n)) return "The perfect complement to your meal — refreshing, well-made, and consistent.";
      if (/breakfast|brunch/.test(n)) return "A satisfying start made with fresh ingredients and genuine care.";
      if (/bbq|smoked|brisket|ribs/.test(n)) return "Low and slow, the right way — smoky, tender, and full of real flavor.";
      if (/seafood|fish|shrimp|crab/.test(n)) return "Fresh catch prepared well — clean flavors that honor the ingredient.";
      return `Fresh, made-to-order ${name.toLowerCase()} — crafted with quality and served with care.`;
    }

    // Local service business and generic (non-food) paths below
    if (/media.?box.?sale|box.?sale|device.?sale|sell.?box/.test(n))
      return "Choose from available home entertainment streaming devices — setup guidance included.";
    if (/tv.?box.?setup|set.?up.?tv|box.?setup|setup.?box/.test(n))
      return "Get your device connected to your TV and ready to stream in just a few steps.";
    if (/wi.?fi.?connect|wifi.?connect|connect.*(wi.?fi|wifi)|internet.?connect/.test(n))
      return "Make sure your device is online, connected to the right network, and ready to stream.";
    if (/remote.?setup|setup.?remote|remote.?program|pair.?remote/.test(n))
      return "Learn how to use your remote, navigate the menus, and control your device with ease.";
    if (/walkthrough|walk.?through|device.?tour|how.?to.?use/.test(n))
      return "Get a clear step-by-step walkthrough of your device right after setup — no guessing.";
    if (/troubleshoot|trouble.?shoot|not.?work|not.?connect|fix.?device/.test(n))
      return "Get hands-on help when your device won't connect, freezes, or isn't working correctly.";
    if (/customer.?support|after.?setup.?support|ongoing.?support|follow.?up/.test(n))
      return "Ask questions after setup — because support doesn't stop when the box is plugged in.";
    if (/streaming.?help|stream.?setup|streaming.?service/.test(n))
      return "Get help finding and launching your approved streaming apps and channels.";
    if (/media.?box|tv.?box|set.?top|iptv|streaming.?device|entertainment.?box/.test(n))
      return "Professional setup and support for your home entertainment streaming device.";

    // Plumbing — each item gets a distinct description
    if (/emergency.?plumb|urgent.?plumb|burst.?pipe/.test(n)) return "Available around the clock for burst pipes, flooding, and plumbing emergencies.";
    if (/pipe.?repair|pipe.?replac/.test(n)) return "Repair or replace damaged pipes cleanly and correctly — no repeat visits needed.";
    if (/leak.?detect|leak.?find/.test(n)) return "Advanced leak detection that finds the source without tearing up your property.";
    if (/drain.?clean|unclog|clog/.test(n)) return "Clear stubborn clogs and restore full flow without the mess or wait.";
    if (/water.?heat|water.?heater|boiler/.test(n)) return "Install, repair, or replace water heaters so you never run out of hot water.";
    if (/toilet|fixture|faucet/.test(n)) return "Toilet, faucet, and fixture repairs done right — no drips, no running, no callbacks.";
    if (/sewer|septic|main.?line/.test(n)) return "Full sewer and septic service including inspection, cleaning, and repairs.";
    if (/plumb|pipe|drain|leak/.test(n)) return "Reliable, licensed plumbing work completed on time and built to last.";

    // Electrical
    if (/panel|breaker|circuit/.test(n)) return "Safe panel upgrades and breaker work done to code — no shortcuts.";
    if (/outlet|switch|wiring/.test(n)) return "New outlets and switches installed cleanly and up to current electrical code.";
    if (/light|ceiling.?fan|fixture/.test(n)) return "Lighting and fan installation that improves comfort and reduces energy costs.";
    if (/generator|backup.?power/.test(n)) return "Whole-home generator installation so you stay powered when the grid goes down.";
    if (/electric|wiring/.test(n)) return "Licensed electrical work done to code — on time and backed by a warranty.";

    // Lawn & outdoor
    if (/lawn.?care|lawn.?service|lawn.?mainten/.test(n)) return "Consistent, scheduled care that keeps your lawn looking healthy all season.";
    if (/mow|grass.?cut|cut.?grass/.test(n)) return "Reliable mowing on a schedule so your lawn never gets away from you.";
    if (/landscap/.test(n)) return "Custom landscaping design and maintenance that adds real curb appeal.";
    if (/tree.?trim|tree.?remov|tree.?service/.test(n)) return "Safe, clean tree trimming and removal done by experienced hands.";
    if (/mulch|sod|seed|aerat/.test(n)) return "Seasonal treatments that give your lawn the foundation it needs to stay green.";
    if (/pressure.?wash|power.?wash/.test(n)) return "Blast away grime, mold, and buildup from driveways, decks, and siding.";

    // Cleaning
    if (/deep.?clean/.test(n)) return "A thorough top-to-bottom clean that gets the spots regular cleaning misses.";
    if (/move.?in|move.?out|vacant/.test(n)) return "Leave the place spotless — whether you're moving in or handing over the keys.";
    if (/recurring|regular|weekly|bi.?weekly|monthly.?clean/.test(n)) return "Scheduled cleaning so you never have to think about it — just come home to clean.";
    if (/clean|sanitiz|janitorial|housekeep|maid/.test(n)) return "Thorough, dependable cleaning you won't have to think twice about.";

    // Tech support
    if (/computer.?setup|laptop.?setup|pc.?setup/.test(n)) return "Get your computer configured, updated, and ready to use from day one.";
    if (/virus|malware|security.?scan/.test(n)) return "Scan, clean, and protect your device against threats and slowdowns.";
    if (/wi.?fi|wifi|router|network/.test(n)) return "Get your home or office network set up and connected reliably.";
    if (/phone.?setup|phone.?transfer|data.?transfer/.test(n)) return "Move your contacts, photos, and apps to a new phone without losing anything.";
    if (/printer|scanner/.test(n)) return "Get your printer or scanner connected and working — no more error messages.";
    if (/tech.?support|it.?support|computer.?help/.test(n)) return "Friendly, no-jargon help for everyday tech problems and questions.";

    // Beauty & wellness
    if (/haircut|hairstyle|color|highlight|balayage/.test(n)) return "Expert cuts and color in a relaxed, welcoming environment.";
    if (/nail|manicure|pedicure/.test(n)) return "Clean, polished nails — done carefully and with quality products.";
    if (/massage|deep.?tissue|swedish/.test(n)) return "Relieving tension and stress so you leave feeling noticeably better.";
    if (/facial|skin|peel/.test(n)) return "Skin treatments tailored to your specific concerns and skin type.";
    if (/lash|brow|wax/.test(n)) return "Precise, clean shaping that frames your face perfectly.";

    // Fitness
    if (/personal.?train|one.?on.?one.?train/.test(n)) return "Customized workouts with hands-on coaching to hit your specific goals.";
    if (/yoga|pilates/.test(n)) return "Structured classes that improve flexibility, strength, and mental clarity.";
    if (/nutrit|meal.?plan|diet/.test(n)) return "Practical nutrition guidance you can actually stick to in real life.";

    // Accounting
    if (/tax.?prep|tax.?return|file.?tax/.test(n)) return "Accurate tax filing that maximizes your return and keeps you compliant.";
    if (/bookkeep/.test(n)) return "Organized, up-to-date books so you always know where your money stands.";
    if (/payroll/.test(n)) return "Payroll handled on time, every time — no missed payments, no penalties.";
    if (/financ.?plan|budget|forecast/.test(n)) return "Clear financial planning so you can make confident business decisions.";

    // Education / Childcare
    if (/tutoring|homework.?help|test.?prep/.test(n)) return "Patient, effective instruction that builds real understanding and confidence.";
    if (/daycar|childcar|babysit/.test(n)) return "Safe, attentive care your child will look forward to.";
    if (/after.?school/.test(n)) return "Supervised, structured care between school and home pickup.";

    // Moving
    if (/pack|unpack/.test(n)) return "Careful packing and unpacking so nothing gets lost or damaged.";
    if (/junk.?remov|haul.?away|trash/.test(n)) return "Fast haul-away of unwanted items — you point, we take it.";
    if (/storage/.test(n)) return "Secure short- or long-term storage while you're between spaces.";
    if (/mov/.test(n)) return "Efficient, careful moving that takes the stress out of the whole process.";

    // Home improvement
    if (/paint.?interior|interior.?paint/.test(n)) return "Clean, even coats that transform a room without the mess.";
    if (/paint.?exterior|exterior.?paint/.test(n)) return "Weatherproof exterior painting that protects your home and improves curb appeal.";
    if (/drywall/.test(n)) return "Seamless drywall repair and installation with a smooth, paint-ready finish.";
    if (/flooring|hardwood|tile.?install/.test(n)) return "Durable flooring installed correctly so it looks great and lasts.";
    if (/roof|gutter/.test(n)) return "Roof and gutter work that protects your home from water damage.";
    if (/fence|deck|patio/.test(n)) return "Outdoor structures built to last through years of weather and use.";
    if (/handyman|odd.?job|home.?repair/.test(n)) return "Small fixes and projects handled quickly so they stop being on your to-do list.";

    // Delivery
    if (/same.?day/.test(n)) return "Same-day delivery for time-sensitive orders and urgent pickups.";
    if (/deliver|ship|courier/.test(n)) return "Reliable pickup and delivery, tracked and on schedule.";

    // Events (not nonprofit)
    if (/wedding/.test(n)) return "Full coordination and day-of support so you can enjoy every moment of your wedding.";
    if (/cater/.test(n)) return "Fresh, made-to-order food that feeds your guests and impresses every time.";
    if (/decor|floral|design/.test(n)) return "Custom event styling that turns any venue into the right atmosphere.";

    // Real estate
    if (/buy|purchas/.test(n)) return "Guided support through the buying process so you make a confident, informed decision.";
    if (/sell|list/.test(n)) return "Strategic pricing and marketing to sell your property quickly and at full value.";
    if (/rent|property.?manag/.test(n)) return "Hassle-free rental management — tenant screening, maintenance, and collections.";

    // Legal
    if (/notary/.test(n)) return "Fast, professional notarization for documents that need to be official.";
    if (/contract/.test(n)) return "Contracts reviewed and drafted clearly so you know exactly what you're agreeing to.";
    if (/estate.?plan|will|trust/.test(n)) return "Protect your assets and family's future with a clear, properly structured plan.";

    // Digital marketing
    if (/seo/.test(n)) return "Improve your search rankings so the right people can find you online.";
    if (/social.?media|instagram|facebook/.test(n)) return "Consistent, on-brand content that grows your following and drives engagement.";
    if (/google.?ads|ppc|paid.?ads/.test(n)) return "Targeted ad campaigns that bring in leads without wasting your budget.";
    if (/email.?market/.test(n)) return "Email campaigns that stay in touch with customers and bring them back.";
    if (/website|web.?design|web.?dev/.test(n)) return "A professional website that represents your business and converts visitors.";

    return `Professional ${name.toLowerCase()} — handled with care and attention to detail.`;
  };

  // --- Homepage section plan ---
  const getSections = (): string[] => {
    if (isMenuContext) return ["Hero", "Menu Highlights", "About", "Book or Order", "Contact"];
    switch (orgType) {
      case "software/app startup":   return ["Hero", "Features", "How It Works", "Pricing", "Testimonials", "Contact / CTA"];
      case "agency/consultancy":     return ["Hero", "Services", "Our Process", "Case Studies / Work", "Testimonials", "Contact"];
      case "nonprofit":              return ["Hero", "Our Mission", "Programs & Services", "Impact Stories", "Get Involved", "Donate", "Contact"];
      case "church/faith organization": return ["Hero", "Welcome", "Ministries & Programs", "Events", "About Us", "Give", "Contact"];
      case "product shop":           return ["Hero", "Featured Products", "Why Choose Us", "Testimonials", "Newsletter Signup", "Contact"];
      case "personal brand":         return ["Hero", "About Me", "Services", "Portfolio / Work", "Testimonials", "Contact"];
      case "local service business": return ["Hero", "Services", "Why Choose Us", "Service Area", "Customer Reviews", "Contact"];
      case "community project":      return ["Hero", "About the Project", "How to Get Involved", "Events", "Team", "Contact"];
      default:                       return ["Hero", "About", "Services", "Testimonials", "Call to Action", "Contact"];
    }
  };
  const sectionsList = getSections();

  // --- Hero headline ---
  const getHeadline = (): string => {
    if (isMenuContext) {
      return coreService
        ? `${bizName} — ${cap(coreService)} Worth Coming Back For`
        : `${bizName} — Fresh Food, Honest Flavor`;
    }
    switch (orgType) {
      case "software/app startup":
        return cleanGoal
          ? `${bizName} — ${cap(cleanGoal)}`
          : `${bizName} — Built for the Problem That Actually Matters`;
      case "agency/consultancy":
        return cleanGoal
          ? `${bizName} — ${cap(cleanGoal)}`
          : `${bizName} — Strategy and Execution, Without the Guesswork`;
      case "nonprofit":
        return cleanGoal
          ? `${bizName} — ${cap(cleanGoal)}`
          : `${bizName} — Making a Lasting Difference`;
      case "church/faith organization":
        return location
          ? `${bizName} — A Place to Belong in ${location}`
          : `${bizName} — A Place to Belong`;
      case "local service business":
        return `${bizName} — ${getBenefitHeadline()}`;
      case "personal brand":
        return cleanGoal
          ? `${bizName} — ${cap(cleanGoal)}`
          : serviceTheme !== "general"
            ? `${bizName} — ${getBenefitHeadline()}`
            : `${bizName} — Helping You Move Forward`;
      case "product shop":
        return serviceTheme !== "general"
          ? `${bizName} — ${getBenefitHeadline()}`
          : coreService
            ? `${bizName} — ${cap(coreService)} That Speaks for Itself`
            : `${bizName} — Quality Products, Simple Process`;
      case "community project":
        return location
          ? `${bizName} — Rooted in ${location}`
          : `${bizName} — Stronger Together`;
      default:
        return serviceTheme !== "general"
          ? `${bizName} — ${getBenefitHeadline()}`
          : `${bizName} — Built to Serve`;
    }
  };

  // --- Hero subheadline ---
  const getSubheadline = (): string => {
    if (isMenuContext) {
      return `Fresh, made-to-order food for events, gatherings, and everyday cravings. ${ctaUpper} today.`;
    }

    if (isSaasType) {
      const featurePhrase = servicesList.length >= 2
        ? `${fixProperNouns(servicesList[0].toLowerCase())} and ${fixProperNouns(servicesList[1].toLowerCase())}`
        : coreService ? fixProperNouns(coreService.toLowerCase()) : "the tools your team actually needs";
      return `${bizName} gives your team ${featurePhrase} — without the complexity you don't need.`;
    }

    if (isAgencyType) {
      const servicePhrase = servicesList.length >= 2
        ? `${servicesList[0].toLowerCase()} and ${servicesList[1].toLowerCase()}`
        : coreService ? coreService.toLowerCase() : "full-service solutions";
      const locationPhrase = location ? ` for clients in ${location}` : "";
      return `We deliver ${servicePhrase}${locationPhrase} — grounded in strategy, built to perform. ${ctaUpper}.`;
    }

    if (isNonprofitType) {
      const programPhrase = servicesList.length > 0 ? servicesList[0].toLowerCase() : "community programs";
      const locationPhrase = location ? ` in ${location}` : "";
      return `${bizName} provides ${programPhrase} and more${locationPhrase} — serving those who need it most. ${ctaUpper}.`;
    }

    if (isChurchType) {
      const locationPhrase = location ? ` in ${location}` : "";
      return `We are a growing faith community${locationPhrase} — welcoming everyone, at every stage of their journey.`;
    }

    if (isPersonalBrand) {
      const servicePhrase = servicesList.length >= 2
        ? `${fixProperNouns(servicesList[0].toLowerCase())} and ${fixProperNouns(servicesList[1].toLowerCase())}`
        : coreService ? fixProperNouns(coreService.toLowerCase()) : "coaching and strategy";
      const locationPhrase = location ? ` in ${location}` : "";
      const aud = audienceDisplay.charAt(0).toLowerCase() + audienceDisplay.slice(1);
      const byTone: Record<string, string> = {
        professional: `I help ${aud} with ${servicePhrase}${locationPhrase} — grounded in strategy and built for real results. ${ctaUpper}.`,
        bold: `I help ${aud} ${cleanGoal || "get real results"}${locationPhrase} — no fluff, no excuses. ${ctaUpper}.`,
        warm: `I help ${aud} with ${servicePhrase}${locationPhrase} — and I treat every client like a real person, not a number. ${ctaUpper} whenever you're ready.`,
        playful: `I help ${aud} with ${servicePhrase}${locationPhrase} — and I genuinely love doing it. ${ctaUpper}!`,
        elegant: `I specialize in ${servicePhrase}${locationPhrase}, helping ${aud} with care and precision. ${ctaUpper}.`,
        "faith-based": `I help ${aud} with ${servicePhrase}${locationPhrase} — guided by integrity and a heart for service. ${ctaUpper}.`,
        "community-focused": `I help ${aud} with ${servicePhrase}${locationPhrase} — built around the people I serve. ${ctaUpper}.`,
      };
      return byTone[toneDisplay] ?? `I help ${aud} with ${servicePhrase}${locationPhrase}. ${ctaUpper} today.`;
    }

    const offeringPhrase = servicesList.length >= 2
      ? `${servicesList[0].toLowerCase()} and ${servicesList[1].toLowerCase()}`
      : coreService ? coreService.toLowerCase() : "quality service";
    const locationPhrase = location ? ` in the ${location} area` : "";

    const byTone: Record<string, string> = {
      professional: `Providing ${offeringPhrase}${locationPhrase} with professionalism and reliability. ${ctaUpper} today.`,
      bold: `${cap(offeringPhrase)}${locationPhrase} — done with no compromise. ${ctaUpper} now.`,
      elegant: `Refined ${offeringPhrase}${locationPhrase}, delivered with care and precision. ${ctaUpper}.`,
      warm: `We specialize in ${offeringPhrase}${locationPhrase} and treat every client like a neighbor. ${ctaUpper} whenever you're ready.`,
      playful: `We do ${offeringPhrase}${locationPhrase} — and we actually love doing it. ${ctaUpper}!`,
      "faith-based": `Offering ${offeringPhrase}${locationPhrase} with integrity and a heart for service. ${ctaUpper}.`,
      "community-focused": `${cap(offeringPhrase)}${locationPhrase}, built around the people we serve. ${ctaUpper}.`,
    };
    return byTone[toneDisplay] ?? `Professional ${offeringPhrase}${locationPhrase}. ${ctaUpper} today.`;
  };

  const headline = getHeadline();
  const subheadline = getSubheadline();

  // --- About section ---
  const getAbout = (): string => {
    const offeringList = servicesList.length > 0
      ? fixProperNouns(servicesList.slice(0, 3).join(", ").toLowerCase())
      : "quality services";
    const goalSentence = cleanGoal ? ` We started ${bizName} with one goal in mind: ${cleanGoal}.` : "";

    if (isSaasType) {
      return `${bizName} is a software product built to streamline ${offeringList} — without the overhead you don't need.${goalSentence} We built it because we experienced the problem firsthand and knew there was a better way.`;
    }
    if (isAgencyType) {
      return `${bizName} is a ${orgType} specializing in ${offeringList}.${goalSentence} We work with clients who want more than deliverables — they want outcomes, and a team that owns the work alongside them.`;
    }
    if (isNonprofitType) {
      return `${bizName} is a nonprofit organization on a mission to ${cleanGoal || "serve our community"}. We offer ${offeringList} to the people who need it most, because we believe access to support should not depend on circumstance.`;
    }
    if (isChurchType) {
      return `${bizName} is a faith community committed to welcoming people from all walks of life.${goalSentence} We gather each week to worship, grow, and serve — together. Whether you're new to faith or have been walking it for years, there is a place for you here.`;
    }

    if (isPersonalBrand) {
      const audLower = audienceDisplay.charAt(0).toLowerCase() + audienceDisplay.slice(1);
      const byTone: Record<string, string> = {
        professional: `I'm ${founderDisplay} — a ${coreService ? fixProperNouns(coreService.toLowerCase()) + " specialist" : "coach and consultant"} who helps ${audLower}. ${cleanGoal ? `My mission is simple: ${cleanGoal}.` : ""} I work with each client one-on-one to deliver real results, not just advice.`,
        bold: `I'm ${founderDisplay}. I help ${audLower} ${cleanGoal || "achieve results"} — no fluff, no filler, no excuses.`,
        warm: `Hi, I'm ${founderDisplay}. I started this work because I know firsthand how hard it can be to ${cleanGoal || "make real progress on your own"}. I help ${audLower} through ${offeringList} — and I treat every client like the individual they are.`,
        playful: `Hey! I'm ${founderDisplay}, and I love helping ${audLower}. I created ${offeringList} because I believe everyone deserves support that actually works.`,
        elegant: `I'm ${founderDisplay} — a specialist in ${offeringList}. My work is built on one principle: every client deserves a personalized approach, thoughtful guidance, and results they can see.`,
        "faith-based": `I'm ${founderDisplay}, and my work is grounded in a genuine desire to serve. I help ${audLower} with ${offeringList} — with honesty, care, and a heart for the people I work with.`,
        "community-focused": `I'm ${founderDisplay}, and I'm deeply invested in helping ${audLower}. I created ${offeringList} because I believe real change starts with real, personal support.`,
      };
      return byTone[toneDisplay] ?? `I'm ${founderDisplay}, and I specialize in ${offeringList}. I'm here to help ${audLower} ${cleanGoal || "move forward with clarity and confidence"}.`;
    }

    const byTone: Record<string, string> = {
      professional: `${bizName} is a ${orgType || "business"} specializing in ${offeringList}.${goalSentence} We take pride in doing the work right and standing behind everything we deliver.`,
      bold: `${bizName} is built on one standard: no shortcuts.${goalSentence} We offer ${offeringList} because we believe people deserve work that actually holds up.`,
      elegant: `${bizName} brings together ${offeringList} under one roof — with the kind of attention to detail that makes a real difference.${goalSentence}`,
      warm: `${bizName} was started because we saw a real need — and we knew we could help.${goalSentence} We specialize in ${offeringList} and treat every client the way we'd want to be treated ourselves.`,
      playful: `We're ${bizName}, and we genuinely love what we do.${goalSentence} Whether it's ${offeringList}, we show up ready and make sure you leave happy.`,
      "faith-based": `${bizName} was founded on faith and a calling to serve.${goalSentence} We provide ${offeringList} with honesty, compassion, and a commitment to doing what's right.`,
      "community-focused": `${bizName} is part of this community — not just a business in it.${goalSentence} We offer ${offeringList} because we believe local matters and people deserve reliable help close to home.`,
    };
    return byTone[toneDisplay] ?? `${bizName} provides ${offeringList} with a focus on quality and dependability.${goalSentence}`;
  };

  // --- Services/Features draft ---
  const getServicesDraft = (): string => {
    if (servicesList.length === 0) {
      return "Add your services, programs, or features in the form above — they'll appear here with individual descriptions.";
    }
    if (isMenuContext) {
      return `Here's a look at what ${bizName} brings to the table:\n\n${servicesList.map(s => `• ${s}`).join("\n")}`;
    }
    const introByType: Record<string, string> = {
      "software/app startup": "Here's what's inside:",
      "agency/consultancy": "We handle it end to end — here's how we can help:",
      nonprofit: "Our programs are designed to create lasting change:",
      "church/faith organization": "Here's how we serve our congregation and community:",
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

    if (isSaasType) {
      return cta === "start free trial"
        ? `Try ${bizName} free for 14 days — no credit card required. See for yourself in minutes.`
        : cta === "request a demo"
        ? `Want to see ${bizName} in action? Schedule a live demo and we'll walk you through everything.`
        : `Ready to get started? ${ctaUpper} and see what ${bizName} can do for your team.`;
    }
    if (isChurchType) {
      return `We'd love to welcome you. Whether you're curious about faith or looking for a church home, come as you are — ${bizName} is a place for everyone.`;
    }

    if (isPersonalBrand) {
      const byCtaKey: Record<string, string> = {
        "book a call": `Ready to talk? Book a call and let's figure out exactly what you need — no pressure, no sales pitch.`,
        "request a quote": `Every client is different. Tell me about your situation and I'll put together the right approach for you.`,
        "contact us": `Have a question? I respond personally. Send me a message and let's connect.`,
        "learn more": `Want to know more about how I work and who I help? Take a look around — I think you'll find it worth your time.`,
      };
      return byCtaKey[cta] ?? `I'd love to connect. ${ctaUpper} and let's talk about where you want to go and how I can help you get there.`;
    }

    const byCtaKey: Record<string, string> = {
      "book a call": `Ready to talk? Schedule a call and we'll figure out exactly what you need — no pressure, no runaround.`,
      "book catering": `Planning an event${locationNote}? Let ${bizName} handle the food. Fill out a request and we'll take it from there.`,
      "request a quote": `Every job is different. Tell us about yours and we'll get you a straight answer and a fair quote.`,
      "view menu": `Take a look at what ${bizName} is serving — fresh options, consistent quality, and something for everyone.`,
      "donate": `Your contribution goes directly toward ${cleanGoal || "the work that matters most"}. Every dollar makes a difference.`,
      "contact us": `Have a question? We're easy to reach and happy to help. Send us a message and we'll get back to you promptly.`,
      "shop now": `Browse our full selection and find what you're looking for — straightforward, no-nonsense shopping.`,
      "learn more": `Want to know more about ${bizName} and what we do? Take a look around — we think you'll find it worth your time.`,
      "get involved": `There are many ways to support ${bizName}${locationNote}. Volunteer, donate, or spread the word — every action helps.`,
    };
    if (isNonprofitType) {
      return byCtaKey[cta] ?? `Have questions about our programs? We're here to help. Reach out and let's connect.`;
    }
    return byCtaKey[cta] ?? `${bizName} is ready to help. Reach out and let's get started.`;
  };

  // --- Content checklist ---
  const getContentChecklist = (): string => {
    const universal = [
      "□ Logo file (SVG or PNG with transparent background)",
      "□ Brand colors (hex codes preferred)",
      "□ Contact information (email, phone, address if applicable)",
      "□ Social media profile links",
    ];

    const byType: Record<string, string[]> = {
      "software/app startup": [
        "□ App screenshots or product demo video",
        "□ Feature descriptions or product spec sheet",
        "□ Pricing tiers and plan details",
        "□ Customer testimonials or case study quotes",
        "□ Founder or team headshots and bios",
        "□ Integration logos or partner badges",
        "□ Privacy policy and terms of service documents",
      ],
      "agency/consultancy": [
        "□ Team headshots and short bios",
        "□ 2–4 case studies or client work samples",
        "□ Client logos (with permission to display)",
        "□ Service descriptions or process overview",
        "□ Testimonials or Google/Clutch review excerpts",
        "□ Awards, certifications, or press mentions",
      ],
      "restaurant/food": [
        "□ High-quality food photography (minimum 5–8 images)",
        "□ Full menu with current pricing",
        "□ Hours of operation and location/map details",
        "□ Online ordering or reservation link (if applicable)",
        "□ Staff or chef photos",
        "□ Health department rating or certifications",
      ],
      "nonprofit": [
        "□ Mission statement and organization story",
        "□ Program descriptions and eligibility details",
        "□ Impact statistics (people served, outcomes, etc.)",
        "□ Team and board member headshots and bios",
        "□ Testimonials from program participants",
        "□ Donation page or preferred giving platform",
        "□ 501(c)(3) information for tax deductibility",
        "□ Annual report or financial transparency document (optional)",
      ],
      "church/faith organization": [
        "□ Service times and location",
        "□ Statement of faith or beliefs",
        "□ Ministry and program descriptions",
        "□ Pastor / leadership headshots and bios",
        "□ Event calendar or upcoming series",
        "□ Sermon archive or media library (if streaming)",
        "□ Online giving platform link",
        "□ Photos of congregation and community events",
      ],
      "personal brand": [
        "□ Professional headshot (multiple options preferred)",
        "□ Bio (short and long versions)",
        "□ Portfolio pieces or work samples",
        "□ Service or offer descriptions with pricing",
        "□ Testimonials or client results",
        "□ Speaking reel, press mentions, or media kit (if applicable)",
      ],
      "product shop": [
        "□ Product photos (multiple angles, lifestyle shots)",
        "□ Product descriptions and pricing",
        "□ Shipping and return policy",
        "□ Customer reviews or testimonials",
        "□ About the maker / brand story",
        "□ Size charts or specification sheets (if applicable)",
      ],
      "local service business": [
        "□ Photos of your work (before/after, on-the-job)",
        "□ Service area (cities, ZIP codes, or radius)",
        "□ Licensing, bonding, or certification numbers",
        "□ Customer reviews (Google, Yelp, or direct quotes)",
        "□ Team photos (optional but builds trust)",
        "□ Pricing guide or starting rates (if sharing publicly)",
      ],
      "community project": [
        "□ Project description and background story",
        "□ Team or organizer headshots and bios",
        "□ Photos from events or past activities",
        "□ Volunteer or participation sign-up form link",
        "□ Partnership or sponsor logos",
        "□ Impact updates or milestones",
      ],
    };

    const typeItems = byType[orgType] ?? [
      "□ Photos relevant to your business or organization",
      "□ Testimonials or reviews",
      "□ Team headshots and bios",
      "□ Pricing or service details",
    ];

    const shared = [
      "□ Existing website URL or inspiration links",
      "□ Written content you already have (About, services, etc.)",
    ];

    return "Before Build Begins — gather these assets before handing off to a developer or agent:\n\n" +
      [...universal, ...typeItems, ...shared].join("\n");
  };

  // --- Tech stack label ---
  const techStackLabels: Record<string, string> = {
    "html-css": "Simple HTML / CSS",
    "html-css-js": "HTML / CSS / JavaScript",
    "react": "React",
    "nextjs": "Next.js",
    "replit-fullstack": "Full-Stack Web App",
  };
  const techStackLabel = techStack ? techStackLabels[techStack] ?? techStack : "HTML / CSS";

  // --- Tech stack instructions ---
  const getTechStackInstructions = (): string => {
    switch (techStack) {
      case "html-css":
        return "Build using pure HTML5 and CSS3 only — no JavaScript frameworks, no CSS frameworks, no external libraries except Google Fonts.";
      case "html-css-js":
        return "Build using HTML5, CSS3, and vanilla JavaScript. No frameworks. Google Fonts are fine. Use JavaScript only for interactivity (mobile nav, smooth scroll, form validation).";
      case "react":
        return "Build as a React application using Vite. Use functional components and hooks. Style with CSS modules or Tailwind CSS. No Next.js.";
      case "nextjs":
        return "Build as a Next.js application using the App Router. Use TypeScript. Style with Tailwind CSS. Optimize for SEO with metadata and server components where appropriate.";
      case "replit-fullstack":
        return "Build as a full-stack web app with React on the frontend and an Express.js (Node) backend. Include a contact form with server-side handling. Use TypeScript throughout.";
      default:
        return "Build using pure HTML5 and CSS3 — no JavaScript frameworks, no CSS frameworks, no external libraries except Google Fonts.";
    }
  };

  // --- Cached generator outputs — each computed once, reused in template strings and output cards ---
  const isClassicStack = techStack === "html-css" || techStack === "html-css-js" || !techStack;
  const aboutDraft = getAbout();
  const ctaDraft = getCtaDraft();
  const techStackInstructions = getTechStackInstructions();
  const servicesDraft = getServicesDraft();
  const contentChecklist = getContentChecklist();

  // --- HTML section ID for services/features/ministries/menu ---
  const servicesSectionId = isMenuContext ? "menu" : isSaasType ? "features" : isChurchType ? "ministries" : "services";

  // --- Extra nav items that need placeholder sections in the HTML ---
  const generatedHtmlIds = new Set(["home", "about", servicesSectionId, "cta", "contact"]);
  const extraSections = navItems.filter(item => {
    const id = item.toLowerCase().replace(/\s+/g, "-");
    return !generatedHtmlIds.has(id) && item !== "Home" && item !== "Contact";
  });

  // --- SEO title and meta description (reused in getSeoPack and htmlDraft head) ---
  const seoTitle = (() => {
    const goalPart = cleanGoal ? cap(cleanGoal.slice(0, 60)) : coreService ? cap(coreService) : "Quality Service";
    return location ? `${bizName} | ${goalPart} — ${location}` : `${bizName} | ${goalPart}`;
  })();
  const seoMetaDesc = (() => {
    const audLower = audienceDisplay.charAt(0).toLowerCase() + audienceDisplay.slice(1);
    const verb = isSaasType ? "helps teams with" : isPersonalBrand ? "helps" : "provides";
    const offering = coreService ? fixProperNouns(coreService.toLowerCase()) : cleanGoal ? cleanGoal : "quality services";
    const ctaPhrase = cta ? ` ${cap(cta)} today.` : "";
    let raw = `${bizName} ${verb} ${audLower} with ${offering}.${ctaPhrase}`;
    if (raw.length > 155) raw = raw.slice(0, 152) + "...";
    return raw;
  })();

  // Derived once, shared by both the SEO Starter Pack and the build prompt.
  const seoSchemaType = isSaasType ? "SoftwareApplication"
    : isPersonalBrand ? "Person"
    : isChurchType ? "Organization"
    : isNonprofitType ? "NGO"
    : isRestaurantType ? "FoodEstablishment"
    : "LocalBusiness";

  const seoKeywords = [
    coreService ? fixProperNouns(coreService.toLowerCase()) : null,
    servicesList[1] ? fixProperNouns(servicesList[1].toLowerCase()) : null,
    location && coreService ? `${fixProperNouns(coreService.toLowerCase())} in ${location}` : null,
    cleanGoal ? cleanGoal.split(" ").slice(0, 4).join(" ") : null,
  ].filter(Boolean) as string[];

  // --- SEO Starter Pack ---
  const getSeoPack = (): string => {
    const schemaType = seoSchemaType;
    const keywords = seoKeywords;

    const emailOrUrl = email ? `"email": "${email}"` : `"url": "[Add website URL]"`;
    const addressOrUrl = location
      ? `"address": { "@type": "PostalAddress", "addressLocality": "${location}" }`
      : `"url": "[Add website URL]"`;

    return `Page Title Formula:
${seoTitle}

Meta Description (${seoMetaDesc.length} chars):
${seoMetaDesc}

Open Graph Tags:
<meta property="og:title" content="${seoTitle}">
<meta property="og:description" content="${seoMetaDesc}">
<meta property="og:type" content="website">
<meta property="og:image" content="[Add OG image URL — 1200×630px recommended]">

JSON-LD Schema (${schemaType}):
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "${schemaType}",
  "name": "${bizName}",
  "description": "${seoMetaDesc.replace(/"/g, '\\"')}",
  ${emailOrUrl},
  ${addressOrUrl}
}
<\/script>

Suggested Keywords (${keywords.length > 0 ? keywords.length : 2}):
${keywords.length > 0 ? keywords.map((k, i) => `${i + 1}. ${k}`).join("\n") : "1. [Add target keyword]\n2. [Add target keyword]"}`;
  };

  // --- Tone-aware font + color ---
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

  // --- Universal Agent Build Prompt (primary output) ---
  // Agent-agnostic, self-contained, and derived entirely from ExtractedIntent.
  const buildPrompt = `# Universal Agent Build Prompt

Use this prompt in your preferred AI coding agent (Claude Code, Cursor, Replit Agent, Gemini, ChatGPT, or any other builder). It is self-contained — paste it in as-is.

## Project Summary
Build a modern, clean, fully responsive ${isSaasType ? "marketing/landing site" : "multi-page website"} for ${bizName}${projectName ? ` (project: ${projectName})` : ""}, a ${orgType || "local service business"}.${goalDisplay ? ` Primary goal: ${goalDisplay}.` : ""}

## Target Audience
${audienceDisplay}

## Brand Type & Tone
- Organization type: ${orgType || "local service business"}
- Brand tone: ${toneDisplay}

## Pages & Navigation
Create these pages/sections with sticky navigation linking to each:
${navItems.map((p) => `- ${p}`).join("\n")}

## Homepage Section Order
${sectionsList.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## ${servicesSectionTitle}
${servicesList.length > 0 ? servicesList.map((s) => `- ${s}: ${describeService(s)}`).join("\n") : "- [Add services, features, or programs here]"}

## Copy to Use
- Hero headline: ${headline}
- Hero subheadline: ${subheadline}
- CTA button label: ${ctaUpper}

About section:
${aboutDraft}

Call-to-action section:
${ctaDraft}

## Suggested Tech Stack
${techStackInstructions}

## Styling & Tone Guidance
- Visual tone: ${toneDisplay}
- Suggested font family: ${font.family}
- Suggested colors: primary ${c.primary} (hover ${c.hover}), background ${c.bg}, text ${c.text}, muted ${c.muted}
- Use generous spacing, clear visual hierarchy, and consistent styling across all sections.

## SEO Instructions
- Page title: ${seoTitle}
- Meta description: ${seoMetaDesc}
- Add Open Graph tags: og:title, og:description, og:type=website, and og:image (1200x630).
- Add JSON-LD structured data using schema.org type "${seoSchemaType}" for ${bizName}.
- Target keywords: ${seoKeywords.length > 0 ? seoKeywords.join(", ") : "[add 2-4 target keywords]"}

## Accessibility & Responsive Requirements
- Use semantic HTML5 landmarks: header, nav, main, section, footer.
- Fully responsive with no horizontal scroll at any screen width.
- Mobile navigation via an accessible hamburger toggle (aria-label, keyboard operable).
- Meet WCAG AA color contrast, provide visible focus states, and add descriptive alt text on all images.
- Respect prefers-reduced-motion for any animation or transition.

## Contact Requirements
- Email: ${email || "[Add contact email]"}
- Phone: ${phone || "[Add contact phone]"}
- Place contact details in the footer and link the primary CTA to the contact section.

## Implementation & Testing
- ${isClassicStack ? "Use CSS custom properties for all colors and fonts; load fonts via Google Fonts." : "Use a consistent component/styling system (e.g. Tailwind CSS)."}
- Add smooth scrolling for in-page anchor links.
- Before finishing, verify: mobile and desktop layouts render correctly, the mobile nav toggle works, all navigation links resolve, there are no console errors, and the page passes a basic accessibility check.${notes ? `\n\n## Additional Notes\n${notes}` : ""}`;

  // --- Starter HTML ---
  const htmlDraft = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seoTitle}</title>
    <meta name="description" content="${seoMetaDesc}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${seoMetaDesc}">
    <meta property="og:type" content="website">
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
                <h2>${isPersonalBrand ? "About Me" : "About Us"}</h2>
                <p>${aboutDraft}</p>
            </div>
        </section>

        <section class="services" id="${servicesSectionId}">
            <div class="container">
                <h2>${servicesSectionTitle}</h2>
                <div class="service-grid">
                    ${servicesList.length > 0
                      ? servicesList.map(s => `<div class="service-card">\n                        <h3>${s}</h3>\n                        <p>${describeService(s)}</p>\n                    </div>`).join("\n                    ")
                      : `<div class="service-card">\n                        <h3>[${isSaasType ? "Feature" : "Service"} 1]</h3>\n                        <p>[Description]</p>\n                    </div>\n                    <div class="service-card">\n                        <h3>[${isSaasType ? "Feature" : "Service"} 2]</h3>\n                        <p>[Description]</p>\n                    </div>`}
                </div>
            </div>
        </section>

${extraSections.length > 0 ? extraSections.map(item => `
        <section id="${item.toLowerCase().replace(/\s+/g, "-")}">
            <div class="container">
                <h2>${item}</h2>
                <p>[Add ${item} content here]</p>
            </div>
        </section>`).join("") : ""}
        <section class="cta-section" id="cta">
            <div class="container">
                <h2>${ctaDraft}</h2>
                <a href="#contact" class="btn btn-light">${ctaUpper}</a>
            </div>
        </section>

    </main>

    <footer id="contact">
        <div class="container">
            <h2>Contact</h2>
            ${email ? `<p>Email: <a href="mailto:${email}">${email}</a></p>` : "<!-- Add contact email here -->"}
            ${phone ? `<p>Phone: <a href="tel:${phone}">${phone}</a></p>` : "<!-- Add contact phone here -->"}
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

  // --- Starter CSS ---
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

/* ── ${servicesSectionTitle} ── */

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

  const contactDraft = [
    email ? `Email: ${email}` : null,
    phone ? `Phone: ${phone}` : null,
  ].filter(Boolean).join("\n") || "No contact info provided — add before handing off.";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-8 pb-8 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold">Your Build Prompt</h1>
            <p className="text-muted-foreground mt-1">Copy the prompt below into any AI coding agent. Supporting reference is included beneath it.</p>
          </div>
          <Button variant="outline" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Edit
          </Button>
        </div>

        <CodeCard title="Universal Agent Build Prompt" code={buildPrompt} onCopy={onCopy} language="prompt" />

        <div className="pt-4">
          <h2 className="text-xl font-semibold">Supporting Reference</h2>
          <p className="text-muted-foreground text-sm mt-1">Optional building blocks — the prompt above already contains everything needed to build.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OutputCard title="Suggested Navigation" content={navString} onCopy={onCopy} />
          <OutputCard title="Homepage Section Plan" content={sectionsList.map((s, i) => `${i + 1}. ${s}`).join("\n")} onCopy={onCopy} />
          <OutputCard title="Hero Copy" content={`Headline: ${headline}\n\nSubheadline: ${subheadline}`} onCopy={onCopy} />
          <OutputCard title="About Section Draft" content={aboutDraft} onCopy={onCopy} />
          <OutputCard title={`${servicesSectionTitle} Draft`} content={servicesDraft} onCopy={onCopy} />
          <OutputCard title="Call-to-Action Section" content={ctaDraft} onCopy={onCopy} />
          <OutputCard title="Contact Section" content={contactDraft} onCopy={onCopy} />
          <OutputCard
            title="Technology Stack"
            content={`Selected: ${techStackLabel}\n\nBuild instructions for your AI coding agent:\n${techStackInstructions}`}
            onCopy={onCopy}
          />
          <OutputCard title="Before Build Begins — Content Checklist" content={contentChecklist} onCopy={onCopy} className="md:col-span-2" />
          <OutputCard title="SEO Starter Pack" content={getSeoPack()} onCopy={onCopy} className="md:col-span-2" />
        </div>

        <CodeCard title="Starter HTML" code={htmlDraft} onCopy={onCopy} language="html" />
        <CodeCard title="Starter CSS" code={cssDraft} onCopy={onCopy} language="css" />
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
