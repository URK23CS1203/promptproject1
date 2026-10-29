import React, { useMemo, useState } from "react";
import { Search, Trash2, Plus, X, History } from "lucide-react";
import type { PromptHistoryEntry } from "../types/promptDoctor";

type HistoryFilter = "all" | "optimized" | "original" | "tie";

interface HistorySidebarProps {
  entries: PromptHistoryEntry[];
  activeId: string | null;
  onSelectEntry: (entry: PromptHistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onNewSession: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function formatRelativeTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistorySidebar({
  entries,
  activeId,
  onSelectEntry,
  onDeleteEntry,
  onClearAll,
  onNewSession,
  mobileOpen,
  onCloseMobile,
}: HistorySidebarProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== "all") {
        if (!entry.evaluation || entry.evaluation.winner !== filter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        entry.originalPrompt.toLowerCase().includes(q) ||
        entry.optimization.optimizedPrompt.toLowerCase().includes(q) ||
        entry.analysis.detectedIntent.toLowerCase().includes(q)
      );
    });
  }, [entries, query, filter]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-72 shrink-0">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="w-4 h-4 text-slate-500" />
          <span>Prompt History</span>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            ({entries.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onNewSession();
              onCloseMobile();
            }}
            title="Start a fresh prompt session"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2.5 border-b border-slate-200">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved runs..."
            aria-label="Search prompt history"
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-md">
          {(
            [
              { id: "all", label: "All" },
              { id: "optimized", label: "Opt+" },
              { id: "original", label: "Orig+" },
              { id: "tie", label: "Tied" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`py-1 px-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                filter === tab.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredEntries.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-xs font-medium text-slate-700">
              {entries.length === 0 ? "No diagnostic runs yet" : "No matching history items"}
            </p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              {entries.length === 0
                ? "Completed prompt diagnoses and response benchmarks are saved here automatically."
                : "Try clearing your search query or switching the outcome filter."}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isActive = entry.id === activeId;
            const ev = entry.evaluation;
            const outcomeLabel = !ev
              ? "Analyzed only"
              : ev.winner === "optimized"
              ? `Opt +${ev.scoreDelta}`
              : ev.winner === "original"
              ? `Orig +${Math.abs(ev.scoreDelta)}`
              : "Tied 0.0";

            const outcomeColor = !ev
              ? "text-slate-500"
              : ev.winner === "optimized"
              ? "text-emerald-700"
              : ev.winner === "original"
              ? "text-amber-700"
              : "text-slate-600";

            return (
              <div
                key={entry.id}
                className={`group relative transition-colors ${
                  isActive ? "bg-blue-50/70" : "hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectEntry(entry);
                    onCloseMobile();
                  }}
                  className="w-full text-left px-4 py-3 pr-9 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                >
                  <p className="text-xs font-medium text-slate-900 line-clamp-2 leading-snug">
                    {entry.originalPrompt}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Prompt {entry.analysis.overallScore}</span>
                    <span aria-hidden="true">·</span>
                    <span className={outcomeColor}>{outcomeLabel}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                    {formatRelativeTimestamp(entry.createdAt)} · {entry.strategy}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEntry(entry.id);
                  }}
                  title="Delete run from history"
                  aria-label="Delete run from history"
                  className="absolute right-2.5 top-3 p-1 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {entries.length > 0 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/60">
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="w-full py-1.5 px-3 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              Clear All History
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-600 whitespace-nowrap">Delete all?</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClear(false);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-[calc(100vh-57px)] sticky top-[57px]">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
