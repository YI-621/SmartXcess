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
import { Shield, Users, Settings, Save, Loader2, Plus, X, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [similarityThreshold, setSimilarityThreshold] = useState(75);
  const [complexityThreshold, setComplexityThreshold] = useState(60);
  const [savingSettings, setSavingSettings] = useState(false);
  const [moderatorModules, setModeratorModules] = useState<ModeratorModule[]>([]);
  const [newModuleCode, setNewModuleCode] = useState("");
  const [selectedModeratorId, setSelectedModeratorId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchModeratorModules();
  }, []);

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
    const { data } = await supabase.from("system_settings").select("key, value");
    if (data) {
      const sim = data.find((s) => s.key === "similarity_threshold");
      const comp = data.find((s) => s.key === "complexity_threshold");
      if (sim) setSimilarityThreshold(Number(JSON.parse(JSON.stringify(sim.value))));
      if (comp) setComplexityThreshold(Number(JSON.parse(JSON.stringify(comp.value))));
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
    await Promise.all([
      supabase.from("system_settings").update({ value: JSON.stringify(similarityThreshold) as any }).eq("key", "similarity_threshold"),
      supabase.from("system_settings").update({ value: JSON.stringify(complexityThreshold) as any }).eq("key", "complexity_threshold"),
    ]);
    toast({ title: "Settings saved" });
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
