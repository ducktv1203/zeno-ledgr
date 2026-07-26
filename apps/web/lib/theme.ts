export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "zenoledgr-theme";
export const THEME_CHANGE_EVENT = "zenoledgr:themechange";

/** Dark is the default; light is opt-in. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * Runs before first paint to avoid a flash of the wrong theme. Inlined into the
 * document head as a string, so it must stay dependency-free and self-contained.
 * The server already renders <html class="dark">, so this only has to undo that.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark" ? stored : "${DEFAULT_THEME}";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export function readTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage — the theme still applies for this session.
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
}
