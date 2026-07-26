"use client";

import { useCallback, useEffect, useState } from "react";

import {
  applyTheme,
  DEFAULT_THEME,
  readTheme,
  THEME_CHANGE_EVENT,
  type Theme,
} from "@/lib/theme";

/**
 * Reads the theme from the document (set pre-paint by the init script) and stays
 * in sync with every toggle on the page. Starts at DEFAULT_THEME so the first
 * client render matches the server, then corrects on mount.
 */
export function useTheme(): { theme: Theme; toggle: () => void; mounted: boolean } {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);

    const onChange = () => setTheme(readTheme());
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  const toggle = useCallback(() => {
    applyTheme(readTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggle, mounted };
}
