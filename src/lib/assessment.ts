export type BloomLevel = "Knowledge" | "Comprehension" | "Application" | "Analysis" | "Synthesis" | "Evaluation";
export type Difficulty = "Very Easy" | "Easy" | "Medium" | "Hard" | "Very Hard";
export type AssessmentStatus = "Moderating" | "Pending" | "Done" | "Approved" | "Rejected";

const bloomLevelAliases: Record<string, BloomLevel> = {
  knowledge: "Knowledge",
  remember: "Knowledge",
  remembering: "Knowledge",
  comprehension: "Comprehension",
  understand: "Comprehension",
  understanding: "Comprehension",
  application: "Application",
  apply: "Application",
  applying: "Application",
  analysis: "Analysis",
  analyze: "Analysis",
  analyzing: "Analysis",
  synthesis: "Synthesis",
  create: "Synthesis",
  creating: "Synthesis",
  evaluation: "Evaluation",
  evaluate: "Evaluation",
  evaluating: "Evaluation",
};

const difficultyAliases: Record<string, Difficulty> = {
  "very easy": "Very Easy",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  "very hard": "Very Hard",
};

const statusAliases: Record<string, AssessmentStatus> = {
  moderating: "Moderating",
  pending: "Pending",
  reviewed: "Done",
  done: "Done",
  approved: "Approved",
  rejected: "Rejected",
};

export interface ModerationDetails {
  question_id?: string;
  grammar_errors?: string;
  grammar_structure?: string;
  relevancy_to_scope?: string | number;
  internal_similarity_score?: number;
  external_similarity_score?: number;
  similarity_type_used?: "internal" | "external" | "overall";
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

export interface Assessment {
  id: string;
  title: string;
  course: string;
  lecturer: string;
  moderator?: string;
  date: string;
  status: AssessmentStatus;
  moderationProgress?: {
    assigned: number;
    completed: number;
    assignedModeratorIds: string[];
    completedModeratorIds: string[];
  };
  questions: Question[];
  overallScore: number;
  flagged?: boolean;
  flagReason?: string;
}

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

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeBloomLevel(value: string | null | undefined): BloomLevel {
  return bloomLevelAliases[normalizeKey(value)] ?? "Knowledge";
}

export function normalizeDifficulty(value: string | null | undefined): Difficulty {
  const normalized = normalizeKey(value);
  if (!normalized) return "Medium";

  const direct = difficultyAliases[normalized];
  if (direct) return direct;

  // Handle values like "Difficulty: Very Hard", "very-hard", or "level=easy".
  const collapsed = normalized.replace(/[-_]+/g, " ");
  if (collapsed.includes("very hard")) return "Very Hard";
  if (collapsed.includes("very easy")) return "Very Easy";
  if (collapsed.includes("hard")) return "Hard";
  if (collapsed.includes("easy")) return "Easy";
  if (collapsed.includes("medium")) return "Medium";

  return "Medium";
}

export function normalizeAssessmentStatus(value: string | null | undefined): AssessmentStatus {
  return statusAliases[normalizeKey(value)] ?? "Pending";
}
