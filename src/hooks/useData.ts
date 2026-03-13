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

interface ModerationCommentOptions {
  assessmentId?: string | null;
  hideUntilDoneForLecturer?: boolean;
  assessmentStatus?: string | null;
}

type DbQuestionAnalysisRow = Tables<"question_analysis_results">;

interface ModerationThresholds {
  similarityThreshold: number;
  complexityThreshold: number;
}

type AssessmentStatusMap = Record<string, string>;
type UserModuleMap = Record<string, string[]>;
type ModerationCommentsMap = Record<string, Record<string, Record<string, string>>>;
type ModerationCompletionMap = Record<string, string[]>;

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

const complexityFallbackByDifficulty: Record<Question["difficulty"], number> = {
  "Very Easy": 10,
  Easy: 30,
  Medium: 50,
  Hard: 70,
  "Very Hard": 90,
};

function parseComplexity(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(numeric)) return toPercent(numeric);

  const normalized = normalizeDifficulty(value);
  return complexityFallbackByDifficulty[normalized];
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

function romanToNumber(input: string): number {
  const roman = input.toUpperCase();
  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let total = 0;
  for (let i = 0; i < roman.length; i += 1) {
    const current = values[roman[i]] ?? 0;
    const next = values[roman[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total;
}

function parseQuestionSequence(questionId: string | null | undefined): [number, number, number] {
  if (!questionId) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

  // Supports IDs like: Q1, Q1_a, Q1_a_i, prefix_Q2_b_ii
  const qMatch = questionId.match(/(?:^|_)Q([0-9IVXLCDM]+)/i);
  if (!qMatch) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

  const qRaw = qMatch[1] ?? "";
  const main = /^\d+$/.test(qRaw) ? Number.parseInt(qRaw, 10) : romanToNumber(qRaw);

  const tail = questionId.slice(qMatch.index! + qMatch[0].length);
  const parts = tail.split("_").filter(Boolean);

  const letterPart = parts[0]?.toLowerCase();
  const letter = letterPart && /^[a-z]$/.test(letterPart)
    ? letterPart.charCodeAt(0) - "a".charCodeAt(0) + 1
    : Number.MAX_SAFE_INTEGER;

  const romanPart = parts[1]?.toLowerCase();
  const sub = romanPart && /^[ivxlcdm]+$/.test(romanPart)
    ? romanToNumber(romanPart)
    : Number.MAX_SAFE_INTEGER;

  return [Number.isFinite(main) && main > 0 ? main : Number.MAX_SAFE_INTEGER, letter, sub];
}

function sortRowsByQuestionSequence(rows: DbQuestionAnalysisRow[]): DbQuestionAnalysisRow[] {
  return [...rows].sort((a, b) => {
    const aSeq = parseQuestionSequence(a.question_id);
    const bSeq = parseQuestionSequence(b.question_id);

    if (aSeq[0] !== bSeq[0]) return aSeq[0] - bSeq[0];
    if (aSeq[1] !== bSeq[1]) return aSeq[1] - bSeq[1];
    if (aSeq[2] !== bSeq[2]) return aSeq[2] - bSeq[2];

    return (a.question_id ?? "").localeCompare(b.question_id ?? "", undefined, { numeric: true, sensitivity: "base" });
  });
}

function parseSettingNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeModuleCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseAssessmentGroupingKey(assessmentId: string | null | undefined): {
  filename: string;
  moduleCode: string;
  uploadedBy: string;
  dateBucket: string;
} | null {
  if (!assessmentId) return null;

  const parts = assessmentId.split("::");
  if (parts.length !== 4) return null;

  const [filename, moduleCode, uploadedBy, dateBucket] = parts;
  if (!filename || !moduleCode || !uploadedBy || !dateBucket) return null;

  return { filename, moduleCode, uploadedBy, dateBucket };
}

async function fetchModerationThresholds(): Promise<ModerationThresholds> {
  const defaults: ModerationThresholds = {
    similarityThreshold: 75,
    complexityThreshold: 60,
  };

  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["similarity_threshold", "complexity_threshold"]);

  if (error || !data) return defaults;

  const similarity = data.find((item) => item.key === "similarity_threshold")?.value;
  const complexity = data.find((item) => item.key === "complexity_threshold")?.value;

  return {
    similarityThreshold: parseSettingNumber(similarity, defaults.similarityThreshold),
    complexityThreshold: parseSettingNumber(complexity, defaults.complexityThreshold),
  };
}

async function fetchAssessmentStatusMap(): Promise<AssessmentStatusMap> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "assessment_status_map")
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== "object" || Array.isArray(data.value)) {
    return {};
  }

  const map: AssessmentStatusMap = {};
  for (const [assessmentId, status] of Object.entries(data.value as Record<string, unknown>)) {
    if (typeof status === "string" && assessmentId) {
      map[assessmentId] = status;
    }
  }

  return map;
}

