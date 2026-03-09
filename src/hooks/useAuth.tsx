import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "moderator" | "lecturer";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  activeRole: AppRole | null;
  isAdmin: boolean;
  profile: { full_name: string | null; department: string | null; avatar_url: string | null } | null;
  signOut: () => Promise<void>;
  switchRole: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, department, avatar_url").eq("user_id", userId).single(),
    ]);
    if (rolesRes.data) {
      const userRoles = rolesRes.data.map((r) => r.role as AppRole);
      setRoles(userRoles);
      // Set initial active role: admin > moderator > lecturer
      if (!activeRole || !userRoles.includes(activeRole)) {
        if (userRoles.includes("admin")) setActiveRole("admin");
        else if (userRoles.includes("moderator")) setActiveRole("moderator");
        else if (userRoles.includes("lecturer")) setActiveRole("lecturer");
        else setActiveRole(userRoles[0] ?? null);
      }
    }
    if (profileRes.data) setProfile(profileRes.data);
  };

  const switchRole = (role: AppRole) => {
    if (roles.includes(role)) {
      setActiveRole(role);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setRoles([]);
        setProfile(null);
        setActiveRole(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, activeRole, isAdmin: roles.includes("admin"), profile, signOut: async () => { await supabase.auth.signOut(); }, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
