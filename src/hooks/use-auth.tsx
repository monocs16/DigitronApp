/* eslint-disable react-refresh/only-export-components -- AuthProvider and useAuth are intentionally co-located */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authService } from "@/lib/auth.service";
import { profilesRepository, userRolesRepository } from "@/lib/repositories";
import type { AppRole } from "@/lib/digitron";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  active: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const [profileRow, roleRows] = await Promise.all([
        profilesRepository.getById(uid),
        userRolesRepository.getByUserId(uid),
      ]);
      setProfile((profileRow as Profile | null) ?? null);
      setRoles(roleRows.map((r) => r.role as AppRole));
    } catch (err) {
      console.error("[auth] failed to load profile:", err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    authService.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      } else {
        setProfile(null);
        setRoles([]);
      }
      if (active) setLoading(false);
    });

    const { data: sub } = authService.onAuthStateChange((event, newSession) => {
      if (event === "INITIAL_SESSION") return;
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => void loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = async () => {
    await authService.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        roles,
        loading,
        hasRole,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