async function fetchUserModuleMap(): Promise<UserModuleMap> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "user_module_map")
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== "object" || Array.isArray(data.value)) {
    return {};
  }

  const output: UserModuleMap = {};
  for (const [userId, rawModules] of Object.entries(data.value as Record<string, unknown>)) {
    if (!Array.isArray(rawModules)) continue;
    const normalized = rawModules
      .map((moduleCode) => (typeof moduleCode === "string" ? normalizeModuleCode(moduleCode) : ""))
      .filter(Boolean);
    output[userId] = [...new Set(normalized)];
  }

  return output;
}

async function upsertUserModuleMap(nextMap: UserModuleMap): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: "user_module_map", value: nextMap } as any, { onConflict: "key" });

  if (error) throw error;
}

async function fetchModerationCommentsMap(): Promise<ModerationCommentsMap> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "moderation_comments_map")
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== "object" || Array.isArray(data.value)) {
    return {};
  }

  return data.value as ModerationCommentsMap;
}

async function upsertModerationCommentsMap(nextMap: ModerationCommentsMap): Promise<void> {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key: "moderation_comments_map", value: nextMap } as any, { onConflict: "key" });

  if (error) throw error;
}

async function fetchCurrentUserModuleCodes(userId: string, defaultModuleCode?: string | null): Promise<string[]> {
  const userModuleMap = await fetchUserModuleMap();
  const mappedModules = userModuleMap[userId] ?? [];
  const fallbackModule = normalizeModuleCode(defaultModuleCode);

  const merged = [...mappedModules, ...(fallbackModule ? [fallbackModule] : [])];
  return [...new Set(merged)];
}

async function fetchModeratorAssignmentsByModule(): Promise<Map<string, string[]>> {
  const [userModuleMap, rolesRes] = await Promise.all([
    fetchUserModuleMap(),
    supabase.from("user_roles").select("user_id, role").eq("role", "moderator"),
  ]);

  const moderatorIds = new Set((rolesRes.data ?? []).map((row) => row.user_id));
  const byModule = new Map<string, Set<string>>();

  for (const [userId, modules] of Object.entries(userModuleMap)) {
    if (!moderatorIds.has(userId)) continue;

    for (const moduleCode of modules) {
      const key = normalizeModuleCode(moduleCode);
      if (!key) continue;
      const current = byModule.get(key) ?? new Set<string>();
      current.add(userId);
      byModule.set(key, current);
    }
  }

  return new Map([...byModule.entries()].map(([moduleCode, ids]) => [moduleCode, [...ids]]));
}

async function fetchModerationCompletionMap(): Promise<ModerationCompletionMap> {
  const { data, error } = await (supabase.from("activity_logs" as any) as any)
    .select("assessment_id, user_id")
    .eq("type", "moderation_complete")
    .not("assessment_id", "is", null);

  if (error || !data) return {};

  const grouped = new Map<string, Set<string>>();
  for (const row of data as Array<{ assessment_id: string | null; user_id: string | null }>) {
    if (!row.assessment_id || !row.user_id) continue;
    const set = grouped.get(row.assessment_id) ?? new Set<string>();
    set.add(row.user_id);
    grouped.set(row.assessment_id, set);
  }

  const out: ModerationCompletionMap = {};
  for (const [assessmentId, ids] of grouped.entries()) {
    out[assessmentId] = [...ids];
  }
  return out;
}

