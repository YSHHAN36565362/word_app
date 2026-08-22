"use client";

import { createContext, ReactNode, useContext, useState } from "react";

interface FocusModeState {
  focus: boolean;
  setFocus: (v: boolean) => void;
}

const FocusModeContext = createContext<FocusModeState>({ focus: false, setFocus: () => {} });

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState(false);
  return <FocusModeContext.Provider value={{ focus, setFocus }}>{children}</FocusModeContext.Provider>;
}

export function useFocusMode() {
  return useContext(FocusModeContext);
}
