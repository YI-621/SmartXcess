import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Shield, Users, Settings, Save, Loader2, Plus, X, BookOpen, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssessmentsWithQuestions } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type UserWithRole = {
  user_id: string;
  full_name: string | null;
  department: string | null;
  roles: string[];
};

type ModeratorModule = {
  id: string;
  user_id: string;
  module_code: string;
  moderator_name: string;
};

type UserModuleMap = Record<string, string[]>;

const normalizeModuleCode = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

export default function Admin() {
  const navigate = useNavigate();
  const { isSuperAdmin, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [similarityThreshold, setSimilarityThreshold] = useState(75);
  const [complexityThreshold, setComplexityThreshold] = useState(60);
  const [savingSettings, setSavingSettings] = useState(false);
  const [moderatorModules, setModeratorModules] = useState<ModeratorModule[]>([]);
  const [userModuleMap, setUserModuleMap] = useState<UserModuleMap>({});
  const [adminModuleCodes, setAdminModuleCodes] = useState<string[]>([]);
  const [newModuleCode, setNewModuleCode] = useState("");
  const [selectedModeratorId, setSelectedModeratorId] = useState("");
  const [pastYearModuleCode, setPastYearModuleCode] = useState("");
  const [pastYearModuleName, setPastYearModuleName] = useState("");
  const [pastYearExamYear, setPastYearExamYear] = useState("");
  const [pastYearExamMonth, setPastYearExamMonth] = useState("");
  const [pastYearFile, setPastYearFile] = useState<File | null>(null);
  const [uploadingPastYear, setUploadingPastYear] = useState(false);
  const { toast } = useToast();
  const { data: assessments = [], isLoading: loadingAssessments } = useAssessmentsWithQuestions();
  const flaggedAssessments = assessments.filter((assessment) => assessment.flagged);
  const defaultModuleCode = (user?.user_metadata as any)?.module_code as string | undefined;
  const adminModuleSet = useMemo(() => new Set(adminModuleCodes.map(normalizeModuleCode)), [adminModuleCodes]);

  const apiBaseUrl = import.meta.env.DEV
    ? ((import.meta.env.VITE_API_BASE_URL_LOCAL as string | undefined) ?? "http://127.0.0.1:8000")
    : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "");

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const moduleMap = await fetchUserModuleMap();
      setUserModuleMap(moduleMap);

      const currentAdminModules = isSuperAdmin
        ? []
        : [
            ...(moduleMap[user?.id ?? ""] ?? []),
            ...(defaultModuleCode ? [normalizeModuleCode(defaultModuleCode)] : []),
          ].filter(Boolean);

      setAdminModuleCodes([...new Set(currentAdminModules)]);

      await Promise.all([
        fetchUsers(moduleMap, currentAdminModules),
        fetchSettings(),
        fetchModeratorModules(moduleMap, currentAdminModules),
      ]);

      setLoading(false);
    };

    void initialize();
  }, [isSuperAdmin, user?.id, defaultModuleCode]);

  const toNumericSetting = (value: unknown, fallback: number) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  };

  const fetchUserModuleMap = async (): Promise<UserModuleMap> => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "user_module_map")
      .maybeSingle();

    if (!data?.value || typeof data.value !== "object" || Array.isArray(data.value)) return {};

    const map: UserModuleMap = {};
    for (const [userId, modules] of Object.entries(data.value as Record<string, unknown>)) {
      if (!Array.isArray(modules)) continue;
      map[userId] = modules
        .map((moduleCode) => (typeof moduleCode === "string" ? normalizeModuleCode(moduleCode) : ""))
        .filter(Boolean);
    }
    return map;
  };

  const fetchUsers = async (moduleMap: UserModuleMap, currentAdminModules: string[]) => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, department");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (!profiles) {
      setUsers([]);
      return;
    }

    const mapped = profiles.map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      department: p.department,
      roles: roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) ?? [],
    }));

    if (isSuperAdmin) {
      setUsers(mapped);
      return;
    }

    const allowed = new Set(currentAdminModules.map(normalizeModuleCode));
    const scoped = mapped.filter((u) => {
      if (u.user_id === user?.id) return true;
      const modules = moduleMap[u.user_id] ?? [];
      return modules.some((moduleCode) => allowed.has(normalizeModuleCode(moduleCode)));
    });

    setUsers(scoped);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("system_settings").select("key, value");
    if (error) {
      toast({ title: "Unable to load settings", description: error.message, variant: "destructive" });
      return;
    }

    if (data) {
      const sim = data.find((s) => s.key === "similarity_threshold");
      const comp = data.find((s) => s.key === "complexity_threshold");
      if (sim) setSimilarityThreshold(toNumericSetting(sim.value, 75));
      if (comp) setComplexityThreshold(toNumericSetting(comp.value, 60));
    }
  };

  const fetchModeratorModules = async (_moduleMap: UserModuleMap, currentAdminModules: string[]) => {
    const { data } = await supabase.from("moderator_modules").select("*");
    if (!data) {
      setModeratorModules([]);
      return;
    }

    const filteredRows = isSuperAdmin
      ? data
      : data.filter((row: any) => currentAdminModules.includes(normalizeModuleCode(row.module_code)));

    const userIds = [...new Set(filteredRows.map((d: any) => d.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as Array<{ user_id: string; full_name: string | null }> };

    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? "Unknown"]));

    setModeratorModules(
      filteredRows.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        module_code: d.module_code,
        moderator_name: nameMap.get(d.user_id) ?? "Unknown",
      }))
    );
  };

  const toggleRole = async (userId: string, role: string) => {
    if (!isSuperAdmin && role === "admin") {
      toast({ title: "Permission denied", description: "Only super admin can manage admin role", variant: "destructive" });
      return;
    }

    const userToUpdate = users.find((u) => u.user_id === userId);
    if (!userToUpdate) return;

    if (!isSuperAdmin) {
      const targetModules = userModuleMap[userId] ?? [];
      const inScope = targetModules.some((moduleCode) => adminModuleSet.has(normalizeModuleCode(moduleCode)));
      if (!inScope && userId !== user?.id) {
        toast({ title: "Out of scope", description: "You can only manage users under your supervised modules", variant: "destructive" });
        return;
      }
    }

    const hasRole = userToUpdate.roles.includes(role);
    if (hasRole) {
      if (userToUpdate.roles.length <= 1) {
        toast({ title: "Cannot remove last role", description: "A user must have at least one role", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      if (error) {
        toast({ title: "Role update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: `Removed ${role} role` });
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) {
        toast({ title: "Role update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: `Added ${role} role` });
    }

    await fetchUsers(userModuleMap, adminModuleCodes);
  };

  const saveSettings = async () => {
    if (!isSuperAdmin) {
      toast({ title: "Permission denied", description: "Only super admin can change global settings", variant: "destructive" });
      return;
    }

    setSavingSettings(true);
    const payload = [
      { key: "similarity_threshold", value: similarityThreshold },
      { key: "complexity_threshold", value: complexityThreshold },
    ];

    const { error } = await supabase.from("system_settings").upsert(payload as any, { onConflict: "key" });

    if (error) {
      toast({ title: "Failed to save settings", description: error.message, variant: "destructive" });
      setSavingSettings(false);
      return;
    }

    toast({ title: "Settings saved" });
    await fetchSettings();
    setSavingSettings(false);
  };

  const addModeratorModule = async () => {
    const normalizedModuleCode = normalizeModuleCode(newModuleCode);
    if (!selectedModeratorId || !normalizedModuleCode) return;

    if (!isSuperAdmin && !adminModuleSet.has(normalizedModuleCode)) {
      toast({
        title: "Module not allowed",
        description: "You can only assign moderators inside your supervised modules.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("moderator_modules").insert({
      user_id: selectedModeratorId,
      module_code: normalizedModuleCode,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Module assigned" });
      setNewModuleCode("");
      setSelectedModeratorId("");
      await fetchModeratorModules(userModuleMap, adminModuleCodes);
    }
  };

  const removeModeratorModule = async (id: string) => {
    const assignment = moderatorModules.find((row) => row.id === id);
    if (!assignment) return;

    if (!isSuperAdmin && !adminModuleSet.has(normalizeModuleCode(assignment.module_code))) {
      toast({ title: "Permission denied", description: "You can only remove assignments in your supervised modules", variant: "destructive" });
      return;
    }

    await supabase.from("moderator_modules").delete().eq("id", id);
    toast({ title: "Module assignment removed" });
    await fetchModeratorModules(userModuleMap, adminModuleCodes);
  };

  const uploadPastYearAssessment = async () => {
    if (!pastYearFile) return;
    if (!apiBaseUrl) {
      toast({
        title: "Backend URL not configured",
        description: "Set VITE_API_BASE_URL for production deployment.",
        variant: "destructive",
      });
      return;
    }

    setUploadingPastYear(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Unable to identify current user");

      const formData = new FormData();
      formData.append("module_code", normalizeModuleCode(pastYearModuleCode));
      formData.append("module_name", pastYearModuleName.trim());
      formData.append("exam_year", pastYearExamYear.trim());
      formData.append("exam_month", pastYearExamMonth.trim().toUpperCase());
      formData.append("uploaded_by", userId);
      formData.append("file", pastYearFile);

      const response = await fetch(`${apiBaseUrl}/api/internal-questions/upload`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail ?? payload?.reason ?? "Past-year upload failed");
      }

      toast({
        title: "Past year questions uploaded",
        description: `${payload?.rows ?? 0} question(s) saved to internal_questions.`,
      });

      setPastYearModuleCode("");
      setPastYearModuleName("");
      setPastYearExamYear("");
      setPastYearExamMonth("");
      setPastYearFile(null);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPastYear(false);
    }
  };

  const moderators = users.filter((u) => u.roles.includes("moderator"));

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "moderator":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">Manage users, module assignments, and moderation settings</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isSuperAdmin && (
            <p className="text-sm text-muted-foreground">
              This account is the only super admin in the system.
            </p>
          )}
          {!isSuperAdmin && (
            <p className="text-sm text-muted-foreground">
              Your supervision scope: {adminModuleCodes.length > 0 ? adminModuleCodes.join(", ") : "No module assigned"}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="modules" className="gap-2"><BookOpen className="h-4 w-4" /> Module Assignments</TabsTrigger>
          <TabsTrigger value="past-year" className="gap-2"><Upload className="h-4 w-4" /> Past Year Upload</TabsTrigger>
          <TabsTrigger value="flagged" className="gap-2"><Shield className="h-4 w-4" /> Flagged</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{isSuperAdmin ? "All Users" : "Users In Your Modules"}</CardTitle>
              <CardDescription>
                {isSuperAdmin
                  ? "Manage all user roles in the system"
                  : "You can manage lecturer/moderator roles for users under your supervised modules"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No users found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Roles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "-"}</TableCell>
                        <TableCell>{u.department || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {(["admin", "moderator", "lecturer"] as const).map((role) => {
                              const active = u.roles.includes(role);
                              const canToggle = isSuperAdmin || role !== "admin";

                              return (
                                <Badge
                                  key={role}
                                  variant={active ? (roleBadgeColor(role) as any) : "outline"}
                                  className={`select-none transition-opacity ${canToggle ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${!active ? "opacity-40" : ""}`}
                                  onClick={() => canToggle && toggleRole(u.user_id, role)}
                                >
                                  {role}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Moderator - Module Assignments</CardTitle>
              <CardDescription>Assign moderators to module codes. Admin users are restricted to their supervised modules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label>Moderator</Label>
                  <Select value={selectedModeratorId} onValueChange={setSelectedModeratorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select moderator" />
                    </SelectTrigger>
                    <SelectContent>
                      {moderators.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || "Unknown"} ({m.roles.join(", ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Module Code</Label>
                  <Input
                    placeholder="e.g. BUS201"
                    value={newModuleCode}
                    onChange={(e) => setNewModuleCode(e.target.value)}
                  />
                </div>
                <Button onClick={addModeratorModule} disabled={!selectedModeratorId || !newModuleCode.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Assign
                </Button>
              </div>

              {moderatorModules.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Moderator</TableHead>
                      <TableHead>Module Code</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moderatorModules.map((mm) => (
                      <TableRow key={mm.id}>
                        <TableCell className="font-medium">{mm.moderator_name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{mm.module_code}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeModeratorModule(mm.id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No module assignments yet. Add one above.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past-year" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Internal Question Bank Upload</CardTitle>
              <CardDescription>Upload past-year assessment PDFs to save extracted questions into the internal database for similarity checks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Module Code</Label>
                  <Input placeholder="e.g. CSC6000" value={pastYearModuleCode} onChange={(e) => setPastYearModuleCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Module Name</Label>
                  <Input placeholder="e.g. Data Structures and Algorithms" value={pastYearModuleName} onChange={(e) => setPastYearModuleName(e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Exam Year</Label>
                  <Input placeholder="e.g. 2023" value={pastYearExamYear} onChange={(e) => setPastYearExamYear(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Exam Month</Label>
                  <Input placeholder="e.g. APRIL" value={pastYearExamMonth} onChange={(e) => setPastYearExamMonth(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assessment PDF</Label>
                <Input type="file" accept=".pdf" onChange={(e) => setPastYearFile(e.target.files?.[0] ?? null)} />
                {pastYearFile && <p className="text-xs text-muted-foreground">Selected: {pastYearFile.name} ({(pastYearFile.size / 1024).toFixed(1)} KB)</p>}
              </div>

              <Button
                className="gap-2"
                onClick={uploadPastYearAssessment}
                disabled={uploadingPastYear || !pastYearFile || !pastYearModuleCode.trim() || !pastYearModuleName.trim() || !pastYearExamYear.trim() || !pastYearExamMonth.trim()}
              >
                {uploadingPastYear ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploadingPastYear ? "Uploading..." : "Upload to internal database"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flagged" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Flagged Assessments</CardTitle>
              <CardDescription>Assessments with major moderation issues are listed here for admin review.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAssessments ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : flaggedAssessments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No flagged assessments found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="w-28"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flaggedAssessments.map((assessment) => (
                      <TableRow key={assessment.id}>
                        <TableCell className="font-medium">{assessment.title}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono">{assessment.course}</Badge></TableCell>
                        <TableCell>{assessment.date}</TableCell>
                        <TableCell className="font-mono">{assessment.overallScore}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{assessment.flagReason ?? "Major moderation issue detected"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/assessment-detail/${encodeURIComponent(assessment.id)}`)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Settings</CardTitle>
                <CardDescription>Configure moderation thresholds and criteria</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-3">
                  <Label>Similarity Threshold: <span className="font-bold text-primary">{similarityThreshold}%</span></Label>
                  <Slider value={[similarityThreshold]} onValueChange={(v) => setSimilarityThreshold(v[0])} min={0} max={100} step={5} />
                  <p className="text-xs text-muted-foreground">Questions above this threshold will be flagged for potential duplication</p>
                </div>
                <div className="space-y-3">
                  <Label>Complexity Threshold: <span className="font-bold text-primary">{complexityThreshold}%</span></Label>
                  <Slider value={[complexityThreshold]} onValueChange={(v) => setComplexityThreshold(v[0])} min={0} max={100} step={5} />
                  <p className="text-xs text-muted-foreground">Questions below this threshold will be flagged as too simple</p>
                </div>
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
