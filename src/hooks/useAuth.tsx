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
  profile: { full_name: string | null; department: string | null; avatar_url: string | null; email: string | null } | null;
  signOut: () => Promise<void>;
  switchRole: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ACTIVE_ROLE_STORAGE_KEY = "smartxcess.activeRole";
const ROLE_CHANGE_EVENT = "smartxcess-role-changed";

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
      supabase.from("profiles").select("full_name, department, avatar_url, email").eq("user_id", userId).single(),
    ]);
    if (rolesRes.data) {
      const userRoles = rolesRes.data.map((r) => r.role as AppRole);
      setRoles(userRoles);
      setActiveRole((prev) => {
        const savedRole = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null;
        if (prev && userRoles.includes(prev)) return prev;
        if (savedRole && userRoles.includes(savedRole)) return savedRole;

        // Default priority for multi-role users: admin > lecturer > moderator
        if (userRoles.includes("admin")) return "admin";
        if (userRoles.includes("lecturer")) return "lecturer";
        if (userRoles.includes("moderator")) return "moderator";
        return userRoles[0] ?? null;
      });
    }
    if (profileRes.data) setProfile(profileRes.data);
  };

  const switchRole = (role: AppRole) => {
    if (roles.includes(role)) {
      setActiveRole(role);
      localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
      window.dispatchEvent(new Event(ROLE_CHANGE_EVENT));
    }
  };

  useEffect(() => {
    const syncRoleFromStorage = () => {
      const savedRole = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as AppRole | null;
      if (savedRole && roles.includes(savedRole)) {
        setActiveRole(savedRole);
      }
    };

    window.addEventListener(ROLE_CHANGE_EVENT, syncRoleFromStorage);
    window.addEventListener("storage", syncRoleFromStorage);

    return () => {
      window.removeEventListener(ROLE_CHANGE_EVENT, syncRoleFromStorage);
      window.removeEventListener("storage", syncRoleFromStorage);
    };
  }, [roles]);

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
        localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
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
