import { FileText, ClipboardCheck, CheckCircle, AlertTriangle, Users, BarChart3, Upload, Flag, Activity, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentAssessments } from "@/components/dashboard/RecentAssessments";
import { BloomDistribution } from "@/components/dashboard/BloomDistribution";
import { useAuth } from "@/hooks/useAuth";
import { useAssessmentsWithQuestions, useActivityLogs, useLecturerCount } from "@/hooks/useData";
import type { BloomLevel, Assessment } from "@/lib/assessment";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const statusStyles: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Reviewed: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const activityIcons: Record<string, any> = {
  upload: Upload,
  moderation_complete: CheckCircle,
  flagged: Flag,
  approved: CheckCircle,
  rejected: AlertTriangle,
};

const activityColors: Record<string, string> = {
  upload: "text-primary",
  moderation_complete: "text-success",
  flagged: "text-warning",
  approved: "text-success",
  rejected: "text-destructive",
};

function AssessmentDetailDialog({ assessment, open, onClose }: { assessment: Assessment | null; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!assessment) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{assessment.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">Course:</span> <span className="font-medium">{assessment.course}</span></div>
            <div><span className="text-muted-foreground">Date Uploaded:</span> <span className="font-medium">{assessment.date}</span></div>
            <div><span className="text-muted-foreground">Lecturer:</span> <span className="font-medium">{assessment.lecturer}</span></div>
            <div><span className="text-muted-foreground">Moderator:</span> <span className="font-medium">{assessment.moderator ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Overall Score:</span> <span className="font-medium">{assessment.overallScore}%</span></div>
            <div><span className="text-muted-foreground">Questions:</span> <span className="font-medium">{assessment.questions.length}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[assessment.status])}>{assessment.status}</Badge>
          </div>
          {assessment.flagged && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-destructive text-xs font-medium flex items-center gap-1"><Flag className="h-3 w-3" /> {assessment.flagReason}</p>
            </div>
          )}
          <Button
            className="w-full mt-2 gap-2"
            onClick={() => { onClose(); navigate(`/moderate?id=${assessment.id}`); }}
          >
            <ExternalLink className="h-4 w-4" /> View Full Assessment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useChartData(assessments: Assessment[]) {
  const allQuestions = assessments.flatMap((a) => a.questions);

  const bloomData: { name: BloomLevel; count: number; color: string }[] = [
    { name: "Knowledge", count: allQuestions.filter((q) => q.bloomLevel === "Knowledge").length, color: "hsl(280, 67%, 50%)" },
    { name: "Comprehension", count: allQuestions.filter((q) => q.bloomLevel === "Comprehension").length, color: "hsl(234, 89%, 56%)" },
    { name: "Application", count: allQuestions.filter((q) => q.bloomLevel === "Application").length, color: "hsl(199, 89%, 48%)" },
    { name: "Analysis", count: allQuestions.filter((q) => q.bloomLevel === "Analysis").length, color: "hsl(142, 71%, 45%)" },
    { name: "Synthesis", count: allQuestions.filter((q) => q.bloomLevel === "Synthesis").length, color: "hsl(38, 92%, 50%)" },
    { name: "Evaluation", count: allQuestions.filter((q) => q.bloomLevel === "Evaluation").length, color: "hsl(0, 72%, 51%)" },
  ];

  const difficultyData = [
    { name: "Very Easy", count: allQuestions.filter((q) => q.difficulty === "Very Easy").length, color: "hsl(160, 84%, 39%)" },
    { name: "Easy", count: allQuestions.filter((q) => q.difficulty === "Easy").length, color: "hsl(142, 71%, 45%)" },
    { name: "Medium", count: allQuestions.filter((q) => q.difficulty === "Medium").length, color: "hsl(38, 92%, 50%)" },
    { name: "Hard", count: allQuestions.filter((q) => q.difficulty === "Hard").length, color: "hsl(0, 72%, 51%)" },
    { name: "Very Hard", count: allQuestions.filter((q) => q.difficulty === "Very Hard").length, color: "hsl(0, 72%, 35%)" },
  ];

  return { bloomData, difficultyData, allQuestions };
}

