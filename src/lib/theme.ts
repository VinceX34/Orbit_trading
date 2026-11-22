export type ThemeChoice = "light" | "dark" | "system";

export const themeBoot =
  '(function(){try{var c=localStorage.getItem("orbit-theme")||"system";var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themeChoice=c==="light"||c==="dark"?c:"system";}catch(e){}})();';

export function applyTheme(choice: ThemeChoice) {
  localStorage.setItem("orbit-theme", choice);
  const dark = choice === "dark" || (choice !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeChoice = choice;
  window.dispatchEvent(new Event("orbit-theme"));
}

export function currentTheme(): ThemeChoice {
  const value = document.documentElement.dataset.themeChoice;
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}
