"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 기본 모드는 다크. localStorage는 서버에 없으므로, SSR과의 hydration 불일치를 피하기
  // 위해 서버/클라이언트가 항상 같은 초기값("dark")으로 먼저 렌더한 뒤 마운트 후에만
  // 저장된 값(사용자가 라이트로 직접 바꾼 적이 있으면 그 값)으로 갱신한다.
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = window.localStorage.getItem("word_app_theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    }
    // 저장된 값이 없으면 기기 설정(matchMedia)과 무관하게 다크를 기본값으로 유지한다.
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
