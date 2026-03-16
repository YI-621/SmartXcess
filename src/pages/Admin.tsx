import { useEffect, useState } from "react";
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

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [similarityThreshold, setSimilarityThreshold] = useState(75);
  const [complexityThreshold, setComplexityThreshold] = useState(60);
  const [savingSettings, setSavingSettings] = useState(false);
  const [moderatorModules, setModeratorModules] = useState<ModeratorModule[]>([]);
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
  const apiBaseUrl = import.meta.env.DEV
    ? ((import.meta.env.VITE_API_BASE_URL_LOCAL as string | undefined) ?? "http://127.0.0.1:8000")
    : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "");

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchModeratorModules();
  }, []);

  const toNumericSetting = (value: unknown, fallback: number) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, department");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (profiles) {
      const mapped = profiles.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        department: p.department,
        roles: roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) ?? [],
      }));
      setUsers(mapped);
    }
    setLoading(false);
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

  const fetchModeratorModules = async () => {
    const { data } = await supabase.from("moderator_modules").select("*");
    if (data) {
      // We'll merge with profiles to get names
      const userIds = [...new Set(data.map((d: any) => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name ?? "Unknown"]));
      
      setModeratorModules(data.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        module_code: d.module_code,
        moderator_name: nameMap.get(d.user_id) ?? "Unknown",
      })));
    }
  };

  const toggleRole = async (userId: string, role: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return;
    const hasRole = user.roles.includes(role);
    if (hasRole) {
      // Don't allow removing the last role
      if (user.roles.length <= 1) {
        toast({ title: "Cannot remove last role", description: "A user must have at least one role", variant: "destructive" });
        return;
      }
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      toast({ title: `Removed ${role} role` });
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      toast({ title: `Added ${role} role` });
    }
    fetchUsers();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const payload = [
      { key: "similarity_threshold", value: similarityThreshold },
      { key: "complexity_threshold", value: complexityThreshold },
    ];

    const { error } = await supabase
      .from("system_settings")
      .upsert(payload as any, { onConflict: "key" });

    if (error) {
      toast({ title: "Failed to save settings", description: error.message, variant: "destructive" });
      setSavingSettings(false);
      return;
    }

    toast({ title: "Settings saved" });
    fetchSettings();
    setSavingSettings(false);
  };

  const addModeratorModule = async () => {
    if (!selectedModeratorId || !newModuleCode.trim()) return;
    const { error } = await supabase.from("moderator_modules").insert({
      user_id: selectedModeratorId,
      module_code: newModuleCode.trim().toUpperCase(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Module assigned" });
      setNewModuleCode("");
      setSelectedModeratorId("");
      fetchModeratorModules();
    }
  };

  const removeModeratorModule = async (id: string) => {
    await supabase.from("moderator_modules").delete().eq("id", id);
    toast({ title: "Module assignment removed" });
    fetchModeratorModules();
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
      formData.append("module_code", pastYearModuleCode.trim().toUpperCase());
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

  const moderators = users.filter((u) => u.roles.includes("moderator") || u.roles.includes("admin"));

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "default";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1">Manage users, roles, module assignments, and system settings</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="modules" className="gap-2"><BookOpen className="h-4 w-4" /> Module Assignments</TabsTrigger>
          <TabsTrigger value="past-year" className="gap-2"><Upload className="h-4 w-4" /> Past Year Upload</TabsTrigger>
          <TabsTrigger value="flagged" className="gap-2"><Shield className="h-4 w-4" /> Flagged</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage user roles and permissions</CardDescription>
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
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {(["admin", "moderator", "lecturer"] as const).map((role) => {
                              const active = u.roles.includes(role);
                              return (
                                <Badge
                                  key={role}
                                  variant={active ? roleBadgeColor(role) as any : "outline"}
                                  className={`cursor-pointer select-none transition-opacity ${!active ? "opacity-40" : ""}`}
                                  onClick={() => toggleRole(u.user_id, role)}
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
              <CardTitle>Moderator → Module Assignments</CardTitle>
              <CardDescription>Assign moderators to specific module codes. When a lecturer uploads an assessment with a module code, it will be automatically assigned to the mapped moderator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add new assignment */}
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

              {/* Current assignments */}
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
                  <Input
                    placeholder="e.g. CSC6000"
                    value={pastYearModuleCode}
                    onChange={(e) => setPastYearModuleCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Module Name</Label>
                  <Input
                    placeholder="e.g. Data Structures and Algorithms"
                    value={pastYearModuleName}
                    onChange={(e) => setPastYearModuleName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Exam Year</Label>
                  <Input
                    placeholder="e.g. 2023"
                    value={pastYearExamYear}
                    onChange={(e) => setPastYearExamYear(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exam Month</Label>
                  <Input
                    placeholder="e.g. APRIL"
                    value={pastYearExamMonth}
                    onChange={(e) => setPastYearExamMonth(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assessment PDF</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPastYearFile(e.target.files?.[0] ?? null)}
                />
                {pastYearFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {pastYearFile.name} ({(pastYearFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
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
      </Tabs>
    </div>
  );
}