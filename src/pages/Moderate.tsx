import { useSearchParams, useNavigate } from "react-router-dom";
import { QuestionCard } from "@/components/moderate/QuestionCard";
import { AssessmentSummary } from "@/components/moderate/AssessmentSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, ArrowLeft, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useAssessmentWithQuestions, useAssessmentsWithQuestions, useModerationComments, useSaveComment, useUpdateAssessmentStatus, useLogActivity } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Reviewed: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const Moderate = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const id = searchParams.get("id");
  const { toast } = useToast();
  const { user } = useAuth();

  // If no ID selected, show list of assigned assessments
  const { data: allAssessments, isLoading: listLoading } = useAssessmentsWithQuestions();
  const assignedAssessments = allAssessments?.filter((a) => a.status === "Pending" || a.status === "Reviewed") ?? [];

  // Single assessment view
  const { data: dbAssessment, isLoading } = useAssessmentWithQuestions(id);
  const assessment = dbAssessment;

  const questionIds = assessment?.questions.map((q) => q.id) ?? [];
  const { data: dbComments } = useModerationComments(questionIds);
  const saveComment = useSaveComment();
  const updateStatus = useUpdateAssessmentStatus();
  const logActivity = useLogActivity();

  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (dbComments) {
      const map: Record<string, string> = {};
      dbComments.forEach((c) => { map[c.question_id] = c.comment; });
      setComments((prev) => ({ ...map, ...prev }));
    }
  }, [dbComments]);

  const handleCommentChange = (questionId: string, value: string) => {
    setComments((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCommentBlur = (questionId: string) => {
    const comment = comments[questionId];
    if (comment !== undefined) {
      saveComment.mutate({ questionId, comment });
    }
  };

  const handleDone = () => {
    if (id && dbAssessment) {
      updateStatus.mutate({ id, status: "Reviewed" });
      logActivity.mutate({ type: "moderation_complete", description: `${assessment!.title} moderation completed`, assessmentId: id });
      toast({ title: "Assessment marked as reviewed", description: "The lecturer can now see your comments." });
      setSearchParams({});
    }
  };

  // List view - no assessment selected
  if (!id) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Moderate Assessments</h2>
          <p className="text-sm text-muted-foreground mt-1">Assessments assigned to you for moderation</p>
        </div>

        {listLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : assignedAssessments.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No assessments assigned to you yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedAssessments.map((a) => (
              <div
                key={a.id}
                onClick={() => setSearchParams({ id: a.id })}
                className="rounded-xl border border-border bg-card p-5 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors animate-fade-in"
              >
                <div>
                  <p className="text-sm font-medium text-card-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{a.course} · {a.lecturer} · {a.date}</p>
                  <p className="text-xs text-muted-foreground">{a.questions.length} questions · Score: {a.overallScore}%</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                    {a.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail view
  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!assessment) {
    return <div className="text-center py-20 text-muted-foreground">Assessment not found.</div>;
  }

  const isReviewed = assessment.status === "Reviewed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{assessment.title}</h2>
              <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[assessment.status])}>
                {assessment.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {assessment.course} · {assessment.lecturer} · {assessment.date}
            </p>
          </div>
        </div>
        {!isReviewed && (
          <Button size="sm" className="gap-1.5" onClick={handleDone}>
            <CheckCircle className="h-3.5 w-3.5" /> Done
          </Button>
        )}
        {isReviewed && (
          <Badge variant="outline" className="text-xs border-success/20 text-success bg-success/10">
            <CheckCircle className="h-3 w-3 mr-1" /> Completed
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {assessment.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              comment={comments[q.id] || ""}
              onCommentChange={(val) => handleCommentChange(q.id, val)}
              onCommentBlur={() => handleCommentBlur(q.id)}
              readOnly={isReviewed}
            />
          ))}
        </div>
        <div className="space-y-4">
          <AssessmentSummary assessment={assessment} />
        </div>
      </div>
    </div>
  );
};

export default Moderate;
