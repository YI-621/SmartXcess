import { type BloomLevel } from "@/lib/assessment";
import { useAssessmentsWithQuestions } from "@/hooks/useData";

const bloomLevels: { level: BloomLevel; color: string }[] = [
  { level: "Knowledge", color: "hsl(280, 67%, 50%)" },
  { level: "Comprehension", color: "hsl(234, 89%, 56%)" },
  { level: "Application", color: "hsl(199, 89%, 48%)" },
  { level: "Analysis", color: "hsl(142, 71%, 45%)" },
  { level: "Synthesis", color: "hsl(38, 92%, 50%)" },
  { level: "Evaluation", color: "hsl(0, 72%, 51%)" },
];

export function BloomDistribution() {
  const { data: assessments = [] } = useAssessmentsWithQuestions();
  const questions = assessments.flatMap((a) => a.questions);

  const counts = bloomLevels.map((b) => ({
    ...b,
    count: questions.filter((q) => q.bloomLevel === b.level).length,
  }));
  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Bloom's Taxonomy Distribution</h3>
      <div className="space-y-3">
        {counts.map((b) => {
          const pct = total > 0 ? (b.count / total) * 100 : 0;
          const width = b.count > 0 ? `${Math.max(pct, 3)}%` : "0%";

          return (
          <div key={b.level} className="flex items-center gap-3" title={`${b.count} question(s), ${pct.toFixed(1)}%`}>
            <span className="text-xs text-muted-foreground w-24 shrink-0">{b.level}</span>
            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
              {/* Filled bar overlays background */}
              <div
                className="absolute top-0 left-0 h-full rounded-md transition-all duration-700"
                style={{ width, backgroundColor: b.color }}
              />
            </div>
            <span className="text-xs font-mono font-medium text-card-foreground w-6 text-right">{b.count}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
