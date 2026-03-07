import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, ArrowRight, BarChart3, Shield, FileText } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <ClipboardCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">AssessMod</span>
        </div>
        <Button onClick={() => navigate("/auth")} variant="outline">
          Sign In
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 gap-8">
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight leading-tight">
            Smarter Assessment
            <br />
            <span className="text-primary">Moderation</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Streamline your assessment review process with AI-powered analysis, Bloom's taxonomy mapping, and collaborative moderation workflows.
          </p>
        </div>

        <div className="flex gap-3">
          <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-3 gap-6 mt-12 max-w-3xl w-full">
          {[
            { icon: FileText, title: "Assessment Upload", desc: "Upload and manage assessments with ease" },
            { icon: BarChart3, title: "Analytics", desc: "Track quality metrics and Bloom's distribution" },
            { icon: Shield, title: "Role-Based Access", desc: "Admin, moderator, and lecturer workflows" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 text-left space-y-2">
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AssessMod. All rights reserved.
      </footer>
    </div>
  );
}
