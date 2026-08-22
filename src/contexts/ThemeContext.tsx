"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    // localStorage/matchMedia는 서버에 없으므로, SSR과의 hydration 불일치를 피하기 위해
    // 일부러 "light" 기본값으로 먼저 렌더한 뒤 마운트 후에만 실제 값으로 갱신한다.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = window.localStorage.getItem("word_app_theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("word_app_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