function LecturerDashboard() {
  const { data: dbAssessments, isLoading } = useAssessmentsWithQuestions();
  const assessments = dbAssessments ?? [];
  const { bloomData, difficultyData, allQuestions } = useChartData(assessments);

  const pending = assessments.filter((a) => a.status === "Pending").length;
  const done = assessments.filter((a) => a.status === "Approved" || a.status === "Reviewed").length;
  const flagged = allQuestions.filter((q) => q.similarityScore > 50 || q.complexity < 30).length;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} title="Total Assessments" value={assessments.length} subtitle="Uploaded by you" variant="primary" />
        <StatCard icon={ClipboardCheck} title="Pending Review" value={pending} subtitle="Awaiting moderation" variant="warning" />
        <StatCard icon={CheckCircle} title="Done Review" value={done} subtitle="Moderation completed" variant="success" />
        <StatCard icon={AlertTriangle} title="Flagged Issues" value={flagged} subtitle="Across all assessments" variant="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3"><RecentAssessments /></div>
        <div className="lg:col-span-2"><BloomDistribution /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Bloom's Taxonomy Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={bloomData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
                {bloomData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Difficulty Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={difficultyData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
                {difficultyData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function AdminDashboard() {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const { data: dbAssessments, isLoading } = useAssessmentsWithQuestions();
  const { data: dbActivityLogs } = useActivityLogs();
  const { data: lecturerCount } = useLecturerCount();

  const assessments = dbAssessments ?? [];
  const activityLogs = dbActivityLogs && dbActivityLogs.length > 0
    ? dbActivityLogs.map((l) => ({ id: l.id, type: l.type, description: l.description, user: l.user_name ?? "Unknown", timestamp: new Date(l.created_at).toLocaleString() }))
    : [];

  const { bloomData, difficultyData } = useChartData(assessments);

  const pending = assessments.filter((a) => a.status === "Pending").length;
  const flaggedAssessments = assessments.filter((a) => a.flagged);
  const avgScore = assessments.length > 0
    ? Math.round(assessments.reduce((sum, a) => sum + a.overallScore, 0) / assessments.length)
    : 0;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} title="Total Submitted" value={assessments.length} subtitle="For moderation" variant="primary" />
        <StatCard icon={ClipboardCheck} title="Pending Review" value={pending} subtitle="Awaiting moderation" variant="warning" />
        <StatCard icon={Users} title="Lecturers" value={lecturerCount ?? 0} subtitle="Under supervision" variant="success" />
        <StatCard icon={BarChart3} title="Avg Score" value={`${avgScore}%`} subtitle="Submitted assessments" variant="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card animate-fade-in">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-card-foreground">Recent Assessments</h3>
            </div>
            <div className="divide-y divide-border">
              {assessments.slice(0, 10).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedAssessment(a)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.lecturer} · {a.date}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs font-mono text-muted-foreground">{a.questions.length}Q</span>
                    <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>{a.status}</Badge>
                    {a.flagged && <Flag className="h-3 w-3 text-destructive" />}
                  </div>
                </div>
              ))}
              {assessments.length === 0 && <p className="text-sm text-muted-foreground px-5 py-6 text-center">No assessments yet</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card animate-fade-in">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Flag className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-card-foreground">Flagged Assessments</h3>
            </div>
            <div className="divide-y divide-border">
              {flaggedAssessments.length > 0 ? flaggedAssessments.map((a) => (
                <div key={a.id} className="px-5 py-3.5 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedAssessment(a)}>
                  <p className="text-sm font-medium text-card-foreground">{a.title}</p>
                  <p className="text-xs text-destructive mt-1">{a.flagReason}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.lecturer} · {a.date}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground px-5 py-6 text-center">No flagged assessments</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Bloom's Taxonomy Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={bloomData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
                {bloomData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Difficulty Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={difficultyData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
                {difficultyData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card animate-fade-in">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Recent Activity</h3>
        </div>
        <div className="divide-y divide-border">
          {activityLogs.map((log) => {
            const Icon = activityIcons[log.type] || Activity;
            return (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", activityColors[log.type])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-card-foreground">{log.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.user} · {log.timestamp}</p>
                </div>
              </div>
            );
          })}
          {activityLogs.length === 0 && <p className="text-sm text-muted-foreground px-5 py-6 text-center">No activity yet</p>}
        </div>
      </div>

      <AssessmentDetailDialog assessment={selectedAssessment} open={!!selectedAssessment} onClose={() => setSelectedAssessment(null)} />
    </>
  );
}

const Dashboard = () => {
  const { activeRole, roles } = useAuth();
  const role = activeRole ?? roles[0];
  const isAdminView = role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdminView ? "Administrative overview of all assessment activity" : "Overview of your assessment activity"}
        </p>
      </div>
      {isAdminView ? <AdminDashboard /> : <LecturerDashboard />}
    </div>
  );
};

export default Dashboard;
