import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Filter } from "lucide-react";
import { useState } from "react";
import { useAssessmentsWithQuestions } from "@/hooks/useData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusStyles: Record<string, string> = {
  Moderating: "bg-primary/10 text-primary border-primary/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Done: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const AdminAssessments = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: dbAssessments, isLoading } = useAssessmentsWithQuestions();
  const assessments = dbAssessments ?? [];

  const filtered = assessments.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.lecturer.toLowerCase().includes(search.toLowerCase()) ||
      a.course.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ["all", ...new Set(assessments.map((a) => a.status))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">All Assessments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of all assessments uploaded for moderation
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, lecturer, or module..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Title", "Module", "Lecturer", "Moderator", "Date", "Questions", "Score", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/assessment-detail?id=${a.id}`)}
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-card-foreground">{a.title}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.course}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{a.lecturer}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{a.moderator ?? "Unassigned"}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.date}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.questions.length}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "text-sm font-bold font-mono",
                        a.overallScore >= 70 ? "text-success" : a.overallScore >= 50 ? "text-warning" : "text-destructive"
                      )}
                    >
                      {a.overallScore}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                      {a.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No assessments found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAssessments;
