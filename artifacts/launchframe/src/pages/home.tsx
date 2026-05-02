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
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                name="audience"
                value={formData.audience}
                onChange={handleInputChange}
                placeholder="e.g. Small business owners in Chicago"
                data-testid="input-audience"
              />
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="pages">Desired Pages</Label>
              <Textarea
                id="pages"
                name="pages"
                value={formData.pages}
                onChange={handleInputChange}
                placeholder="e.g. About, Team, Pricing, Blog"
                data-testid="textarea-pages"
                className="resize-none"
              />
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
  const bizName = businessName || "[Business Name]";
  const orgTypeDisplay = orgType || "[Organization Type]";
  const goalDisplay = goal || "[Goal]";
  const audienceDisplay = audience || "[Audience]";
  const toneDisplay = tone || "[Tone]";
  const ctaDisplay = cta ? cta.toUpperCase() : "[CTA]";

  const pagesList = pages
    ? pages.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  const navItems = ["Home", ...pagesList, "Contact"];
  const navString = navItems.join(" • ");

  const getSectionsForType = (type: string) => {
    switch (type) {
      case "nonprofit": return ["Hero", "Our Mission", "Programs", "Impact/Stories", "Get Involved", "Contact"];
      case "product shop": return ["Hero", "Featured Products", "Categories", "Testimonials", "Newsletter", "Contact"];
      case "personal brand": return ["Hero", "About Me", "Services/Offerings", "Portfolio", "Testimonials", "Contact"];
      case "local service business": return ["Hero", "Services", "Why Choose Us", "Service Area", "Reviews", "Contact"];
      default: return ["Hero", "About", "Services", "Testimonials", "CTA", "Contact"];
    }
  };
  const sectionsList = getSectionsForType(orgType);

  const headline = `${bizName} — Empowering ${audienceDisplay} to ${goalDisplay.toLowerCase()}`;
  const subheadline = `We help ${audienceDisplay} succeed. ${ctaDisplay} today.`;

  const aboutDraft = `${bizName} is a dedicated ${orgTypeDisplay} serving ${audienceDisplay}. Our mission is to ${goalDisplay.toLowerCase()}. We pride ourselves on delivering a ${toneDisplay} experience.`;

  const servicesList = services
    ? services.split(",").map((s) => s.trim()).filter(Boolean)
    : ["[Service 1]", "[Service 2]", "[Service 3]"];
  const servicesDraft = servicesList.map(s => `- ${s}: High-quality support and execution.`).join("\n");

  const ctaDraft = `Ready to get started? Join ${bizName} and let's achieve your goals together.`;

  const contactDraft = `Email: ${email || "hello@example.com"}\nPhone: ${phone || "(555) 123-4567"}`;

  const promptDraft = `Build a responsive multi-page website for a ${orgTypeDisplay} called "${bizName}".
Tone: ${toneDisplay}
Goal: ${goalDisplay}
Target Audience: ${audienceDisplay}

Pages needed: ${navItems.join(", ")}
Key Services/Programs: ${servicesList.join(", ")}
Call to Action: ${ctaDisplay}
Contact Info: ${email}, ${phone}

Instructions:
- Use clean semantic HTML5 and modern CSS (flexbox/grid).
- Make it fully mobile-responsive.
- Include a navigation bar, hero section, about section, services list, and a footer.
- Use a professional layout and styling that fits the "${toneDisplay}" tone.
- Do not use any external frameworks, just pure HTML/CSS.`;

  const htmlDraft = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${bizName}</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body>
    <header>
        <nav class="container">
            <div class="logo">${bizName}</div>
            <ul class="nav-links">
                ${navItems.map(item => `<li><a href="#${item.toLowerCase()}">${item}</a></li>`).join("\n                ")}
            </ul>
        </nav>
    </header>

    <main>
        <section class="hero" id="home">
            <div class="container">
                <h1>${headline}</h1>
                <p>${subheadline}</p>
                <a href="#contact" class="btn btn-primary">${ctaDisplay}</a>
            </div>
        </section>

        <section class="about" id="about">
            <div class="container">
                <h2>About Us</h2>
                <p>${aboutDraft}</p>
            </div>
        </section>

        <section class="services" id="services">
            <div class="container">
                <h2>What We Offer</h2>
                <div class="service-grid">
                    ${servicesList.map(s => `
                    <div class="service-card">
                        <h3>${s}</h3>
                        <p>High-quality support and execution tailored for you.</p>
                    </div>`).join("")}
                </div>
            </div>
        </section>

        <section class="cta-section">
            <div class="container text-center">
                <h2>${ctaDraft}</h2>
                <a href="#contact" class="btn btn-primary">${ctaDisplay}</a>
            </div>
        </section>
    </main>

    <footer id="contact">
        <div class="container">
            <h2>Contact Us</h2>
            <p>Email: <a href="mailto:${email}">${email}</a></p>
            <p>Phone: <a href="tel:${phone}">${phone}</a></p>
            <p>&copy; 2024 ${bizName}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;

  const cssDraft = `:root {
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --bg-color: #f8fafc;
    --text-main: #0f172a;
    --text-muted: #475569;
    --card-bg: #ffffff;
    --font-sans: 'Inter', sans-serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-sans);
    background-color: var(--bg-color);
    color: var(--text-main);
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
}

header {
    background: var(--card-bg);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 100;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 80px;
}

.logo {
    font-weight: 800;
    font-size: 1.5rem;
    color: var(--primary);
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-links a {
    text-decoration: none;
    color: var(--text-muted);
    font-weight: 600;
    transition: color 0.2s;
}

.nav-links a:hover {
    color: var(--primary);
}

.hero {
    padding: 8rem 0;
    text-align: center;
    background: var(--card-bg);
}

.hero h1 {
    font-size: 3.5rem;
    font-weight: 800;
    margin-bottom: 1.5rem;
    line-height: 1.2;
}

.hero p {
    font-size: 1.25rem;
    color: var(--text-muted);
    max-width: 600px;
    margin: 0 auto 2.5rem;
}

.btn {
    display: inline-block;
    padding: 1rem 2rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 600;
    transition: background-color 0.2s;
}

.btn-primary {
    background-color: var(--primary);
    color: white;
}

.btn-primary:hover {
    background-color: var(--primary-hover);
}

section {
    padding: 6rem 0;
}

h2 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
    text-align: center;
}

.about {
    text-align: center;
    max-width: 800px;
    margin: 0 auto;
}

.about p {
    font-size: 1.125rem;
    color: var(--text-muted);
}

.service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.service-card {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    text-align: center;
}

.service-card h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
}

.cta-section {
    background: var(--primary);
    color: white;
}

.cta-section h2 {
    margin-bottom: 2rem;
}

.cta-section .btn-primary {
    background: white;
    color: var(--primary);
}

footer {
    background: var(--text-main);
    color: white;
    text-align: center;
    padding: 4rem 0;
}

footer p {
    color: #cbd5e1;
    margin-bottom: 0.5rem;
}

footer a {
    color: white;
    text-decoration: none;
}

@media (max-width: 768px) {
    .nav-links {
        display: none;
    }
    
    .hero h1 {
        font-size: 2.5rem;
    }
    
    .hero {
        padding: 4rem 0;
    }
    
    section {
        padding: 4rem 0;
    }
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
          <OutputCard title="2. Homepage Sections" content={sectionsList.map((s, i) => `${i + 1}. ${s}`).join("\n")} onCopy={onCopy} />
          <OutputCard title="3. Hero Copy" content={`Headline: ${headline}\n\nSubheadline: ${subheadline}`} onCopy={onCopy} />
          <OutputCard title="4. About Section Draft" content={aboutDraft} onCopy={onCopy} />
          <OutputCard title="5. Services/Programs Draft" content={servicesDraft} onCopy={onCopy} />
          <OutputCard title="6. Call-to-Action Section" content={ctaDraft} onCopy={onCopy} />
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
