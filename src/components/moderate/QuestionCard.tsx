import { type Question, bloomColors, difficultyColors } from "@/lib/mockData";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: Question;
  index: number;
}

function ScoreBar({ label, value, max = 100, variant }: { label: string; value: number; max?: number; variant: "good" | "warn" | "bad" }) {
  const colors = { good: "bg-success", warn: "bg-warning", bad: "bg-destructive" };
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-card-foreground">{value}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", colors[variant])} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export function QuestionCard({ question, index }: QuestionCardProps) {
  const complexityVariant = question.complexity > 70 ? "good" : question.complexity > 40 ? "warn" : "bad";
  const similarityVariant = question.similarityScore > 60 ? "bad" : question.similarityScore > 30 ? "warn" : "good";

  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
            {index + 1}
          </span>
          <p className="text-sm text-card-foreground leading-relaxed">{question.text}</p>
        </div>
        <span className="shrink-0 text-xs font-mono font-medium text-muted-foreground">{question.marks} marks</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary-foreground", bloomColors[question.bloomLevel])}>
          {question.bloomLevel}
        </span>
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary-foreground", difficultyColors[question.difficulty])}>
          {question.difficulty}
        </span>
        {question.keywords.map((kw) => (
          <span key={kw} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {kw}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ScoreBar label="Complexity" value={question.complexity} variant={complexityVariant} />
        <ScoreBar label="Similarity" value={question.similarityScore} variant={similarityVariant} />
      </div>

      {question.similarityScore > 50 && question.similarTo && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/5 border border-warning/20 px-3 py-2">
          <Copy className="h-3.5 w-3.5 text-warning shrink-0" />
          <p className="text-[11px] text-warning">
            High similarity with <span className="font-semibold">{question.similarTo}</span>
          </p>
        </div>
      )}

      {question.complexity < 30 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          <p className="text-[11px] text-destructive">Low complexity — consider increasing cognitive demand.</p>
        </div>
      )}

      {question.complexity >= 50 && question.similarityScore < 30 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
          <p className="text-[11px] text-success">Good originality and complexity.</p>
        </div>
      )}
    </div>
  );
}
