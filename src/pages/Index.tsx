import { FileText, ClipboardCheck, CheckCircle, AlertTriangle, Users, BarChart3, Upload, Flag, Activity, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentAssessments } from "@/components/dashboard/RecentAssessments";
import { BloomDistribution } from "@/components/dashboard/BloomDistribution";
import { useAuth } from "@/hooks/useAuth";
import { useAssessmentsWithQuestions, useActivityLogs, useLecturerCount, useUserModules } from "@/hooks/useData";
import { type BloomLevel, type Assessment } from "@/lib/assessment";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const statusStyles: Record<string, string> = {
  Moderating: "bg-primary/10 text-primary border-primary/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Done: "bg-info/10 text-info border-info/20",
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

const difficultyWeight: Record<Assessment["questions"][number]["difficulty"], number> = {
  "Very Easy": 1,
  Easy: 2,
  Medium: 3,
  Hard: 4,
  "Very Hard": 5,
};

const difficultyFromAverage = (avg: number): Assessment["questions"][number]["difficulty"] => {
  if (avg < 1.5) return "Very Easy";
  if (avg < 2.5) return "Easy";
  if (avg < 3.5) return "Medium";
  if (avg < 4.5) return "Hard";
  return "Very Hard";
};

const normalizeModuleCode = (value: string) => value.trim().toUpperCase();
const isFlaggedQuestion = (q: Assessment["questions"][number]) => q.similarityScore >= 75 || q.complexity < 60;

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
  const done = assessments.filter((a) => a.status === "Approved" || a.status === "Done").length;
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
  const [selectedModuleCode, setSelectedModuleCode] = useState<string | null>(null);
  const { data: dbAssessments, isLoading } = useAssessmentsWithQuestions();
  const { data: dbActivityLogs } = useActivityLogs();
  const { data: lecturerCount } = useLecturerCount();
  const { data: adminModules = [] } = useUserModules();

  const assessments = dbAssessments ?? [];
  const adminModuleCodes = [...new Set(adminModules.map((m) => normalizeModuleCode(m.module_name)))];
  const adminModuleSet = new Set(adminModuleCodes);
  const moduleScopedAssessments = adminModuleSet.size > 0
    ? assessments.filter((a) => adminModuleSet.has(normalizeModuleCode(a.course)))
    : [];

  const moduleSummaryRows = adminModuleCodes.map((moduleCode) => {
    const moduleAssessments = moduleScopedAssessments.filter((a) => normalizeModuleCode(a.course) === moduleCode);
    const moduleQuestions = moduleAssessments.flatMap((a) => a.questions);

    const avgSimilarity = moduleQuestions.length > 0
      ? Math.round(moduleQuestions.reduce((sum, q) => sum + q.similarityScore, 0) / moduleQuestions.length)
      : 0;

    const flaggedAssessments = moduleAssessments.filter((a) => a.flagged || a.questions.some(isFlaggedQuestion));
    const flaggedAssessmentCount = flaggedAssessments.length;
    const flaggedQuestionsInFlaggedAssessments = flaggedAssessments.reduce(
      (sum, assessment) => sum + assessment.questions.filter(isFlaggedQuestion).length,
      0
    );
    const flaggedQuestionShare = moduleQuestions.length > 0
      ? Math.round((flaggedQuestionsInFlaggedAssessments / moduleQuestions.length) * 100)
      : 0;

    const avgDifficultyNumeric = moduleQuestions.length > 0
      ? moduleQuestions.reduce((sum, q) => sum + difficultyWeight[q.difficulty], 0) / moduleQuestions.length
      : 0;

    const avgDifficulty = moduleQuestions.length > 0
      ? difficultyFromAverage(avgDifficultyNumeric)
      : "—";

    const bloomCounts = moduleQuestions.reduce<Record<string, number>>((acc, q) => {
      acc[q.bloomLevel] = (acc[q.bloomLevel] ?? 0) + 1;
      return acc;
    }, {});

    const dominantBloom = Object.entries(bloomCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const pendingAssessments = moduleAssessments.filter((a) => a.status === "Pending").length;

    return {
      moduleCode,
      assessmentsCount: moduleAssessments.length,
      questionCount: moduleQuestions.length,
      avgSimilarity,
      flaggedAssessmentCount,
      flaggedQuestionsInFlaggedAssessments,
      flaggedQuestionShare,
      avgDifficulty,
      avgComplexity: moduleQuestions.length > 0
        ? Math.round(moduleQuestions.reduce((sum, q) => sum + q.complexity, 0) / moduleQuestions.length)
        : 0,
      dominantBloom,
      pendingAssessments,
    };
  });

  const moduleDetailsByCode = adminModuleCodes.reduce<Record<string, {
    statusData: Array<{ name: string; count: number; color: string }>;
    difficultyData: Array<{ name: string; count: number; color: string }>;
    bloomData: Array<{ name: string; count: number; color: string }>;
    topLecturers: Array<{ name: string; count: number }>;
  }>>((acc, moduleCode) => {
    const moduleAssessments = moduleScopedAssessments.filter((a) => normalizeModuleCode(a.course) === moduleCode);
    const moduleQuestions = moduleAssessments.flatMap((a) => a.questions);

    const doneCount = moduleAssessments.filter((a) => ["Done", "Approved", "Rejected"].includes(a.status)).length;

    const statusData = [
      { name: "Pending", count: moduleAssessments.filter((a) => a.status === "Pending").length, color: "hsl(var(--warning))" },
      { name: "Done", count: doneCount, color: "hsl(var(--success))" },
    ];

    const difficultyData = [
      { name: "Very Easy", count: moduleQuestions.filter((q) => q.difficulty === "Very Easy").length, color: "hsl(160, 84%, 39%)" },
      { name: "Easy", count: moduleQuestions.filter((q) => q.difficulty === "Easy").length, color: "hsl(142, 71%, 45%)" },
      { name: "Medium", count: moduleQuestions.filter((q) => q.difficulty === "Medium").length, color: "hsl(38, 92%, 50%)" },
      { name: "Hard", count: moduleQuestions.filter((q) => q.difficulty === "Hard").length, color: "hsl(0, 72%, 51%)" },
      { name: "Very Hard", count: moduleQuestions.filter((q) => q.difficulty === "Very Hard").length, color: "hsl(0, 72%, 35%)" },
    ];

    const bloomData = [
      { name: "Knowledge", count: moduleQuestions.filter((q) => q.bloomLevel === "Knowledge").length, color: "hsl(280, 67%, 50%)" },
      { name: "Comprehension", count: moduleQuestions.filter((q) => q.bloomLevel === "Comprehension").length, color: "hsl(234, 89%, 56%)" },
      { name: "Application", count: moduleQuestions.filter((q) => q.bloomLevel === "Application").length, color: "hsl(199, 89%, 48%)" },
      { name: "Analysis", count: moduleQuestions.filter((q) => q.bloomLevel === "Analysis").length, color: "hsl(142, 71%, 45%)" },
      { name: "Synthesis", count: moduleQuestions.filter((q) => q.bloomLevel === "Synthesis").length, color: "hsl(38, 92%, 50%)" },
      { name: "Evaluation", count: moduleQuestions.filter((q) => q.bloomLevel === "Evaluation").length, color: "hsl(0, 72%, 51%)" },
    ];

    const lecturerCountMap = moduleAssessments.reduce<Record<string, number>>((map, assessment) => {
      map[assessment.lecturer] = (map[assessment.lecturer] ?? 0) + 1;
      return map;
    }, {});

    const topLecturers = Object.entries(lecturerCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    acc[moduleCode] = { statusData, difficultyData, bloomData, topLecturers };
    return acc;
  }, {});

  const selectedModuleSummary = selectedModuleCode
    ? moduleSummaryRows.find((row) => row.moduleCode === selectedModuleCode) ?? null
    : null;
  const selectedModuleDetails = selectedModuleCode
    ? moduleDetailsByCode[selectedModuleCode]
    : undefined;

  const activityLogs = (dbActivityLogs ?? []).map((l) => ({
    id: l.id,
    type: l.type,
    description: l.description,
    user: l.user_name ?? "Unknown",
    timestamp: new Date(l.created_at).toLocaleString(),
  }));

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
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-card-foreground">Module Summary (Under Your Supervision)</h3>
          <Badge variant="outline" className="font-mono">{adminModuleCodes.length} module(s)</Badge>
        </div>

        {adminModuleCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-6">
            No module codes assigned to this admin yet. Add modules in your profile to view module summaries.
          </p>
        ) : moduleSummaryRows.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-6">
            No assessment data found for your assigned module codes.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {moduleSummaryRows.map((row) => (
              <button
                key={row.moduleCode}
                type="button"
                className="w-full text-left px-5 py-4 hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedModuleCode(row.moduleCode)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground font-mono">{row.moduleCode}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {row.assessmentsCount} assessment(s), {row.questionCount} question(s), {row.pendingAssessments} pending
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Badge variant="outline">Avg Similarity: {row.avgSimilarity}%</Badge>
                    <Badge variant="outline">Flagged Assessments: {row.flaggedAssessmentCount}</Badge>
                    <Badge variant="outline">Avg Difficulty: {row.avgDifficulty}</Badge>
                    <Badge variant="outline">Avg Complexity: {row.avgComplexity}%</Badge>
                    <Badge variant="outline">Dominant Bloom: {row.dominantBloom}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
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

      <Dialog open={!!selectedModuleCode} onOpenChange={(open) => !open && setSelectedModuleCode(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Module Summary: {selectedModuleCode}</DialogTitle>
          </DialogHeader>

          {!selectedModuleSummary || !selectedModuleDetails ? (
            <p className="text-sm text-muted-foreground">No summary data available for this module.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={FileText} title="Assessments" value={selectedModuleSummary.assessmentsCount} subtitle="In this module" variant="primary" />
                <StatCard icon={ClipboardCheck} title="Questions" value={selectedModuleSummary.questionCount} subtitle="Total question pool" variant="success" />
                <StatCard icon={Flag} title="Flagged Assessments" value={selectedModuleSummary.flaggedAssessmentCount} subtitle="Assessments with flagged questions" variant="destructive" />
                <StatCard icon={BarChart3} title="Avg Similarity" value={`${selectedModuleSummary.avgSimilarity}%`} subtitle="Module average" variant="warning" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-3">Difficulty Distribution</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={selectedModuleDetails.difficultyData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                        {selectedModuleDetails.difficultyData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-3">Bloom's Taxonomy Distribution</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={selectedModuleDetails.bloomData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                        {selectedModuleDetails.bloomData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-3">Assessment Status Breakdown</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={selectedModuleDetails.statusData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-3">Top Lecturers (By Upload Count)</h4>
                  {selectedModuleDetails.topLecturers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No lecturer upload data for this module.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedModuleDetails.topLecturers.map((lecturer) => (
                        <div key={lecturer.name} className="flex items-center justify-between text-sm">
                          <span className="truncate pr-3">{lecturer.name}</span>
                          <Badge variant="outline">{lecturer.count} upload(s)</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-3">Difficulty Volume by Level</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={selectedModuleDetails.difficultyData.map((item) => ({
                        name: item.name,
                        count: item.count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => [`${value}`, "Questions"]} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-3">Question Health Split</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Flagged", count: selectedModuleSummary.flaggedQuestionsInFlaggedAssessments, color: "hsl(var(--destructive))" },
                          {
                            name: "Clean",
                            count: Math.max(0, selectedModuleSummary.questionCount - selectedModuleSummary.flaggedQuestionsInFlaggedAssessments),
                            color: "hsl(var(--success))",
                          },
                        ]}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name }) => name}
                      >
                        <Cell fill="hsl(var(--destructive))" />
                        <Cell fill="hsl(var(--success))" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
