"use client";

import { useMemo } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function useAuthClient() {
  return useMemo(() => getBrowserSupabase(), []);
}

