import { supabase } from "@/integrations/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type AuthStateCallback = (event: AuthChangeEvent, session: Session | null) => void | Promise<void>;

export const authService = {
  getSession: () => supabase.auth.getSession(),
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
  onAuthStateChange: (cb: AuthStateCallback) => supabase.auth.onAuthStateChange(cb),
};
