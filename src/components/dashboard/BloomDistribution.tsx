import { sampleQuestions, type BloomLevel } from "@/lib/mockData";

const bloomLevels: { level: BloomLevel; color: string }[] = [
  { level: "Remember", color: "bg-bloom-remember" },
  { level: "Understand", color: "bg-bloom-understand" },
  { level: "Apply", color: "bg-bloom-apply" },
  { level: "Analyze", color: "bg-bloom-analyze" },
  { level: "Evaluate", color: "bg-bloom-evaluate" },
  { level: "Create", color: "bg-bloom-create" },
];

export function BloomDistribution() {
  const counts = bloomLevels.map((b) => ({
    ...b,
    count: sampleQuestions.filter((q) => q.bloomLevel === b.level).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Bloom's Taxonomy Distribution</h3>
      <div className="space-y-3">
        {counts.map((b) => (
          <div key={b.level} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 shrink-0">{b.level}</span>
            <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
              <div
                className={`${b.color} h-full rounded-md transition-all duration-700`}
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono font-medium text-card-foreground w-6 text-right">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