function mapAnalysisRowToQuestion(row: DbQuestionAnalysisRow, index: number): Question {
  const dbDifficulty = (row as { difficulty?: string | null }).difficulty ?? null;
  const normalizedDifficulty = normalizeDifficulty(dbDifficulty ?? row.complexity);
  const parsedComplexity = parseComplexity(row.complexity);
  const complexity = parsedComplexity ?? complexityFallbackByDifficulty[normalizedDifficulty];
  const internalSimilarity = Number((row as any).internal_similarity_score);
  const externalSimilarity = Number((row as any).external_similarity_score);
  const finalSimilarity = Number((row as any).final_sim_score);

  const similarity = toPercent(
    Number.isFinite(finalSimilarity)
      ? finalSimilarity
      : row.similarity_score ?? row.overall_similarity ?? 0
  );

  const similarityType: "internal" | "external" | "overall" =
    Number.isFinite(internalSimilarity) && Number.isFinite(externalSimilarity)
      ? (internalSimilarity >= externalSimilarity ? "internal" : "external")
      : "overall";

  return {
    id: row.question_id ?? row.id,
    text: row.question_text ?? "",
    marks: 0,
    bloomLevel: normalizeBloomLevel(row.final_bloom_level),
    difficulty: normalizedDifficulty,
    complexity,
    similarityScore: similarity,
    similarTo: row.similarity_source ?? undefined,
    keywords: splitKeywords(row.validated_bloom_keywords),
    moderationDetails: {
      question_id: row.question_id ?? undefined,
      grammar_errors: row.grammar_spelling_error ?? undefined,
      grammar_structure: row.grammar_structure ?? undefined,
      relevancy_to_scope: row.relevancy_to_scope ?? undefined,
      internal_similarity_score: Number.isFinite(internalSimilarity) ? toPercent(internalSimilarity) : undefined,
      external_similarity_score: Number.isFinite(externalSimilarity) ? toPercent(externalSimilarity) : undefined,
      similarity_type_used: similarityType,
      suggestion: row.suggestion ?? undefined,
      validated_bloom_keywords: row.validated_bloom_keywords ?? undefined,
      raw_complexity: row.complexity ?? undefined,
    },
  };
}

async function fetchModerationAssessmentsFromAnalysis(): Promise<Assessment[]> {
  const [{ data: rows, error }, thresholds, statusMap, moderatorsByModule, completionMap] = await Promise.all([
    supabase
      .from("question_analysis_results")
      .select("*")
      .order("created_at", { ascending: false }),
    fetchModerationThresholds(),
    fetchAssessmentStatusMap(),
    fetchModeratorAssignmentsByModule(),
    fetchModerationCompletionMap(),
  ]);

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const uploaderIds = [...new Set(rows.map((r) => r.uploaded_by).filter((id): id is string => !!id))];
  const uploaderProfileIds = uploaderIds.filter(isUuid);
  const { data: profiles } = uploaderProfileIds.length
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", uploaderProfileIds)
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
    const orderedRows = sortRowsByQuestionSequence(groupRows);
    const first = orderedRows[0];
    const questions = orderedRows.map(mapAnalysisRowToQuestion);
    const avgComplexity = questions.length
      ? Math.round(questions.reduce((sum, q) => sum + q.complexity, 0) / questions.length)
      : 0;
    const avgSimilarity = questions.length
      ? Math.round(questions.reduce((sum, q) => sum + q.similarityScore, 0) / questions.length)
      : 0;
    const overallScore = toPercent(100 - avgSimilarity);

    const highSimilarityQuestions = questions.filter((q) => q.similarityScore >= thresholds.similarityThreshold).length;
    const hasHighSimilarity = highSimilarityQuestions > 0;
    const lowComplexityAssessment = avgComplexity < thresholds.complexityThreshold;
    const flagged = hasHighSimilarity || lowComplexityAssessment;

    const reasons: string[] = [];
    if (hasHighSimilarity) {
      reasons.push(
        `${highSimilarityQuestions} question(s) exceed similarity threshold (${thresholds.similarityThreshold}%)`
      );
    }
    if (lowComplexityAssessment) {
      reasons.push(`Average complexity below threshold (${avgComplexity}% < ${thresholds.complexityThreshold}%)`);
    }

    const assignedModeratorIds = moderatorsByModule.get(normalizeModuleCode(first.module_code ?? "")) ?? [];
    const completedModeratorIds = completionMap[key] ?? [];
    const completedAssignedModeratorIds = assignedModeratorIds.filter((moderatorId) => completedModeratorIds.includes(moderatorId));

    const explicitStatus = normalizeAssessmentStatus(statusMap[key] ?? "Pending");
    const allAssignedDone = assignedModeratorIds.length > 0 && completedAssignedModeratorIds.length >= assignedModeratorIds.length;
    const resolvedStatus =
      explicitStatus === "Approved" || explicitStatus === "Rejected"
        ? explicitStatus
        : allAssignedDone
          ? "Done"
          : "Pending";

    assessments.push({
      id: key,
      title: first.filename ?? "Untitled Analysis",
      course: first.module_code ?? "N/A",
      lecturer: first.uploaded_by ? profileMap.get(first.uploaded_by) ?? "Unknown" : "Unknown",
      uploadedBy: first.uploaded_by ?? undefined,
      moderator: undefined,
      date: first.created_at ? new Date(first.created_at).toLocaleDateString() : "N/A",
      status: resolvedStatus,
      moderationProgress: {
        assigned: assignedModeratorIds.length,
        completed: completedAssignedModeratorIds.length,
        assignedModeratorIds,
        completedModeratorIds: completedAssignedModeratorIds,
      },
      questions,
      overallScore,
      flagged,
      flagReason: reasons.length ? reasons.join("; ") : undefined,
    });
  }

  return assessments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async function filterAssessmentsByRole(
  assessments: Assessment[],
  userId: string | null | undefined,
  activeRole: string | null | undefined
): Promise<Assessment[]> {
  if (activeRole !== "lecturer") return assessments;
  if (!userId) return [];

  return assessments.filter((assessment) => {
    const uploader = assessment.uploadedBy ?? parseAssessmentGroupingKey(assessment.id)?.uploadedBy;
    return uploader === userId;
  });
}

