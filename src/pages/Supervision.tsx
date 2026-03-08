import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Loader2, GraduationCap, ClipboardCheck } from "lucide-react";

type SupervisedUser = {
  user_id: string;
  full_name: string | null;
  department: string | null;
  roles: string[];
};

export default function Supervision() {
  const [users, setUsers] = useState<SupervisedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSupervisedUsers();
  }, []);

  const fetchSupervisedUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, department");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    if (profiles) {
      const mapped = profiles
        .map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          department: p.department,
          roles: roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) ?? [],
        }))
        .filter((u) => u.roles.includes("lecturer") || u.roles.includes("moderator"));
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
                          {u.roles.map((r) => (
                            <Badge key={r} variant={roleBadgeVariant(r) as any} className="mr-1 capitalize">{r}</Badge>
                          ))}
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
                          {u.roles.map((r) => (
                            <Badge key={r} variant={roleBadgeVariant(r) as any} className="mr-1 capitalize">{r}</Badge>
                          ))}
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
