import { type Question } from "@/lib/assessment";
import { AlertTriangle, CheckCircle2, MessageSquare, FileWarning, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: Question;
  index: number;
  comment?: string;
  onCommentChange?: (value: string) => void;
  onCommentBlur?: () => void;
  readOnly?: boolean;
}

const difficultyIndicatorSteps: Array<{ level: Question["difficulty"]; color: string }> = [
  { level: "Very Easy", color: "bg-emerald-400" },
  { level: "Easy", color: "bg-green-500" },
  { level: "Medium", color: "bg-yellow-500" },
  { level: "Hard", color: "bg-orange-500" },
  { level: "Very Hard", color: "bg-red-500" },
];

const relevancySteps = [
  { label: "Very Low", color: "bg-red-500" },
  { label: "Low", color: "bg-orange-500" },
  { label: "Medium", color: "bg-yellow-500" },
  { label: "High", color: "bg-green-500" },
  { label: "Very High", color: "bg-emerald-500" },
] as const;

function normalizeRelevancy(raw: unknown): { label: string; index: number } {
  const byIndex = (index: number): { label: string; index: number } => {
    const clamped = Math.max(0, Math.min(4, index));
    return { label: relevancySteps[clamped].label, index: clamped };
  };

  if (raw === null || raw === undefined) {
    return { label: "N/A", index: -1 };
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Primary mapping: DB int8 scale (1-5 => Very Low..Very High).
    if (raw >= 1 && raw <= 5) {
      return byIndex(Math.round(raw) - 1);
    }

    // Secondary mapping if DB stores zero-based buckets (0-4).
    if (raw >= 0 && raw <= 4) {
      return byIndex(Math.round(raw));
    }

    // Fallback mapping for percentage-like values.
    const score = Math.max(0, Math.min(100, raw));
    if (score >= 85) return { label: "Very High", index: 4 };
    if (score >= 65) return { label: "High", index: 3 };
    if (score >= 40) return { label: "Medium", index: 2 };
    if (score >= 20) return { label: "Low", index: 1 };
    return { label: "Very Low", index: 0 };
  }

  const value = String(raw).trim();
  if (!value || value.toLowerCase() === "n/a") {
    return { label: "N/A", index: -1 };
  }

  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric)) {
    return normalizeRelevancy(numeric);
  }

  const lowered = value.toLowerCase();
  const pctMatch = lowered.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const pct = Number.parseFloat(pctMatch[1]);
    if (pct >= 85) return { label: "Very High", index: 4 };
    if (pct >= 65) return { label: "High", index: 3 };
    if (pct >= 40) return { label: "Medium", index: 2 };
    if (pct >= 20) return { label: "Low", index: 1 };
    return { label: "Very Low", index: 0 };
  }

  if (lowered.includes("very high") || lowered.includes("highly relevant")) return { label: "Very High", index: 4 };
  if (lowered.includes("high") || lowered.includes("relevant")) return { label: "High", index: 3 };
  if (lowered.includes("medium") || lowered.includes("moderate")) return { label: "Medium", index: 2 };
  if (lowered.includes("very low") || lowered.includes("irrelevant")) return { label: "Very Low", index: 0 };
  if (lowered.includes("low")) return { label: "Low", index: 1 };

  return { label: "Medium", index: 2 };
}

