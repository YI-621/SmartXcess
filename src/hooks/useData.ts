import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  normalizeAssessmentStatus,
  normalizeBloomLevel,
  normalizeDifficulty,
  type Assessment,
  type Question,
  type ModerationDetails,
} from "@/lib/assessment";
import type { Tables } from "@/integrations/supabase/types";

// Types matching the database
export interface DbAssessment {
  id: string;
  title: string;
  course: string;
  lecturer_id: string;
  moderator_id: string | null;
  date: string;
  status: string;
  overall_score: number;
  flagged: boolean;
  flag_reason: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbQuestion {
  id: string;
  assessment_id: string;
  text: string;
  marks: number;
  bloom_level: string;
  difficulty: string;
  complexity: number;
  similarity_score: number;
  similar_to: string | null;
  keywords: string[];
  question_order: number;
  created_at: string;
  moderation_details?: Record<string, any>;
}

export interface DbModerationComment {
  id: string;
  question_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface DbActivityLog {
  id: string;
  type: string;
  description: string;
  user_id: string;
  user_name: string | null;
  assessment_id: string | null;
  created_at: string;
}

export interface DbUserModule {
  id: string;
  user_id: string;
  module_name: string;
  created_at: string;
}

type DbQuestionAnalysisRow = Tables<"question_analysis_results">;

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseComplexity(value: string | null): number {
  if (!value) return 0;
  const numeric = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return toPercent(Number.isFinite(numeric) ? numeric : 0);
}

function inferDifficulty(complexity: number): Question["difficulty"] {
  if (complexity < 20) return "Very Easy";
  if (complexity < 40) return "Easy";
  if (complexity < 60) return "Medium";
  if (complexity < 80) return "Hard";
  return "Very Hard";
}

function splitKeywords(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[;,|]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function mapAnalysisRowToQuestion(row: DbQuestionAnalysisRow, index: number): Question {
  const complexity = parseComplexity(row.complexity);
  const similarity = toPercent(row.similarity_score ?? row.overall_similarity ?? 0);

  return {
    id: row.question_id ?? row.id,
    text: row.question_text ?? "",
    marks: 0,
    bloomLevel: normalizeBloomLevel(row.final_bloom_level),
    difficulty: normalizeDifficulty(inferDifficulty(complexity)),
    complexity,
    similarityScore: similarity,
    similarTo: row.similarity_source ?? undefined,
    keywords: splitKeywords(row.validated_bloom_keywords),
    moderationDetails: {
      question_id: row.question_id ?? undefined,
      grammar_errors: row.grammar_spelling_error ?? undefined,
      grammar_structure: row.grammar_structure ?? undefined,
      suggestion: row.suggestion ?? undefined,
      validated_bloom_keywords: row.validated_bloom_keywords ?? undefined,
      raw_complexity: row.complexity ?? undefined,
    },
  };
}

async function fetchModerationAssessmentsFromAnalysis(): Promise<Assessment[]> {
  const { data: rows, error } = await supabase
    .from("question_analysis_results")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const uploaderIds = [...new Set(rows.map((r) => r.uploaded_by).filter((id): id is string => !!id))];
  const { data: profiles } = uploaderIds.length
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", uploaderIds)
    : { data: [] as Array<{ user_id: string; full_name: string | null }> };

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? "Unknown"]));

  const grouped = new Map<string, DbQuestionAnalysisRow[]>();
  for (const row of rows) {
    const dateBucket = (row.created_at ?? "").slice(0, 10);
    const key = `${row.filename ?? "untitled"}::${row.module_code ?? "N/A"}::${row.uploaded_by ?? "unknown"}::${dateBucket}`;
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }

  const assessments: Assessment[] = [];
  for (const [key, groupRows] of grouped.entries()) {
    const first = groupRows[0];
    const questions = groupRows.map(mapAnalysisRowToQuestion);
    const avgSimilarity = questions.length
      ? Math.round(questions.reduce((sum, q) => sum + q.similarityScore, 0) / questions.length)
      : 0;
    const overallScore = toPercent(100 - avgSimilarity);
    const flagged = questions.some((q) => q.similarityScore >= 70);

    assessments.push({
      id: key,
      title: first.filename ?? "Untitled Analysis",
      course: first.module_code ?? "N/A",
      lecturer: first.uploaded_by ? profileMap.get(first.uploaded_by) ?? "Unknown" : "Unknown",
      moderator: undefined,
      date: first.created_at ? new Date(first.created_at).toLocaleDateString() : "N/A",
      status: normalizeAssessmentStatus("Reviewed"),
      questions,
      overallScore,
      flagged,
      flagReason: flagged ? "High similarity detected in one or more questions" : undefined,
    });
  }

