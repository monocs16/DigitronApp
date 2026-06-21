/* eslint-disable react-refresh/only-export-components -- AuthProvider and useAuth are intentionally co-located */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
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
  /** True once initial session resolution and profile load (if any) have finished. */
  authReady: boolean;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const maxAttempts = 6;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const {
        data: { session: activeSession },
      } = await authService.getSession();

      if (!activeSession?.access_token) {
        await sleep(100 * (attempt + 1));
        continue;
      }

      try {
        const [profileRow, roleRows] = await Promise.all([
          profilesRepository.getById(uid),
          userRolesRepository.getByUserId(uid),
        ]);
        const loadedRoles = roleRows.map((r) => r.role as AppRole);
        if (profileRow || loadedRoles.length > 0) {
          setProfile((profileRow as Profile | null) ?? null);
          setRoles(loadedRoles);
          return;
        }
      } catch (err) {
        console.error(`[auth] loadProfile attempt ${attempt + 1} failed:`, err);
      }

      await sleep(150 * (attempt + 1));
    }

    console.error("[auth] loadProfile exhausted retries for user", uid);
  }, []);

  useEffect(() => {
    let active = true;
    let initialized = false;
    let applySessionInFlight: Promise<void> | null = null;

    const applySession = async (newSession: Session | null) => {
      if (!active) return;
      if (applySessionInFlight) {
        await applySessionInFlight;
        return;
      }

      applySessionInFlight = (async () => {
        setAuthReady(false);
        setSession(newSession);
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setAuthReady(true);
        setLoading(false);
        initialized = true;
        if (newSession) {
          void qc.invalidateQueries();
        }
      })();

      try {
        await applySessionInFlight;
      } finally {
        applySessionInFlight = null;
      }
    };

    const { data: sub } = authService.onAuthStateChange((event, newSession) => {
      if (event === "TOKEN_REFRESHED") {
        setSession(newSession);
        return;
      }
      if (event === "INITIAL_SESSION") {
        void applySession(newSession);
        return;
      }

      setSession(newSession);
      if (newSession?.user) {
        setAuthReady(false);
        void loadProfile(newSession.user.id).finally(() => {
          if (active) setAuthReady(true);
        });
        void qc.invalidateQueries();
      } else {
        setProfile(null);
        setRoles([]);
        setAuthReady(true);
      }
    });

    void authService.getSession().then(({ data }) => {
      if (!active || initialized) return;
      if (data.session) {
        void applySession(data.session);
      }
      // If session is still null, wait for INITIAL_SESSION before clearing loading.
    });

    const bootstrapTimeout = setTimeout(() => {
      if (!active || initialized) return;
      void applySession(null);
    }, 5_000);

    return () => {
      active = false;
      clearTimeout(bootstrapTimeout);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, qc]);

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
        authReady,
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
