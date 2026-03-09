import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, User, Plus, X, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useUserModules, useAddModule, useRemoveModule } from "@/hooks/useData";

export default function Profile() {
  const { user, profile, roles, activeRole, switchRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [saving, setSaving] = useState(false);
  const [newModule, setNewModule] = useState("");

  const { data: modules, isLoading: modulesLoading } = useUserModules();
  const addModuleMutation = useAddModule();
  const removeModuleMutation = useRemoveModule();

  const switchableRoles = roles.filter((r) => r === "lecturer" || r === "moderator");
  const canSwitch = switchableRoles.length > 1;

  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, department })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  const addModule = () => {
    const trimmed = newModule.trim();
    if (trimmed) {
      addModuleMutation.mutate(trimmed, {
        onSuccess: () => setNewModule(""),
        onError: (err: any) => toast({ title: "Failed to add module", description: err.message, variant: "destructive" }),
      });
    }
  };

  const handleRoleSwitch = (role: string) => {
    switchRole(role as any);
    toast({ title: `Switched to ${role} view` });
    if (role === "moderator") navigate("/moderate");
    else if (role === "lecturer") navigate("/");
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "default";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="h-6 w-6 text-primary" /> Profile Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your personal information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{fullName || "Your Name"}</CardTitle>
              <CardDescription>{user?.email}</CardDescription>
              <div className="flex gap-1 mt-1">
                {roles.map((r) => (
                  <Badge key={r} variant={roleBadgeVariant(r) as any} className="text-[10px] capitalize">
                    {r}
                    {r === activeRole && <span className="ml-1 text-[8px]">●</span>}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Current Role</Label>
            <p className="text-sm font-medium text-foreground capitalize">{activeRole ?? roles[0] ?? "—"}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {canSwitch && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Switch Role
            </CardTitle>
            <CardDescription>You have multiple roles. Switch between Lecturer and Moderator views.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={activeRole ?? ""} onValueChange={handleRoleSwitch}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {switchableRoles.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Modules</CardTitle>
          <CardDescription>Add the modules you are teaching or moderating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. CS201 - Data Structures"
              value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addModule()}
            />
            <Button variant="outline" size="icon" onClick={addModule} disabled={addModuleMutation.isPending}>
              {addModuleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          {modulesLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : modules && modules.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {modules.map((mod) => (
                <Badge key={mod.id} variant="secondary" className="text-xs gap-1 pr-1">
                  {mod.module_name}
                  <button
                    onClick={() => removeModuleMutation.mutate(mod.id)}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No modules added yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
