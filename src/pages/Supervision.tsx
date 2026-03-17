import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Loader2, GraduationCap, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type SupervisedUser = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  roles: string[];
};

const ROLE_DISPLAY_ORDER = ["admin", "moderator", "lecturer"] as const;
const DESIGNATED_SUPER_ADMIN_EMAIL = "wyeyi621@gmail.com";

function sortRolesForDisplay(roles: string[]): string[] {
  const order = new Map<string, number>(ROLE_DISPLAY_ORDER.map((role, index) => [role, index]));
  return [...roles].sort((a, b) => {
    const aRank = order.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bRank = order.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
}

export default function Supervision() {
  const [users, setUsers] = useState<SupervisedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isSuperAdmin } = useAuth();

  const normalizeModuleCode = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

  useEffect(() => {
    fetchSupervisedUsers();
  }, [user?.id, isSuperAdmin]);

  const fetchSupervisedUsers = async () => {
    if (!user?.id) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const [profilesRes, rolesRes, moduleMapRes, moderatorModulesRes, analysisRowsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, department"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("system_settings").select("value").eq("key", "user_module_map").maybeSingle(),
      supabase.from("moderator_modules").select("user_id, module_code"),
      supabase.from("question_analysis_results").select("uploaded_by, module_code"),
    ]);

    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];

    const rawModuleMap =
      moduleMapRes.data?.value && typeof moduleMapRes.data.value === "object" && !Array.isArray(moduleMapRes.data.value)
        ? (moduleMapRes.data.value as Record<string, unknown>)
        : {};

    const userModuleMap = new Map<string, string[]>();
    for (const [mappedUserId, rawModules] of Object.entries(rawModuleMap)) {
      if (!Array.isArray(rawModules)) continue;
      const normalizedModules = rawModules
        .map((moduleCode) => (typeof moduleCode === "string" ? normalizeModuleCode(moduleCode) : ""))
        .filter(Boolean);
      userModuleMap.set(mappedUserId, [...new Set(normalizedModules)]);
    }

    // Include explicit moderator module assignments.
    for (const row of moderatorModulesRes.data ?? []) {
      const moduleCode = normalizeModuleCode((row as { module_code: string | null }).module_code);
      const mappedUserId = (row as { user_id: string | null }).user_id ?? "";
      if (!mappedUserId || !moduleCode) continue;
      const existing = userModuleMap.get(mappedUserId) ?? [];
      userModuleMap.set(mappedUserId, [...new Set([...existing, moduleCode])]);
    }

    // Infer lecturer supervision modules from uploaded assessments in analysis data.
    for (const row of analysisRowsRes.data ?? []) {
      const moduleCode = normalizeModuleCode((row as { module_code: string | null }).module_code);
      const uploadedBy = (row as { uploaded_by: string | null }).uploaded_by ?? "";
      if (!uploadedBy || !moduleCode) continue;
      const existing = userModuleMap.get(uploadedBy) ?? [];
      userModuleMap.set(uploadedBy, [...new Set([...existing, moduleCode])]);
    }

    const fallbackModule = normalizeModuleCode((user.user_metadata as any)?.module_code as string | undefined);
    const adminModules = new Set<string>([
      ...(userModuleMap.get(user.id) ?? []),
      ...(fallbackModule ? [fallbackModule] : []),
    ]);

    if (!isSuperAdmin && adminModules.size === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    if (profiles) {
      const mapped = profiles
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          department: p.department,
          roles: roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) ?? [],
        }))
        .filter((u) => {
          if ((u.email ?? "").trim().toLowerCase() === DESIGNATED_SUPER_ADMIN_EMAIL) return false;
          if (!(u.roles.includes("lecturer") || u.roles.includes("moderator"))) return false;
          if (isSuperAdmin) return true;
          const targetModules = userModuleMap.get(u.user_id) ?? [];
          return targetModules.some((moduleCode) => adminModules.has(moduleCode));
        });
      setUsers(mapped);
    }
    setLoading(false);
  };

  const lecturers = users.filter((u) => u.roles.includes("lecturer"));
  const moderators = users.filter((u) => u.roles.includes("moderator"));

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "default";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Supervision
        </h1>
        <p className="text-muted-foreground mt-1">View lecturers and moderators under your supervision</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Lecturers</CardTitle>
            </div>
            <CardDescription>{lecturers.length} lecturers under supervision</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Moderators</CardTitle>
            </div>
            <CardDescription>{moderators.length} moderators under supervision</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="lecturers">
        <TabsList>
          <TabsTrigger value="lecturers" className="gap-2"><GraduationCap className="h-4 w-4" /> Lecturers ({lecturers.length})</TabsTrigger>
          <TabsTrigger value="moderators" className="gap-2"><ClipboardCheck className="h-4 w-4" /> Moderators ({moderators.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lecturers" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {lecturers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No lecturers found</p>
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
                    {lecturers.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {sortRolesForDisplay(u.roles).map((r) => (
                              <Badge key={r} variant={roleBadgeVariant(r) as any} className="capitalize min-w-[92px] justify-center text-center">
                                {r}
                              </Badge>
                            ))}
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

        <TabsContent value="moderators" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {moderators.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No moderators found</p>
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
                    {moderators.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {sortRolesForDisplay(u.roles).map((r) => (
                              <Badge key={r} variant={roleBadgeVariant(r) as any} className="capitalize min-w-[92px] justify-center text-center">
                                {r}
                              </Badge>
                            ))}
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
      </Tabs>
    </div>
  );
}
