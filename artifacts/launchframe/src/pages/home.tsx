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

  // All services joined — used for theme detection across the full list
  const allServicesText = servicesList.join(" ").toLowerCase();

  // Try to pull a location/city out of the audience field
  // e.g. "Families in Memphis" → "Memphis"  |  "homeowners in the Dallas area" → "Dallas area"
  const extractLocation = (text: string): string | null => {
    const m = text.match(/\bin\s+(?:the\s+)?([A-Z][a-zA-Z\s\-]+?)(?:\s+(?:area|region|community|metro)|[,.]|$)/);
    return m ? m[1].trim() : null;
  };
  const location = extractLocation(audience);

  // Detect the dominant theme across ALL listed services
  const getServiceTheme = (): string => {
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
    if (/deliver|ship|transport|logistic|courier|dispatch/.test(t)) return "delivery";
    if (/event|wedding|party|celebrat|decor|cater/.test(t)) return "events";
    if (/real.?estate|property|rent|lease|home.?buy|realtor/.test(t)) return "real-estate";
    if (/insur|protect|coverage|policy|claim/.test(t)) return "insurance";
    if (/setup|install|config|support|troubleshoot|tech/.test(t)) return "tech-support";
    return "general";
  };
  const serviceTheme = getServiceTheme();

  // Benefit headline phrase — theme-aware, no "[Service] Done Right"
  const getBenefitHeadline = (): string => {
    const loc = location ? ` in ${location}` : "";
    switch (serviceTheme) {
      case "home-entertainment": return "Simple TV Box Setup & Home Entertainment Support";
      case "tech-support":       return "Friendly Tech Help — Setup, Support & Troubleshooting";
      case "lawn-care":          return location ? `Reliable Lawn Care in ${location}` : "A Yard You Can Be Proud Of";
      case "cleaning":           return location ? `Professional Cleaning Services in ${location}` : "A Cleaner Space Without the Hassle";
      case "plumbing":           return "Fast Plumbing Repairs When You Need Them";
      case "electrical":         return "Safe, Professional Electrical Work You Can Trust";
      case "digital-marketing":  return "Get Found Online and Bring in the Right Customers";
      case "beauty":             return "Look and Feel Your Best — Every Single Visit";
      case "accounting":         return "Financial Clarity So You Can Run Your Business With Confidence";
      case "consulting":         return "Practical Guidance That Moves Your Business Forward";
      case "photography":        return "Visuals That Tell Your Story the Right Way";
      case "design":             return "Design That Represents You and Attracts the Right People";
      case "tutoring":           return "Build Real Skills and Lasting Confidence";
      case "moving":             return `A Smoother Move${loc} — Start to Finish`;
      case "pest-control":       return "Get Rid of Pests and Keep Them Out for Good";
      case "painting":           return "Fresh Paint, Clean Results — On Time and On Budget";
      case "handyman":           return "Reliable Home Repairs Done Right the First Time";
      case "childcare":          return "Safe, Caring Support for Your Child Every Day";
      case "wellness":           return "Practical Health and Fitness Support That Fits Real Life";
      case "legal":              return "Straightforward Legal Help When You Need It Most";
      case "delivery":           return `Dependable Delivery${loc}, On Your Schedule`;
      case "events":             return "Events That Run Smoothly and Feel Effortless";
      case "real-estate":        return `Buy, Sell, or Rent${loc} With Confidence`;
      case "insurance":          return "The Right Coverage, Explained in Plain Language";
      default:                   return location ? `Dependable Service in ${location}` : "Quality Work You Can Count On";
    }
  };

  // Describe a single service item specifically — matched to its name, not a generic fallback
  const describeService = (name: string): string => {
    const n = name.toLowerCase();

    // Home entertainment / media box — ordered from most specific to least
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

    // Lawn & outdoor
    if (/lawn.?care|lawn.?service|lawn.?mainten/.test(n)) return "Consistent, scheduled care that keeps your lawn looking healthy all season.";
    if (/mow|grass.?cut|cut.?grass/.test(n)) return "Reliable mowing on a schedule so your lawn never gets away from you.";
    if (/landscap/.test(n)) return "Custom landscaping design and maintenance that adds real curb appeal.";
    if (/tree.?trim|tree.?remov|tree.?service/.test(n)) return "Safe, clean tree trimming and removal done by experienced hands.";
    if (/mulch|sod|seed|aerat/.test(n)) return "Give your lawn what it needs to grow thick and stay green.";
    if (/pressure.?wash|power.?wash/.test(n)) return "Blast away grime, mold, and buildup from driveways, decks, and siding.";

    // Cleaning
    if (/deep.?clean/.test(n)) return "A thorough top-to-bottom clean that gets the spots regular cleaning misses.";
    if (/move.?in|move.?out|vacant/.test(n)) return "Leave the place spotless — whether you're moving in or handing over the keys.";
    if (/recurring|regular|weekly|bi.?weekly|monthly.?clean/.test(n)) return "Scheduled cleaning so you never have to think about it — just come home to clean.";
    if (/clean|sanitiz|janitorial|housekeep|maid/.test(n)) return "Thorough, dependable cleaning you won't have to think twice about.";

    // Plumbing
    if (/leak.?repair|fix.?leak/.test(n)) return "Stop leaks fast before they turn into bigger, more expensive problems.";
    if (/drain.?clean|unclog|clog/.test(n)) return "Clear clogs and keep your drains flowing without the mess or hassle.";
    if (/water.?heat|boiler/.test(n)) return "Water heater installation and repair to keep hot water running reliably.";
    if (/plumb|pipe|drain|leak|faucet|toilet|sewer/.test(n)) return "Fast, reliable repairs that get your plumbing back to normal.";

    // Electrical
    if (/panel|breaker|circuit/.test(n)) return "Safe panel upgrades and breaker work done to code.";
    if (/outlet|switch|wiring/.test(n)) return "New outlets and switches installed cleanly and safely.";
    if (/light|ceiling.?fan|fixture/.test(n)) return "Lighting and fan installation that improves comfort and saves energy.";
    if (/electric|wiring|generator/.test(n)) return "Code-compliant electrical work done right by licensed professionals.";

    // Tech support (general)
    if (/computer.?setup|laptop.?setup|pc.?setup/.test(n)) return "Get your computer configured, updated, and ready to use from day one.";
    if (/virus|malware|security.?scan/.test(n)) return "Scan, clean, and protect your device against threats and slowdowns.";
    if (/wi.?fi|wifi|router|network/.test(n)) return "Get your home or office network set up and connected reliably.";
    if (/phone.?setup|phone.?transfer|data.?transfer/.test(n)) return "Move your contacts, photos, and apps to a new phone without losing anything.";
    if (/printer|scanner/.test(n)) return "Get your printer or scanner connected and working — no more error messages.";
    if (/tech.?support|it.?support|computer.?help/.test(n)) return "Friendly, no-jargon help for everyday tech problems and questions.";

    // Digital marketing / web
    if (/seo/.test(n)) return "Improve your search rankings so the right people can find you online.";
    if (/social.?media|instagram|facebook/.test(n)) return "Consistent, on-brand content that grows your following and drives engagement.";
    if (/google.?ads|ppc|paid.?ads/.test(n)) return "Targeted ad campaigns that bring in leads without wasting your budget.";
    if (/email.?market/.test(n)) return "Email campaigns that stay in touch with customers and bring them back.";
    if (/website|web.?design|web.?dev/.test(n)) return "A professional website that represents your business and converts visitors.";

    // Beauty & wellness
    if (/haircut|hairstyle|color|highlight|balayage/.test(n)) return "Expert cuts and color in a relaxed, welcoming environment.";
    if (/nail|manicure|pedicure/.test(n)) return "Clean, polished nails — done carefully and with quality products.";
    if (/massage|deep.?tissue|swedish/.test(n)) return "Relieving tension and stress so you leave feeling noticeably better.";
    if (/facial|skin|peel/.test(n)) return "Skin treatments tailored to your specific concerns and skin type.";
    if (/lash|brow|wax/.test(n)) return "Precise, clean shaping that frames your face perfectly.";

    // Fitness & wellness
    if (/personal.?train|one.?on.?one.?train/.test(n)) return "Customized workouts with hands-on coaching to hit your specific goals.";
    if (/yoga|pilates/.test(n)) return "Structured classes that improve flexibility, strength, and mental clarity.";
    if (/nutrit|meal.?plan|diet/.test(n)) return "Practical nutrition guidance you can actually stick to in real life.";

    // Accounting / finance
    if (/tax.?prep|tax.?return|file.?tax/.test(n)) return "Accurate tax filing that maximizes your return and keeps you compliant.";
    if (/bookkeep/.test(n)) return "Organized, up-to-date books so you always know where your money stands.";
    if (/payroll/.test(n)) return "Payroll handled on time, every time — no missed payments, no penalties.";
    if (/financ.?plan|budget|forecast/.test(n)) return "Clear financial planning so you can make confident business decisions.";

    // Childcare & education
    if (/tutoring|homework.?help|test.?prep/.test(n)) return "Patient, effective instruction that builds real understanding and confidence.";
    if (/daycar|childcar|babysit/.test(n)) return "Safe, attentive care your child will look forward to.";
    if (/after.?school/.test(n)) return "Supervised, structured care between school and home pickup.";

    // Moving & logistics
    if (/pack|unpack/.test(n)) return "Careful packing and unpacking so nothing gets lost or damaged.";
    if (/junk.?remov|haul.?away|trash/.test(n)) return "Fast haul-away of unwanted items — you point, we take it.";
    if (/storage/.test(n)) return "Secure short- or long-term storage while you're between spaces.";
    if (/mov/.test(n)) return "Efficient, careful moving that takes the stress out of the whole process.";

    // Home improvement
    if (/paint.?interior|interior.?paint/.test(n)) return "Clean, even coats that transform a room without the mess or fumes.";
    if (/paint.?exterior|exterior.?paint/.test(n)) return "Weatherproof exterior painting that protects your home and improves curb appeal.";
    if (/drywall/.test(n)) return "Seamless drywall repair and installation with a smooth, paint-ready finish.";
    if (/flooring|hardwood|tile.?install/.test(n)) return "Durable flooring installed correctly so it looks great and lasts.";
    if (/roof|gutter/.test(n)) return "Roof and gutter work that protects your home from water damage.";
    if (/fence|deck|patio/.test(n)) return "Outdoor structures built to last through years of weather and use.";
    if (/handyman|odd.?job|home.?repair/.test(n)) return "Small fixes and projects handled quickly so they stop being on your to-do list.";

    // Delivery
    if (/same.?day/.test(n)) return "Same-day delivery for time-sensitive orders and urgent pickups.";
    if (/deliver|ship|courier/.test(n)) return "Reliable pickup and delivery, tracked and on schedule.";

    // Events
    if (/wedding/.test(n)) return "Full coordination and day-of support so you can enjoy every moment of your wedding.";
    if (/cater/.test(n)) return "Fresh, made-to-order food that feeds your guests and impresses every time.";
    if (/decor|floral|design/.test(n)) return "Custom event styling that turns any venue into the right atmosphere.";
    if (/photo.?booth|entertai/.test(n)) return "Fun, memorable entertainment that keeps guests engaged all night.";

    // Real estate
    if (/buy|purchas/.test(n)) return "Guided support through the buying process so you make a confident, informed decision.";
    if (/sell|list/.test(n)) return "Strategic pricing and marketing to sell your property quickly and at full value.";
    if (/rent|property.?manag/.test(n)) return "Hassle-free rental management — tenant screening, maintenance, and collections.";

    // Legal
    if (/notary/.test(n)) return "Fast, professional notarization for documents that need to be official.";
    if (/contract/.test(n)) return "Contracts reviewed and drafted clearly so you know exactly what you're agreeing to.";
    if (/estate.?plan|will|trust/.test(n)) return "Protect your assets and family's future with a clear, properly structured plan.";

    // Generic fallback — still specific to the name
    return `Professional ${name.toLowerCase()} — handled with care and attention to detail.`;
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

  // --- Hero headline: benefit-focused using detected service theme ---
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const getHeadline = (): string => {
    if (isMenuContext) {
      // Use the first food item if available, otherwise generic
      return coreService
        ? `${bizName} — ${cap(coreService)} Worth Coming Back For`
        : `${bizName} — Fresh Food, Honest Flavor`;
    }
    switch (orgType) {
      case "nonprofit":
        return cleanGoal
          ? `${bizName} — ${cap(cleanGoal)}`
          : `${bizName} — Making a Lasting Difference`;
      case "local service business":
        // Always use theme-based benefit phrase — never "[Service] Done Right"
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
                      ? servicesList.map(s => `<div class="service-card">\n                        <h3>${s}</h3>\n                        <p>${describeService(s)}</p>\n                    </div>`).join("\n                    ")
                      : `<div class="service-card">\n                        <h3>[Service 1]</h3>\n                        <p>[Service description]</p>\n                    </div>\n                    <div class="service-card">\n                        <h3>[Service 2]</h3>\n                        <p>[Service description]</p>\n                    </div>`}
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
