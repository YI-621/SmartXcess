import { sampleAssessments } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Reviewed: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const HistoryPage = () => {
  const history = sampleAssessments.filter((a) => a.status === "Approved" || a.status === "Rejected");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Moderation History</h2>
        <p className="text-sm text-muted-foreground mt-1">Previously moderated assessments</p>
      </div>

      <div className="space-y-3">
        {history.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-5 flex items-center justify-between animate-fade-in">
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