function DifficultyBars({ difficulty }: { difficulty: Question["difficulty"] }) {
  const activeIndex = difficultyIndicatorSteps.findIndex((step) => step.level === difficulty);

  return (
    <div aria-label={`Difficulty indicator: ${difficulty}`} className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">Difficulty</span>
        <span className="font-medium text-card-foreground">{difficulty}</span>
      </div>
      <div className="flex gap-1">
        {difficultyIndicatorSteps.map((step, index) => {
          const isActive = index <= activeIndex;
          return (
            <div key={step.level} className="flex-1">
              <div
                title={step.level}
                className={cn(
                  "h-2 w-full rounded-sm transition-all cursor-help",
                  isActive ? step.color : "bg-muted",
                  index === activeIndex && "ring-1 ring-offset-1 ring-offset-background ring-foreground/30"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
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

export function QuestionCard({ question, index, comment, onCommentChange, onCommentBlur, readOnly }: QuestionCardProps) {
  const similarityScore = question.similarityScore ?? 0;
  const similarityType = question.moderationDetails?.similarity_type_used ?? "overall";
  const similarityVariant = similarityScore > 60 ? "bad" : similarityScore > 30 ? "warn" : "good";
  const relevancy = normalizeRelevancy(question.moderationDetails?.relevancy_to_scope);

  return (

    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
            {index + 1}
          </span>
          <p className="text-sm text-card-foreground leading-relaxed">{question.text}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DifficultyBars difficulty={question.difficulty} />
        <ScoreBar label={`Similarity (${similarityType})`} value={similarityScore} variant={similarityVariant} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div aria-label={`Relevancy to scope indicator: ${relevancy.label}`} className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Relevancy to Scope</span>
            <span className="font-medium text-card-foreground">{relevancy.label}</span>
          </div>
          <div className="flex gap-1">
            {relevancySteps.map((step, idx) => {
              const isActive = idx <= relevancy.index;
              return (
                <div key={step.label} className="flex-1">
                  <div
                    title={step.label}
                    className={cn(
                      "h-2 w-full rounded-sm transition-all cursor-help",
                      isActive ? step.color : "bg-muted",
                      idx === relevancy.index && "ring-1 ring-offset-1 ring-offset-background ring-foreground/30"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="text-[10px] mb-2 text-muted-foreground">Bloom Analysis</div>
          <div className="flex items-end justify-between gap-3 min-h-[28px]">
            <span className="text-[12px] font-medium text-card-foreground">{question.bloomLevel}</span>
            <span className="text-[11px] text-card-foreground text-right">
              {question.keywords.length > 0 ? question.keywords.join(", ") : "No validated keywords"}
            </span>
          </div>
        </div>
      </div>

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

      {/* Moderation Details from AI */}
      {question.moderationDetails && (
        <div className="mt-3 space-y-2">
          {(question.moderationDetails.grammar_structure && question.moderationDetails.grammar_structure !== "N/A") ||
          (question.moderationDetails.grammar_errors && question.moderationDetails.grammar_errors !== "N/A" && question.moderationDetails.grammar_errors !== "None") ? (
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <FileWarning className="h-3.5 w-3.5 text-warning" />
                  <p className="text-[10px] font-semibold text-warning">Grammar Structure</p>
                </div>
                <p className="text-[11px] text-warning">
                  {question.moderationDetails.grammar_structure && question.moderationDetails.grammar_structure !== "N/A"
                    ? question.moderationDetails.grammar_structure
                    : "No issues detected."}
                </p>
              </div>

              <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <FileWarning className="h-3.5 w-3.5 text-warning" />
                  <p className="text-[10px] font-semibold text-warning">Grammar Spelling Error</p>
                </div>
                <p className="text-[11px] text-warning">
                  {question.moderationDetails.grammar_errors && question.moderationDetails.grammar_errors !== "N/A" && question.moderationDetails.grammar_errors !== "None"
                    ? question.moderationDetails.grammar_errors
                    : "No issues detected."}
                </p>
              </div>
            </div>
          ) : null}

          {question.moderationDetails.suggestion && question.moderationDetails.suggestion !== "N/A" && (
            <div className="flex items-start gap-2 rounded-lg bg-info/5 border border-info/20 px-3 py-2">
              <Lightbulb className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-info mb-0.5">Suggested Revision</p>
                <p className="text-[11px] text-info">{question.moderationDetails.suggestion}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {onCommentChange && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Moderator Comment</span>
          </div>
          {readOnly ? (
            <p className="text-sm text-muted-foreground italic">{comment || "No comment provided."}</p>
          ) : (
            <textarea
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              onBlur={onCommentBlur}
              placeholder="Add a comment for this question..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[60px]"
            />
          )}
        </div>
      )}
    </div>
  );
}
