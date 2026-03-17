import { type Assessment } from "@/lib/assessment";
import { cn } from "@/lib/utils";

interface AssessmentSummaryProps {
  assessment: Assessment;
}

export function AssessmentSummary({ assessment }: AssessmentSummaryProps) {
  const avgComplexity = Math.round(assessment.questions.reduce((s, q) => s + q.complexity, 0) / assessment.questions.length);
  const avgSimilarity = Math.round(assessment.questions.reduce((s, q) => s + q.similarityScore, 0) / assessment.questions.length);

  const internalSimilarityValues = assessment.questions
    .map((q) => q.moderationDetails?.internal_similarity_score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const externalSimilarityValues = assessment.questions
    .map((q) => q.moderationDetails?.external_similarity_score)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const avgInternalSimilarity = internalSimilarityValues.length
    ? Math.round(internalSimilarityValues.reduce((sum, value) => sum + value, 0) / internalSimilarityValues.length)
    : avgSimilarity;

  const avgExternalSimilarity = externalSimilarityValues.length
    ? Math.round(externalSimilarityValues.reduce((sum, value) => sum + value, 0) / externalSimilarityValues.length)
    : avgSimilarity;

  const bloomCoverage = new Set(assessment.questions.map((q) => q.bloomLevel)).size;

  const difficultyScoreMap = {
    "Very Easy": 1,
    Easy: 2,
    Medium: 3,
    Hard: 4,
    "Very Hard": 5,
  } as const;

  const avgDifficultyScore = assessment.questions.length
    ? assessment.questions.reduce((sum, q) => sum + difficultyScoreMap[q.difficulty], 0) / assessment.questions.length
    : 3;

  const avgDifficultyLabel =
    avgDifficultyScore < 1.5
      ? "Very Easy"
      : avgDifficultyScore < 2.5
        ? "Easy"
        : avgDifficultyScore < 3.5
          ? "Medium"
          : avgDifficultyScore < 4.5
            ? "Hard"
            : "Very Hard";

  const scoreColor = assessment.overallScore >= 70 ? "text-success" : assessment.overallScore >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">Moderation Summary</h3>
        <span className={cn("text-2xl font-bold font-mono", scoreColor)}>{assessment.overallScore}%</span>
      </div>

      {assessment.flagged && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <p className="text-xs font-semibold text-destructive">Flagged Assessment</p>
          {assessment.flagReason && <p className="text-[11px] text-destructive/90 mt-0.5">{assessment.flagReason}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-center">
        {[
          {
            label: "Questions",
            value: assessment.questions.length,
            description: "Total number of extracted questions analyzed in this assessment.",
          },
          {
            label: "Avg Complexity",
            value: `${avgComplexity}%`,
            description: "Average cognitive complexity score across all questions. Higher means more demanding questions.",
          },
          {
            label: "Avg Internal Similarity",
            value: `${avgInternalSimilarity}%`,
            description: "Average similarity against internal question sources. Higher values indicate more overlap with your institution's repository.",
          },
          {
            label: "Avg External Similarity",
            value: `${avgExternalSimilarity}%`,
            description: "Average similarity against external/public sources. External similarity is not examined when internal similarity exceeds the preset threshold.",
          },
          {
            label: "Bloom Levels",
            value: `${bloomCoverage}/6`,
            description: "How many Bloom taxonomy levels are covered by this paper out of 6 possible levels.",
          },
          {
            label: "Avg Difficulty",
            value: avgDifficultyLabel,
            description: "Overall difficulty band based on all question-level difficulty ratings.",
          },
        ].map((s) => (
          <div key={s.label} title={s.description} className="rounded-lg bg-muted/50 p-3 cursor-help">
            <p className="text-lg font-bold font-mono text-card-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
