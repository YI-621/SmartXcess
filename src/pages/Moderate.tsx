import { useSearchParams } from "react-router-dom";
import { sampleAssessments } from "@/lib/mockData";
import { QuestionCard } from "@/components/moderate/QuestionCard";
import { AssessmentSummary } from "@/components/moderate/AssessmentSummary";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

const Moderate = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") || "a1";
  const assessment = sampleAssessments.find((a) => a.id === id) || sampleAssessments[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{assessment.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {assessment.course} · {assessment.lecturer} · {assessment.date}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button size="sm" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {assessment.questions.map((q, i) => (
            <QuestionCard key={q.id} question={q} index={i} />
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