async function applyAssessmentRoleFilter(
  assessments: Assessment[],
  userId: string | null | undefined,
  activeRole: string | null | undefined,
  defaultModuleCode?: string | null
): Promise<Assessment[]> {
  if (!userId) return [];

  if (activeRole === "lecturer") {
    return filterAssessmentsByRole(assessments, userId, activeRole);
  }

  if (activeRole === "moderator") {
    const allowedModules = await fetchCurrentUserModuleCodes(userId, defaultModuleCode);
    if (allowedModules.length === 0) {
      return assessments.filter((assessment) => {
        const uploader = assessment.uploadedBy ?? parseAssessmentGroupingKey(assessment.id)?.uploadedBy;
        return uploader === userId;
      });
    }
    const allowedSet = new Set(allowedModules.map(normalizeModuleCode));
    return assessments.filter((assessment) => {
      const uploadedBy = assessment.uploadedBy ?? parseAssessmentGroupingKey(assessment.id)?.uploadedBy;
      return uploadedBy === userId || allowedSet.has(normalizeModuleCode(assessment.course));
    });
  }

  return assessments;
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
  const { user, activeRole } = useAuth();
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;

  return useQuery({
    queryKey: ["assessments", activeRole, user?.id, defaultModuleCode],
    queryFn: async () => {
      const assessments = await applyAssessmentRoleFilter(
        await fetchModerationAssessmentsFromAnalysis(),
        user?.id,
        activeRole,
        defaultModuleCode
      );
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
  const { user, activeRole } = useAuth();
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;

  const toIdCandidates = (rawId: string): string[] => {
    const out = new Set<string>();
    const trimmed = rawId.trim();
    if (!trimmed) return [];

    out.add(trimmed);

    try {
      out.add(decodeURIComponent(trimmed));
    } catch {
      // Keep raw value if decode fails due malformed encoding.
    }

    try {
      out.add(encodeURIComponent(trimmed));
    } catch {
      // Keep raw value if encode fails.
    }

    // Query strings may convert '+' to space in some flows.
    out.add(trimmed.replace(/\+/g, " "));
    out.add(trimmed.replace(/ /g, "+"));

    return [...out].filter(Boolean);
  };

  return useQuery({
    queryKey: ["assessment", id, activeRole, user?.id, defaultModuleCode],
    enabled: !!id,
    queryFn: async () => {
      const assessments = await applyAssessmentRoleFilter(
        await fetchModerationAssessmentsFromAnalysis(),
        user?.id,
        activeRole,
        defaultModuleCode
      );

      const candidates = toIdCandidates(id!);
      return assessments.find((a) => candidates.includes(a.id)) ?? null;
    },
  });
}

export function useAssessmentsWithQuestions() {
  const { user, activeRole } = useAuth();
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;

  return useQuery({
    queryKey: ["assessments-full", activeRole, user?.id, defaultModuleCode],
    queryFn: async () => {
      return applyAssessmentRoleFilter(
        await fetchModerationAssessmentsFromAnalysis(),
        user?.id,
        activeRole,
        defaultModuleCode
      );
    },
  });
}

export function useQuestions(assessmentId: string | null) {
  const { user, activeRole } = useAuth();
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;

  return useQuery({
    queryKey: ["questions", assessmentId, activeRole, user?.id, defaultModuleCode],
    enabled: !!assessmentId,
    queryFn: async () => {
      const assessments = await applyAssessmentRoleFilter(
        await fetchModerationAssessmentsFromAnalysis(),
        user?.id,
        activeRole,
        defaultModuleCode
      );
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

export function useModerationComments(questionIds: string[], options?: ModerationCommentOptions) {
  const {
    assessmentId,
    hideUntilDoneForLecturer = false,
    assessmentStatus,
  } = options ?? {};

  return useQuery({
    queryKey: ["moderation-comments", questionIds, assessmentId, hideUntilDoneForLecturer, assessmentStatus],
    enabled: questionIds.length > 0,
    queryFn: async () => {
      if (hideUntilDoneForLecturer && assessmentStatus !== "Done") {
        return [] as DbModerationComment[];
      }

      if (assessmentId) {
        const [commentsMap, logRes] = await Promise.all([
          fetchModerationCommentsMap(),
          (supabase.from("activity_logs" as any) as any)
            .select("user_id, created_at")
            .eq("type", "moderation_complete")
            .eq("assessment_id", assessmentId),
        ]);

        const assessmentMap = commentsMap[assessmentId] ?? {};
        const completedAtMap = new Map<string, string>();
        const logs = (logRes.data ?? []) as Array<{ user_id: string | null; created_at: string | null }>;
        logs.forEach((row) => {
          if (row.user_id && row.created_at) {
            completedAtMap.set(row.user_id, row.created_at);
          }
        });

        const mappedRows: DbModerationComment[] = [];
        for (const [moderatorId, commentsByQuestion] of Object.entries(assessmentMap)) {
          for (const questionId of questionIds) {
            const comment = commentsByQuestion?.[questionId];
            if (!comment || !comment.trim()) continue;

            const createdAt = completedAtMap.get(moderatorId) ?? new Date().toISOString();
            mappedRows.push({
              id: `${assessmentId}:${moderatorId}:${questionId}`,
              question_id: questionId,
              user_id: moderatorId,
              comment,
              created_at: createdAt,
              updated_at: createdAt,
            });
          }
        }

        if (mappedRows.length > 0) {
          return mappedRows;
        }
      }

      let query = supabase
        .from("question_analysis_results")
        .select("id, question_id, similarity_reason, uploaded_by, created_at, filename, module_code")
        .in("question_id", questionIds);

      const groupingKey = parseAssessmentGroupingKey(assessmentId);
      if (groupingKey) {
        const start = `${groupingKey.dateBucket}T00:00:00`;
        const end = `${groupingKey.dateBucket}T23:59:59.999`;
        query = query
          .eq("filename", groupingKey.filename)
          .eq("module_code", groupingKey.moduleCode)
          .eq("uploaded_by", groupingKey.uploadedBy)
          .gte("created_at", start)
          .lte("created_at", end);
      }

      const { data, error } = await query;

      if (error) throw error;

      let moderatorId: string | null = null;
      let moderatorCommentAt: string | null = null;

      if (assessmentId) {
        const { data: logs, error: logError } = await (supabase.from("activity_logs" as any) as any)
          .select("user_id, created_at")
          .eq("type", "moderation_complete")
          .eq("assessment_id", assessmentId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!logError && logs && logs.length > 0) {
          moderatorId = logs[0].user_id ?? null;
          moderatorCommentAt = logs[0].created_at ?? null;
        }
      }

      return (data ?? [])
        .filter((row) => (row.similarity_reason ?? "").trim().length > 0)
        .map((row) => ({
          id: row.id,
          question_id: row.question_id ?? row.id,
          user_id: moderatorId ?? row.uploaded_by ?? "unknown",
          comment: row.similarity_reason ?? "",
          created_at: moderatorCommentAt ?? row.created_at ?? new Date().toISOString(),
          updated_at: moderatorCommentAt ?? row.created_at ?? new Date().toISOString(),
        })) as DbModerationComment[];
    },
  });
}

export function useSaveComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ assessmentId, questionId, comment }: { assessmentId: string; questionId: string; comment: string }) => {
      if (!user || !assessmentId || !questionId || comment === undefined) return;

      const map = await fetchModerationCommentsMap();
      const byAssessment = map[assessmentId] ?? {};
      const byModerator = byAssessment[user.id] ?? {};

      if ((comment ?? "").trim().length === 0) {
        delete byModerator[questionId];
      } else {
        byModerator[questionId] = comment;
      }

      byAssessment[user.id] = byModerator;
      map[assessmentId] = byAssessment;

      await upsertModerationCommentsMap(map);
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

      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "assessment_status_map")
        .maybeSingle();

      if (error) throw error;

      const existingMap: AssessmentStatusMap =
        data?.value && typeof data.value === "object" && !Array.isArray(data.value)
          ? (data.value as AssessmentStatusMap)
          : {};

      const nextMap: AssessmentStatusMap = {
        ...existingMap,
        [id]: status,
      };

      const { error: saveError } = await supabase
        .from("system_settings")
        .upsert({ key: "assessment_status_map", value: nextMap } as any, { onConflict: "key" });

      if (saveError) throw saveError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });
    },
  });
}

