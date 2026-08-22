export interface WordEntry {
  word: string;
  meaning: string;
  hint: string;
}

export interface FileRef {
  path: string;   // full repo path, e.g. word_list/Japanese/N2/2026-08-13_x.txt
  label: string;  // display label, e.g. "[N2] 2026-08-13_x.txt"
  filename: string;
}

export interface SubfolderNode {
  name: string;
  files: FileRef[];
}

export interface CategoryNode {
  name: string;
  subfolders: SubfolderNode[];
  files: FileRef[]; // files directly under the category (used when no subfolders)
}

export interface WordTree {
  categories: CategoryNode[];
  error?: string;
}

export type StudyMode = "word_only" | "meaning_only" | "random";

export type ScoreLevel = 100 | 60 | 40 | 0;

export interface StudyProgress {
  words: WordEntry[];
  filesLabel: string[];
  studyIndex: number;
  wordsAreRadicals: boolean;
}

export interface PracticeProgress {
  filesLabel: string[];
  mode: StudyMode;
  queue: WordEntry[];
  currentWord: WordEntry | null;
  displaySide: 0 | 1;
  totalCount: number;
  doneCount: number;
  wordsAreRadicals: boolean;
}

export interface ExamProgress {
  filesLabel: string[];
  mode: StudyMode;
  queue: WordEntry[];
  currentWord: WordEntry | null;
  displaySide: 0 | 1;
  totalCount: number;
  currentNumber: number;
  correctCount: number;
  wrongCount: number;
}

export interface ScriptProgress {
  lines: string[];
  filesLabel: string[];
  scriptIndex: number;
}

export interface StudyStatRecord {
  date: string;
  part: "practice" | "exam";
  total: number;
  correct: number;
}

export interface RadicalInfo {
  reading: string;
  desc: string;
}

export type RadicalLibrary = Record<string, RadicalInfo>;
