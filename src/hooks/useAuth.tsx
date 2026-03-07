import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "moderator" | "lecturer";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  profile: { full_name: string | null; department: string | null; avatar_url: string | null } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);

  const fetchUserData = async (userId: string) => {
    setRolesLoading(true);
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, department, avatar_url").eq("user_id", userId).single(),
    ]);
    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r) => r.role as AppRole));
    } else {
      setRoles([]);
    }
    if (profileRes.data) {
      setProfile(profileRes.data);
    } else {
      setProfile(null);
    }
    setRolesLoading(false);
  };

  useEffect(() => {
    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Load role/profile in background so initial screen is not blocked.
        fetchUserData(nextSession.user.id).catch(() => {
          setRoles([]);
          setProfile(null);
          setRolesLoading(false);
        });
      } else {
        setRoles([]);
        setProfile(null);
        setRolesLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, rolesLoading, roles, isAdmin: roles.includes("admin"), profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
