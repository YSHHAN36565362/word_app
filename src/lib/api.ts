"use client";

import { WordEntry } from "./types";

export async function fetchWords(paths: string[]): Promise<WordEntry[]> {
  const res = await fetch("/api/wordlist/words", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
  const data = await res.json();
  return data.words as WordEntry[];
}

export async function fetchRadicalWords(paths: string[]): Promise<WordEntry[]> {
  const res = await fetch("/api/wordlist/radical-words", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
  const data = await res.json();
  return data.words as WordEntry[];
}

export async function fetchScriptLines(paths: string[]): Promise<string[]> {
  const res = await fetch("/api/wordlist/script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
  const data = await res.json();
  return data.lines as string[];
}
