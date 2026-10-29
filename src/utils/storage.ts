import type { PromptHistoryEntry } from "../types/promptDoctor";

const STORAGE_KEY = "prompt_doctor_history_v1";
const MAX_HISTORY_ITEMS = 50;

export function loadPromptHistory(): PromptHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PromptHistoryEntry =>
        Boolean(item && typeof item.id === "string" && typeof item.originalPrompt === "string" && item.analysis && item.optimization)
    );
  } catch {
    return [];
  }
}

export function savePromptHistory(entries: PromptHistoryEntry[]): void {
  try {
    const capped = entries.slice(0, MAX_HISTORY_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function upsertHistoryEntry(
  entries: PromptHistoryEntry[],
  entry: PromptHistoryEntry
): PromptHistoryEntry[] {
  const existingIndex = entries.findIndex((item) => item.id === entry.id);
  let next: PromptHistoryEntry[];
  if (existingIndex >= 0) {
    next = [...entries];
    next[existingIndex] = entry;
  } else {
    next = [entry, ...entries];
  }
  const capped = next.slice(0, MAX_HISTORY_ITEMS);
  savePromptHistory(capped);
  return capped;
}

export function deleteHistoryEntryById(
  entries: PromptHistoryEntry[],
  id: string
): PromptHistoryEntry[] {
  const next = entries.filter((item) => item.id !== id);
  savePromptHistory(next);
  return next;
}

export function clearAllPromptHistory(): PromptHistoryEntry[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return [];
}