export function useActivityLogs() {
  const { user, activeRole } = useAuth();

  return useQuery({
    queryKey: ["activity-logs", activeRole, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as DbActivityLog[];

      const baseQuery = (supabase.from("activity_logs" as any) as any)
        .select("id, type, description, user_id, user_name, assessment_id, created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      if (activeRole === "admin") {
        const { data: supervisedRoles, error: roleError } = await (supabase.from("user_roles") as any)
          .select("user_id, role")
          .in("role", ["lecturer", "moderator"]);

        if (roleError) throw roleError;

        const supervisedUserIds = [
          ...new Set(
            ((supervisedRoles ?? []) as Array<{ user_id: string | null }>).map((r) => r.user_id).filter(Boolean)
          ),
        ] as string[];

        if (supervisedUserIds.length === 0) return [] as DbActivityLog[];

        const { data, error } = await baseQuery.in("user_id", supervisedUserIds);
        if (error) throw error;
        return (data ?? []) as DbActivityLog[];
      }

      const { data, error } = await baseQuery.eq("user_id", user.id);
      if (error) throw error;

      return (data ?? []) as DbActivityLog[];
    },
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ type, description, assessmentId }: { type: string; description: string; assessmentId?: string }) => {
      if (!user || !type || !description) return;

      const userName = profile?.full_name ?? user.email ?? "Unknown";
      const { error } = await (supabase.from("activity_logs" as any) as any).insert({
        type,
        description,
        user_id: user.id,
        user_name: userName,
        assessment_id: assessmentId ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
  });
}

export function useUserModules() {
  const { user } = useAuth();
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;

  return useQuery({
    queryKey: ["user-modules", user?.id, defaultModuleCode],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as DbUserModule[];

      const moduleCodes = await fetchCurrentUserModuleCodes(user.id, defaultModuleCode);
      return moduleCodes.map((moduleCode) => ({
        id: `${user.id}:${moduleCode}`,
        user_id: user.id,
        module_name: moduleCode,
        created_at: "",
      }));
    },
  });
}

export function useAddModule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (moduleName: string) => {
      if (!user || !moduleName) return;

      const moduleCode = normalizeModuleCode(moduleName);
      if (!moduleCode) return;

      const map = await fetchUserModuleMap();
      const existing = map[user.id] ?? [];
      map[user.id] = [...new Set([...existing, moduleCode])];
      await upsertUserModuleMap(map);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-modules"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });
      queryClient.invalidateQueries({ queryKey: ["assessment"] });
    },
  });
}

export function useRemoveModule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;

  return useMutation({
    mutationFn: async (moduleId: string) => {
      if (!moduleId || !user) return;

      const map = await fetchUserModuleMap();
      const current = map[user.id] ?? [];
      const [, moduleCodeRaw] = moduleId.split(":");
      const moduleCode = normalizeModuleCode(moduleCodeRaw);
      const fallbackModule = normalizeModuleCode(defaultModuleCode);

      // Do not allow removing the registered default module code.
      if (moduleCode && moduleCode === fallbackModule) return;

      map[user.id] = current.filter((code) => normalizeModuleCode(code) !== moduleCode);
      await upsertUserModuleMap(map);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-modules"] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });
      queryClient.invalidateQueries({ queryKey: ["assessment"] });
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
