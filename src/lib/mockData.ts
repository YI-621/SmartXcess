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
