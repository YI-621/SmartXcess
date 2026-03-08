import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Assessment, Question, ModerationDetails } from "@/lib/mockData";

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

// Convert DB assessment + questions to the frontend Assessment shape
export function toFrontendAssessment(a: DbAssessment, questions: DbQuestion[], lecturerName?: string, moderatorName?: string): Assessment {
  return {
    id: a.id,
    title: a.title,
    course: a.course,
    lecturer: lecturerName ?? "Unknown",
    moderator: moderatorName,
    date: a.date,
    status: a.status as Assessment["status"],
    overallScore: a.overall_score ?? 0,
    flagged: a.flagged ?? false,
    flagReason: a.flag_reason ?? undefined,
    questions: questions
      .sort((a, b) => a.question_order - b.question_order)
      .map((q) => ({
        id: q.id,
        text: q.text,
        marks: q.marks,
        bloomLevel: q.bloom_level as Question["bloomLevel"],
        difficulty: q.difficulty as Question["difficulty"],
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
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbAssessment[];
    },
  });
}

export function useAssessmentWithQuestions(id: string | null) {
  return useQuery({
    queryKey: ["assessment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: assessment, error: aErr } = await supabase
        .from("assessments")
        .select("*")
        .eq("id", id!)
        .single();
      if (aErr) throw aErr;

      const { data: questions, error: qErr } = await supabase
        .from("questions")
        .select("*")
        .eq("assessment_id", id!)
        .order("question_order");
      if (qErr) throw qErr;

      // Fetch lecturer name
      const { data: lecturerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", (assessment as DbAssessment).lecturer_id)
        .single();

      let moderatorName: string | undefined;
      if ((assessment as DbAssessment).moderator_id) {
        const { data: modProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", (assessment as DbAssessment).moderator_id!)
          .single();
        moderatorName = modProfile?.full_name ?? undefined;
      }

      return toFrontendAssessment(
        assessment as DbAssessment,
        (questions ?? []) as DbQuestion[],
        lecturerProfile?.full_name ?? "Unknown",
        moderatorName
      );
    },
  });
}

export function useAssessmentsWithQuestions() {
  return useQuery({
    queryKey: ["assessments-full"],
    queryFn: async () => {
      const { data: assessments, error: aErr } = await supabase
        .from("assessments")
        .select("*")
        .order("created_at", { ascending: false });
      if (aErr) throw aErr;
      if (!assessments || assessments.length === 0) return [];

      const ids = assessments.map((a: any) => a.id);
      const { data: questions, error: qErr } = await supabase
        .from("questions")
        .select("*")
        .in("assessment_id", ids)
        .order("question_order");
      if (qErr) throw qErr;

      // Fetch all relevant profiles
      const userIds = [...new Set([
        ...assessments.map((a: any) => a.lecturer_id),
        ...assessments.filter((a: any) => a.moderator_id).map((a: any) => a.moderator_id),
      ])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name ?? "Unknown"]));

      return assessments.map((a: any) =>
        toFrontendAssessment(
          a as DbAssessment,
          ((questions ?? []) as DbQuestion[]).filter((q) => q.assessment_id === a.id),
          profileMap.get(a.lecturer_id) ?? "Unknown",
          a.moderator_id ? profileMap.get(a.moderator_id) : undefined
        )
      );
    },
  });
}

export function useQuestions(assessmentId: string | null) {
  return useQuery({
    queryKey: ["questions", assessmentId],
    enabled: !!assessmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("assessment_id", assessmentId!)
        .order("question_order");
      if (error) throw error;
      return (data ?? []) as DbQuestion[];
    },
  });
}

export function useModerationComments(questionIds: string[]) {
  return useQuery({
    queryKey: ["moderation-comments", questionIds],
    enabled: questionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_comments")
        .select("*")
        .in("question_id", questionIds);
      if (error) throw error;
      return (data ?? []) as DbModerationComment[];
    },
  });
}

export function useSaveComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ questionId, comment }: { questionId: string; comment: string }) => {
      if (!user) throw new Error("Not authenticated");
      // Upsert: check if exists
      const { data: existing } = await supabase
        .from("moderation_comments")
        .select("id")
        .eq("question_id", questionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("moderation_comments")
          .update({ comment })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("moderation_comments")
          .insert({ question_id: questionId, user_id: user.id, comment });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-comments"] });
    },
  });
}

export function useUpdateAssessmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("assessments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
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
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
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
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("activity_logs")
        .insert({
          type,
          description,
          user_id: user.id,
          user_name: profile?.full_name ?? user.email ?? "Unknown",
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
  return useQuery({
    queryKey: ["user-modules", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_modules")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as DbUserModule[];
    },
  });
}

export function useAddModule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (moduleName: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_modules")
        .insert({ user_id: user.id, module_name: moduleName });
      if (error) throw error;
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
      const { error } = await supabase
        .from("user_modules")
        .delete()
        .eq("id", moduleId);
      if (error) throw error;
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
