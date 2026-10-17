export const THEME_STORAGE_KEY = "theme";

/**
 * Runs inline in <head> before first paint so a returning dark-theme visitor
 * never sees a cream flash. Light is the default; only an explicit choice
 * from ThemeToggle switches it.
 */
export const themeInitScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
