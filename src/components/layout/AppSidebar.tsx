import { ClipboardCheck, FileText, History, Home, LogOut, Shield, User, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const roleNavItems: Record<string, { to: string; icon: any; label: string }[]> = {
  lecturer: [
    { to: "/dashboard", icon: Home, label: "Dashboard" },
    { to: "/assessments", icon: FileText, label: "Assessments" },
  ],
  moderator: [
    { to: "/moderate", icon: ClipboardCheck, label: "Moderate" },
    { to: "/history", icon: History, label: "History" },
  ],
  admin: [
    { to: "/dashboard", icon: Home, label: "Dashboard" },
    { to: "/admin-assessments", icon: FileText, label: "Assessments" },
    { to: "/supervision", icon: Users, label: "Supervision" },
    { to: "/admin", icon: Shield, label: "Admin" },
  ],
};

export function AppSidebar() {
  const location = useLocation();
  const { profile, activeRole, roles, signOut, user } = useAuth();
  const { toast } = useToast();

  const navItems = roleNavItems[activeRole ?? "lecturer"] ?? roleNavItems.lecturer;

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";

  const displayRole = activeRole ?? roles[0] ?? "Lecturer";

  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    supabase.auth.getSession().then(({ data }) => {
      sessionTokenRef.current = data.session?.access_token || null;
    });

    const interval = setInterval(async () => {
      await supabase
        .from("user_sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("user_id", user.id);
    }, 5 * 1000);

    const handleTabClose = () => {
      if (!sessionTokenRef.current) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      fetch(`${supabaseUrl}/rest/v1/user_sessions?user_id=eq.${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${sessionTokenRef.current}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ is_logged_in: false }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("pagehide", handleTabClose);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", handleTabClose);
    };
  }, [user]);

  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const logoutDueToInactivity = async () => {
      toast({
        title: "Session Expired",
        description: "You have been logged out due to 15 minutes of inactivity.",
        variant: "destructive",
      });

      await supabase
        .from("user_sessions")
        .update({ is_logged_in: false })
        .eq("user_id", user.id);

      await signOut();
    };

    const resetInactivityTimer = () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      inactivityTimeoutRef.current = setTimeout(logoutDueToInactivity, 15 * 60 * 1000);
    };

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];

    resetInactivityTimer();

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [user, signOut, toast]);

  const handleSignOut = async () => {
    if (user) {
      await supabase
        .from("user_sessions")
        .update({ is_logged_in: false })
        .eq("user_id", user.id);
    }
    await signOut();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card flex flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <ClipboardCheck className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">SmartXcess</h1>
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
            <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email || user?.email}</p>
            <p className="text-[10px] text-muted-foreground truncate capitalize">{displayRole}</p>
          </div>
        </NavLink>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
