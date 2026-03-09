import { sampleAssessments, sampleQuestions, type BloomLevel } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const bloomData: { name: BloomLevel; count: number; color: string }[] = [
  { name: "Knowledge", count: sampleQuestions.filter((q) => q.bloomLevel === "Knowledge").length, color: "hsl(280, 67%, 50%)" },
  { name: "Comprehension", count: sampleQuestions.filter((q) => q.bloomLevel === "Comprehension").length, color: "hsl(234, 89%, 56%)" },
  { name: "Application", count: sampleQuestions.filter((q) => q.bloomLevel === "Application").length, color: "hsl(199, 89%, 48%)" },
  { name: "Analysis", count: sampleQuestions.filter((q) => q.bloomLevel === "Analysis").length, color: "hsl(142, 71%, 45%)" },
  { name: "Synthesis", count: sampleQuestions.filter((q) => q.bloomLevel === "Synthesis").length, color: "hsl(38, 92%, 50%)" },
  { name: "Evaluation", count: sampleQuestions.filter((q) => q.bloomLevel === "Evaluation").length, color: "hsl(0, 72%, 51%)" },
];

const difficultyData = [
  { name: "Easy", count: sampleQuestions.filter((q) => q.difficulty === "Easy").length, color: "hsl(142, 71%, 45%)" },
  { name: "Medium", count: sampleQuestions.filter((q) => q.difficulty === "Medium").length, color: "hsl(38, 92%, 50%)" },
  { name: "Hard", count: sampleQuestions.filter((q) => q.difficulty === "Hard").length, color: "hsl(0, 72%, 51%)" },
];

const complexityData = sampleQuestions.map((q, i) => ({
  name: `Q${i + 1}`,
  complexity: q.complexity,
  similarity: q.similarityScore,
}));

const Analytics = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-foreground">Analytics</h2>
      <p className="text-sm text-muted-foreground mt-1">Assessment quality metrics and distributions</p>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Bloom's Taxonomy Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={bloomData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name }) => name}>
              {bloomData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
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
              {difficultyData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 animate-fade-in lg:col-span-2">
        <h3 className="text-sm font-semibold text-card-foreground mb-4">Complexity vs Similarity per Question</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={complexityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="complexity" fill="hsl(234, 89%, 56%)" radius={[4, 4, 0, 0]} name="Complexity" />
            <Bar dataKey="similarity" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="Similarity" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

export default Analytics;
