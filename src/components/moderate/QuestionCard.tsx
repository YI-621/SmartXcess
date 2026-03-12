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

function DifficultyBars({ difficulty }: { difficulty: Question["difficulty"] }) {
  const activeIndex = difficultyIndicatorSteps.findIndex((step) => step.level === difficulty);

  return (
    <div aria-label={`Difficulty indicator: ${difficulty}`} className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">Difficulty</span>
      </div>
      <div className="flex gap-1">
        {difficultyIndicatorSteps.map((step, index) => {
          const isActive = index <= activeIndex;
          return (
            <div key={step.level} className="flex-1">
              <div
                className={cn(
                  "h-2 w-full rounded-sm transition-all",
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


      <div className="grid grid-cols-2 gap-3">
        <DifficultyBars difficulty={question.difficulty} />
        <ScoreBar label="Similarity" value={question.similarityScore} variant={similarityVariant} />
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
