import { type Assessment } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface AssessmentSummaryProps {
  assessment: Assessment;
}

export function AssessmentSummary({ assessment }: AssessmentSummaryProps) {
  const totalMarks = assessment.questions.reduce((s, q) => s + q.marks, 0);
  const avgComplexity = Math.round(assessment.questions.reduce((s, q) => s + q.complexity, 0) / assessment.questions.length);
  const avgSimilarity = Math.round(assessment.questions.reduce((s, q) => s + q.similarityScore, 0) / assessment.questions.length);
  const bloomCoverage = new Set(assessment.questions.map((q) => q.bloomLevel)).size;

  const scoreColor = assessment.overallScore >= 70 ? "text-success" : assessment.overallScore >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">Moderation Summary</h3>
        <span className={cn("text-2xl font-bold font-mono", scoreColor)}>{assessment.overallScore}%</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-center">
        {[
          { label: "Questions", value: assessment.questions.length },
          { label: "Total Marks", value: totalMarks },
          { label: "Avg Complexity", value: `${avgComplexity}%` },
          { label: "Avg Similarity", value: `${avgSimilarity}%` },
          { label: "Bloom Levels", value: `${bloomCoverage}/6` },
          { label: "Difficulty Mix", value: `${new Set(assessment.questions.map((q) => q.difficulty)).size}/3` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/50 p-3">
            <p className="text-lg font-bold font-mono text-card-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
