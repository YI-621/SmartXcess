import { sampleAssessments } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const statusStyles: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Reviewed: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

export function RecentAssessments() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card animate-fade-in">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-card-foreground">Recent Assessments</h3>
        <button
          onClick={() => navigate("/assessments")}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </button>
      </div>
      <div className="divide-y divide-border">
        {sampleAssessments.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => navigate(`/moderate?id=${a.id}`)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-card-foreground truncate">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.lecturer} · {a.date}</p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <span className="text-xs font-mono text-muted-foreground">{a.questions.length}Q</span>
              <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                {a.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
