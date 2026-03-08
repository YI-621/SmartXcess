export type BloomLevel = "Knowledge" | "Comprehension" | "Application" | "Analysis" | "Synthesis" | "Evaluation";
export type Difficulty = "Very Easy" | "Easy" | "Medium" | "Hard" | "Very Hard";

export interface ModerationDetails {
  question_id?: string;
  grammar_errors?: string;
  grammar_structure?: string;
  relevancy_to_scope?: string;
  suggestion?: string;
  validated_bloom_keywords?: string;
  raw_complexity?: string;
}

export interface Question {
  id: string;
  text: string;
  marks: number;
  bloomLevel: BloomLevel;
  difficulty: Difficulty;
  complexity: number;
  similarityScore: number;
  similarTo?: string;
  keywords: string[];
  moderationDetails?: ModerationDetails;
}

export interface ExamQuestion {
  id: number;
  question_id: string;
  question_text: string;
}

export interface Assessment {
  id: string;
  title: string;
  course: string;
  lecturer: string;
  moderator?: string;
  date: string;
  status: "Pending" | "Reviewed" | "Approved" | "Rejected";
  questions: Question[];
  overallScore: number;
  flagged?: boolean;
  flagReason?: string;
}

export interface ActivityLog {
  id: string;
  type: "upload" | "moderation_complete" | "flagged" | "approved" | "rejected";
  description: string;
  user: string;
  timestamp: string;
}

export const sampleQuestions: Question[] = [
  {
    id: "q1",
    text: "Business performance in challenging economic conditions.",
    marks: 5,
    bloomLevel: "Knowledge",
    difficulty: "Very Easy",
    complexity: 12,
    similarityScore: 78,
    similarTo: "CS201 Final 2023 Q3",
    keywords: ["business", "performance", "economics"],
  },
  {
    id: "q2",
    text: "Widespread adoption of new Information Technology.",
    marks: 10,
    bloomLevel: "Comprehension",
    difficulty: "Easy",
    complexity: 35,
    similarityScore: 42,
    keywords: ["IT", "adoption", "technology"],
  },
  {
    id: "q3",
    text: "Information systems do not create value directly.",
    marks: 20,
    bloomLevel: "Application",
    difficulty: "Hard",
    complexity: 78,
    similarityScore: 15,
    keywords: ["information systems", "value creation"],
  },
  {
    id: "q4",
    text: "Threat of entry of new competitors is one of Porter's Five Forces.",
    marks: 10,
    bloomLevel: "Analysis",
    difficulty: "Medium",
    complexity: 55,
    similarityScore: 61,
    similarTo: "BUS101 Midterm 2024 Q7",
    keywords: ["Porter", "five forces", "competition"],
  },
  {
    id: "q5",
    text: "Threat of bargaining power of suppliers.",
    marks: 15,
    bloomLevel: "Synthesis",
    difficulty: "Hard",
    complexity: 82,
    similarityScore: 33,
    keywords: ["suppliers", "bargaining power", "strategy"],
  },
  {
    id: "q6",
    text: "State TWO reasons why a seemingly well-run organization might fail.",
    marks: 20,
    bloomLevel: "Evaluation",
    difficulty: "Very Hard",
    complexity: 95,
    similarityScore: 8,
    keywords: ["organizational failure", "management", "analysis"],
  },
];

export const sampleAssessments: Assessment[] = [
  {
    id: "a1",
    title: "BUS201 Strategic Management Final Exam",
    course: "BUS201 - Strategic Management",
    lecturer: "Dr. Sarah Chen",
    moderator: "Dr. Alan Tan",
    date: "2026-02-10",
    status: "Pending",
    questions: sampleQuestions,
    overallScore: 72,
    flagged: true,
    flagReason: "High similarity detected in Q1 (78%)",
  },
  {
    id: "a2",
    title: "BUS101 Intro to Business Midterm",
    course: "BUS101 - Intro to Business",
    lecturer: "Prof. James Miller",
    moderator: "Dr. Lisa Wong",
    date: "2026-02-08",
    status: "Approved",
    questions: sampleQuestions.slice(0, 3),
    overallScore: 85,
  },
  {
    id: "a3",
    title: "IS305 Information Systems Quiz 2",
    course: "IS305 - Information Systems",
    lecturer: "Dr. Maria Lopez",
    moderator: "Dr. Alan Tan",
    date: "2026-02-05",
    status: "Reviewed",
    questions: sampleQuestions.slice(2, 5),
    overallScore: 64,
    flagged: true,
    flagReason: "Low complexity in multiple questions",
  },
  {
    id: "a4",
    title: "MGT410 Project Management Assignment",
    course: "MGT410 - Project Management",
    lecturer: "Prof. David Kim",
    moderator: "Dr. Lisa Wong",
    date: "2026-01-28",
    status: "Rejected",
    questions: sampleQuestions.slice(0, 2),
    overallScore: 38,
    flagged: true,
    flagReason: "Overall score below threshold (38%)",
  },
];

export const sampleActivityLogs: ActivityLog[] = [
  { id: "log1", type: "upload", description: "BUS201 Strategic Management Final Exam uploaded", user: "Dr. Sarah Chen", timestamp: "2026-02-10 14:30" },
  { id: "log2", type: "moderation_complete", description: "BUS101 Intro to Business Midterm moderation completed", user: "Dr. Lisa Wong", timestamp: "2026-02-09 10:15" },
  { id: "log3", type: "flagged", description: "IS305 Information Systems Quiz 2 flagged for low complexity", user: "System", timestamp: "2026-02-06 09:00" },
  { id: "log4", type: "approved", description: "BUS101 Intro to Business Midterm approved", user: "Dr. Lisa Wong", timestamp: "2026-02-09 10:20" },
  { id: "log5", type: "rejected", description: "MGT410 Project Management Assignment rejected", user: "Dr. Lisa Wong", timestamp: "2026-01-29 16:45" },
  { id: "log6", type: "upload", description: "IS305 Information Systems Quiz 2 uploaded", user: "Dr. Maria Lopez", timestamp: "2026-02-05 08:30" },
  { id: "log7", type: "upload", description: "MGT410 Project Management Assignment uploaded", user: "Prof. David Kim", timestamp: "2026-01-28 11:00" },
];

export const bloomColors: Record<BloomLevel, string> = {
  Knowledge: "bg-bloom-remember",
  Comprehension: "bg-bloom-understand",
  Application: "bg-bloom-apply",
  Analysis: "bg-bloom-analyze",
  Synthesis: "bg-bloom-evaluate",
  Evaluation: "bg-bloom-create",
};

export const difficultyColors: Record<Difficulty, string> = {
  "Very Easy": "bg-emerald-400",
  Easy: "bg-difficulty-easy",
  Medium: "bg-difficulty-medium",
  Hard: "bg-difficulty-hard",
  "Very Hard": "bg-red-700",
};
