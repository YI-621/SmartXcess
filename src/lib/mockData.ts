import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Question {
  id: string;
  text: string;
  marks: number;
  bloomLevel: BloomLevel;
  difficulty: Difficulty;
  complexity: number; // 0-100
  similarityScore: number; // 0-100 with historical
  similarTo?: string;
  keywords: string[];
}

export interface Assessment {
  id: string;
  title: string;
  course: string;
  lecturer: string;
  date: string;
  status: "Pending" | "Reviewed" | "Approved" | "Rejected";
  questions: Question[];
  overallScore: number;
}

export const sampleQuestions: Question[] = [
  {
    id: "q1",
    text: "Define the concept of polymorphism in object-oriented programming.",
    marks: 5,
    bloomLevel: "Remember",
    difficulty: "Easy",
    complexity: 22,
    similarityScore: 78,
    similarTo: "CS201 Final 2023 Q3",
    keywords: ["polymorphism", "OOP", "definition"],
  },
  {
    id: "q2",
    text: "Explain how inheritance promotes code reusability with examples.",
    marks: 10,
    bloomLevel: "Understand",
    difficulty: "Medium",
    complexity: 45,
    similarityScore: 42,
    keywords: ["inheritance", "reusability", "examples"],
  },
  {
    id: "q3",
    text: "Implement a binary search tree with insert, delete and search operations.",
    marks: 20,
    bloomLevel: "Apply",
    difficulty: "Hard",
    complexity: 78,
    similarityScore: 15,
    keywords: ["BST", "implementation", "data structures"],
  },
  {
    id: "q4",
    text: "Compare and contrast stack and queue data structures in terms of use cases.",
    marks: 10,
    bloomLevel: "Analyze",
    difficulty: "Medium",
    complexity: 55,
    similarityScore: 61,
    similarTo: "CS101 Midterm 2024 Q7",
    keywords: ["stack", "queue", "comparison"],
  },
  {
    id: "q5",
    text: "Evaluate the efficiency of quicksort vs mergesort for large datasets.",
    marks: 15,
    bloomLevel: "Evaluate",
    difficulty: "Hard",
    complexity: 82,
    similarityScore: 33,
    keywords: ["sorting", "efficiency", "algorithms"],
  },
  {
    id: "q6",
    text: "Design a RESTful API for a library management system.",
    marks: 20,
    bloomLevel: "Create",
    difficulty: "Hard",
    complexity: 90,
    similarityScore: 8,
    keywords: ["REST", "API", "design", "system design"],
  },
];

export const sampleAssessments: Assessment[] = [
  {
    id: "a1",
    title: "CS201 Data Structures Final Exam",
    course: "CS201 - Data Structures",
    lecturer: "Dr. Sarah Chen",
    date: "2026-02-10",
    status: "Pending",
    questions: sampleQuestions,
    overallScore: 72,
  },
  {
    id: "a2",
    title: "CS101 Intro to Programming Midterm",
    course: "CS101 - Intro to Programming",
    lecturer: "Prof. James Miller",
    date: "2026-02-08",
    status: "Approved",
    questions: sampleQuestions.slice(0, 3),
    overallScore: 85,
  },
  {
    id: "a3",
    title: "CS305 Algorithms Quiz 2",
    course: "CS305 - Algorithms",
    lecturer: "Dr. Maria Lopez",
    date: "2026-02-05",
    status: "Reviewed",
    questions: sampleQuestions.slice(2, 5),
    overallScore: 64,
  },
  {
    id: "a4",
    title: "CS410 Software Engineering Assignment",
    course: "CS410 - Software Engineering",
    lecturer: "Prof. David Kim",
    date: "2026-01-28",
    status: "Rejected",
    questions: sampleQuestions.slice(0, 2),
    overallScore: 38,
  },
];

export const bloomColors: Record<BloomLevel, string> = {
  Remember: "bg-bloom-remember",
  Understand: "bg-bloom-understand",
  Apply: "bg-bloom-apply",
  Analyze: "bg-bloom-analyze",
  Evaluate: "bg-bloom-evaluate",
  Create: "bg-bloom-create",
};

export const difficultyColors: Record<Difficulty, string> = {
  Easy: "bg-difficulty-easy",
  Medium: "bg-difficulty-medium",
  Hard: "bg-difficulty-hard",
};

type AssessmentRow = {
  id: string;
  title: string;
  course: string;
  lecturer_name: string;
  assessment_date: string;
  status: "pending" | "reviewed" | "approved" | "rejected";
  overall_score: number;
};

type QuestionRow = {
  id: string;
  assessment_id: string;
  text: string;
  marks: number;
  bloom_level: BloomLevel;
  difficulty: Difficulty;
  complexity: number;
  similarity_score: number;
  similar_to: string | null;
  keywords: string[] | null;
};

const statusToUi = {
  pending: "Pending",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
} as const;

const isMissingTableError = (message?: string) =>
  Boolean(message && (message.includes("does not exist") || message.includes("relation") || message.includes("PGRST")));

async function fetchModerationData(): Promise<Assessment[]> {
  const client = supabase as any;

  const assessmentsRes = await client
    .from("assessments")
    .select("id, title, course, lecturer_name, assessment_date, status, overall_score")
    .order("assessment_date", { ascending: false });

  if (assessmentsRes.error) {
    if (isMissingTableError(assessmentsRes.error.message)) {
      return sampleAssessments;
    }
    throw assessmentsRes.error;
  }

  const assessmentRows = (assessmentsRes.data ?? []) as AssessmentRow[];
  if (assessmentRows.length === 0) {
    return [];
  }

  const questionsRes = await client
    .from("assessment_questions")
    .select("id, assessment_id, text, marks, bloom_level, difficulty, complexity, similarity_score, similar_to, keywords")
    .in("assessment_id", assessmentRows.map((a) => a.id));

  if (questionsRes.error) {
    if (isMissingTableError(questionsRes.error.message)) {
      return sampleAssessments;
    }
    throw questionsRes.error;
  }

  const questionRows = (questionsRes.data ?? []) as QuestionRow[];

  const byAssessment = questionRows.reduce<Record<string, Question[]>>((acc, row) => {
    const mapped: Question = {
      id: row.id,
      text: row.text,
      marks: row.marks,
      bloomLevel: row.bloom_level,
      difficulty: row.difficulty,
      complexity: row.complexity,
      similarityScore: row.similarity_score,
      similarTo: row.similar_to ?? undefined,
      keywords: row.keywords ?? [],
    };
    if (!acc[row.assessment_id]) {
      acc[row.assessment_id] = [];
    }
    acc[row.assessment_id].push(mapped);
    return acc;
  }, {});

  return assessmentRows.map((row) => ({
    id: row.id,
    title: row.title,
    course: row.course,
    lecturer: row.lecturer_name,
    date: row.assessment_date,
    status: statusToUi[row.status],
    overallScore: row.overall_score,
    questions: byAssessment[row.id] ?? [],
  }));
}

export function useModerationData() {
  return useQuery({
    queryKey: ["moderation-data"],
    queryFn: fetchModerationData,
    staleTime: 60_000,
  });
}
