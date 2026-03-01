import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "dark"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className={theme}>
      {children}
      <button
        onClick={toggleTheme}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-primary text-primary-foreground shadow-lg z-50 hover-elevate"
        data-testid="button-theme-toggle"
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>
    </div>
  );
}
