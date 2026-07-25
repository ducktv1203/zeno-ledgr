"use client";

import { useMemo } from "react";
import { createLocalAuthClient, isLocalAuthMode, type AuthClient } from "@/lib/auth/local-client";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Returns an auth client. Local/Docker mode uses the FastAPI /auth endpoints.
 * Supabase mode uses the hosted Supabase Auth client when configured.
 */
export function useAuthClient(): AuthClient | null {
  return useMemo(() => {
    if (isLocalAuthMode()) {
      return createLocalAuthClient();
    }
    const supabase = getBrowserSupabase();
    return supabase as unknown as AuthClient | null;
  }, []);
}
