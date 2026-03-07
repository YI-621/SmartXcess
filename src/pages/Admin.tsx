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
import { Shield, Users, Settings, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UserWithRole = {
  user_id: string;
  full_name: string | null;
  department: string | null;
  roles: string[];
};

export default function Admin() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [similarityThreshold, setSimilarityThreshold] = useState(75);
  const [complexityThreshold, setComplexityThreshold] = useState(60);
  const [savingSettings, setSavingSettings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchSettings();
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

  const updateRole = async (userId: string, newRole: string) => {
    // Remove existing roles then add new one
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    toast({ title: "Role updated" });
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
        <p className="text-muted-foreground mt-1">Manage users, roles, and system settings</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> User Management</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> System Settings</TabsTrigger>
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
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell>
                          {u.roles.map((r) => (
                            <Badge key={r} variant={roleBadgeColor(r) as any} className="mr-1">{r}</Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Select onValueChange={(val) => updateRole(u.user_id, val)}>
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Change role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="lecturer">Lecturer</SelectItem>
                            </SelectContent>
                          </Select>
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
