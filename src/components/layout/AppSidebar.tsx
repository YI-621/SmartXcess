import { ClipboardCheck, FileText, History, Home, LogOut, Shield, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const allNavItems = [
  { to: "/", icon: Home, label: "Dashboard", roles: ["lecturer"] },
  { to: "/assessments", icon: FileText, label: "Assessments", roles: ["lecturer"] },
  { to: "/moderate", icon: ClipboardCheck, label: "Moderate", roles: ["moderator"] },
  { to: "/history", icon: History, label: "History", roles: ["moderator"] },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, isAdmin, roles, signOut, user } = useAuth();

  // Admin sees everything; others see role-filtered items
  const navItems = isAdmin
    ? allNavItems
    : allNavItems.filter((item) => roles.some((r) => item.roles.includes(r)));

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card flex flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <ClipboardCheck className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">AssessMod</h1>
          <p className="text-[10px] text-muted-foreground">Assessment Moderator</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname === item.to
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <NavLink
            to="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              location.pathname === "/admin"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-1">
        <NavLink
          to="/profile"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
            location.pathname === "/profile"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || user?.email}</p>
            <p className="text-[10px] text-muted-foreground truncate">{profile?.department || "Lecturer"}</p>
          </div>
        </NavLink>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
