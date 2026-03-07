import { useState } from "react";
import { sampleAssessments } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QuestionCard } from "@/components/moderate/QuestionCard";
import { AssessmentSummary } from "@/components/moderate/AssessmentSummary";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Pencil } from "lucide-react";

const statusStyles: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Reviewed: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const HistoryPage = () => {
  // Simulate: Approved/Reviewed = done (read-only), Pending = can continue moderating
  const history = sampleAssessments.filter(
    (a) => a.status === "Approved" || a.status === "Rejected" || a.status === "Reviewed"
  );
  const inProgress = sampleAssessments.filter((a) => a.status === "Pending");

  const allItems = [
    ...inProgress.map((a) => ({ ...a, isDone: false })),
    ...history.map((a) => ({ ...a, isDone: true })),
  ];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const selected = allItems.find((a) => a.id === selectedId);

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h2 className="text-xl font-bold text-foreground">{selected.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selected.course} · {selected.lecturer} · {selected.date}
              </p>
            </div>
          </div>
          {selected.isDone && (
            <Badge variant="outline" className="text-xs border-success/20 text-success bg-success/10">
              <CheckCircle className="h-3 w-3 mr-1" /> Completed
            </Badge>
          )}
          {!selected.isDone && (
            <Button size="sm" className="gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Done
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {selected.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                comment={comments[q.id] || ""}
                onCommentChange={(val) =>
                  !selected.isDone && setComments((prev) => ({ ...prev, [q.id]: val }))
                }
                readOnly={selected.isDone}
              />
            ))}
          </div>
          <div className="space-y-4">
            <AssessmentSummary assessment={selected} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Moderation History</h2>
        <p className="text-sm text-muted-foreground mt-1">Previously moderated assessments</p>
      </div>

      {inProgress.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">In Progress</h3>
          {inProgress.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="rounded-xl border border-warning/20 bg-card p-5 flex items-center justify-between animate-fade-in cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-card-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.lecturer} · {a.course} · {a.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <Pencil className="h-3.5 w-3.5 text-warning" />
                <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                  {a.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Completed</h3>
        {history.map((a) => (
          <div
            key={a.id}
            onClick={() => setSelectedId(a.id)}
            className="rounded-xl border border-border bg-card p-5 flex items-center justify-between animate-fade-in cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-card-foreground">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.lecturer} · {a.course} · {a.date}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn("text-sm font-bold font-mono", a.overallScore >= 70 ? "text-success" : a.overallScore >= 50 ? "text-warning" : "text-destructive")}>
                {a.overallScore}%
              </span>
              <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                {a.status}
              </Badge>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No history yet.</div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