  return assessments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Convert DB assessment + questions to the frontend Assessment shape
export function toFrontendAssessment(a: DbAssessment, questions: DbQuestion[], lecturerName?: string, moderatorName?: string): Assessment {
  return {
    id: a.id,
    title: a.title,
    course: a.course,
    lecturer: lecturerName ?? "Unknown",
    moderator: moderatorName,
    date: a.date,
    status: normalizeAssessmentStatus(a.status),
    overallScore: a.overall_score ?? 0,
    flagged: a.flagged ?? false,
    flagReason: a.flag_reason ?? undefined,
    questions: questions
      .sort((a, b) => a.question_order - b.question_order)
      .map((q) => ({
        id: q.id,
        text: q.text,
        marks: q.marks,
        bloomLevel: normalizeBloomLevel(q.bloom_level),
        difficulty: normalizeDifficulty(q.difficulty),
        complexity: q.complexity,
        similarityScore: q.similarity_score,
        similarTo: q.similar_to ?? undefined,
        keywords: q.keywords ?? [],
        moderationDetails: (q.moderation_details as ModerationDetails) ?? undefined,
      })),
  };
}

// ---- Hooks ----

export function useAssessments() {
  return useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const assessments = await fetchModerationAssessmentsFromAnalysis();
      return assessments.map((a) => ({
        id: a.id,
        title: a.title,
        course: a.course,
        lecturer_id: "",
        moderator_id: null,
        date: a.date,
        status: a.status,
        overall_score: a.overallScore,
        flagged: a.flagged ?? false,
        flag_reason: a.flagReason ?? null,
        file_url: null,
        created_at: a.date,
        updated_at: a.date,
      })) as DbAssessment[];
    },
  });
}

export function useAssessmentWithQuestions(id: string | null) {
  return useQuery({
    queryKey: ["assessment", id],
    enabled: !!id,
    queryFn: async () => {
      const assessments = await fetchModerationAssessmentsFromAnalysis();
      return assessments.find((a) => a.id === id!) ?? null;
    },
  });
}

export function useAssessmentsWithQuestions() {
  return useQuery({
    queryKey: ["assessments-full"],
    queryFn: async () => {
      return fetchModerationAssessmentsFromAnalysis();
    },
  });
}

export function useQuestions(assessmentId: string | null) {
  return useQuery({
    queryKey: ["questions", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const assessments = await fetchModerationAssessmentsFromAnalysis();
      const assessment = assessments.find((a) => a.id === assessmentId!);
      return (assessment?.questions ?? []).map((q, index) => ({
        id: q.id,
        assessment_id: assessmentId!,
        text: q.text,
        marks: q.marks,
        bloom_level: q.bloomLevel,
        difficulty: q.difficulty,
        complexity: q.complexity,
        similarity_score: q.similarityScore,
        similar_to: q.similarTo ?? null,
        keywords: q.keywords,
        question_order: index,
        created_at: "",
        moderation_details: q.moderationDetails as Record<string, any>,
      })) as DbQuestion[];
    },
  });
}

export function useModerationComments(questionIds: string[]) {
  return useQuery({
    queryKey: ["moderation-comments", questionIds],
    enabled: questionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_analysis_results")
        .select("id, question_id, similarity_reason, uploaded_by, created_at")
        .in("question_id", questionIds);

      if (error) throw error;

      return (data ?? [])
        .filter((row) => (row.similarity_reason ?? "").trim().length > 0)
        .map((row) => ({
          id: row.id,
          question_id: row.question_id ?? row.id,
          user_id: row.uploaded_by ?? "unknown",
          comment: row.similarity_reason ?? "",
          created_at: row.created_at ?? new Date().toISOString(),
          updated_at: row.created_at ?? new Date().toISOString(),
        })) as DbModerationComment[];
    },
  });
}

export function useSaveComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, comment }: { questionId: string; comment: string }) => {
      if (!questionId || comment === undefined) return;

      const { error } = await supabase
        .from("question_analysis_results")
        .update({ similarity_reason: comment })
        .eq("question_id", questionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-comments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });
      queryClient.invalidateQueries({ queryKey: ["assessment"] });
    },
  });
}

export function useUpdateAssessmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!id || !status) return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });
    },
  });
}

export function useActivityLogs() {
  return useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      return [] as DbActivityLog[];
    },
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ type, description, assessmentId }: { type: string; description: string; assessmentId?: string }) => {
      if (!user || !type || !description || assessmentId === undefined) return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
  });
}

export function useUserModules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-modules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return [] as DbUserModule[];
    },
  });
}

export function useAddModule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (moduleName: string) => {
      if (!user || !moduleName) return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-modules"] });
    },
  });
}

export function useRemoveModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moduleId: string) => {
      if (!moduleId) return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-modules"] });
    },
  });
}

export function useLecturerCount() {
  return useQuery({
    queryKey: ["lecturer-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "lecturer");
      if (error) throw error;
      return data?.length ?? 0;
    },
  });
}
