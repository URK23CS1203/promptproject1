import React, { useMemo, useState } from "react";
import { Check, Copy, ArrowUpLeft, Play, RotateCcw, Sparkles, Eye } from "lucide-react";
import type { PromptOptimizationResult } from "../types/promptDoctor";
import { computeWordDiff } from "../utils/diff";

interface OptimizationPanelProps {
  originalPrompt: string;
  optimization: PromptOptimizationResult;
  activeOptimizedPrompt: string;
  onChangeOptimizedPrompt: (value: string) => void;
  onPromoteToOriginal: (optimizedText: string) => void;
  onRunBenchmark: () => void;
  isBusy: boolean;
  hasResponses: boolean;
}

const STRATEGY_COLORS: Record<string, string> = {
  balanced: "bg-purple-100 text-purple-700",
  concise: "bg-sky-100 text-sky-700",
  structured: "bg-indigo-100 text-indigo-700",
  reasoning: "bg-teal-100 text-teal-700",
};

export function OptimizationPanel({
  originalPrompt,
  optimization,
  activeOptimizedPrompt,
  onChangeOptimizedPrompt,
  onPromoteToOriginal,
  onRunBenchmark,
  isBusy,
  hasResponses,
}: OptimizationPanelProps) {
  const [viewMode, setViewMode] = useState<"editor" | "diff">("editor");
  const [copied, setCopied] = useState(false);

  const isEdited =
    activeOptimizedPrompt.trim() !== optimization.optimizedPrompt.trim();

  const diffTokens = useMemo(() => {
    if (viewMode !== "diff") return [];
    return computeWordDiff(originalPrompt, activeOptimizedPrompt);
  }, [originalPrompt, activeOptimizedPrompt, viewMode]);

  const wordCount = useMemo(() => {
    const trimmed = activeOptimizedPrompt.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [activeOptimizedPrompt]);

  const originalWordCount = useMemo(() => {
    const trimmed = originalPrompt.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [originalPrompt]);

  const wordDelta = wordCount - originalWordCount;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeOptimizedPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore
    }
  };

  const strategyColor =
    STRATEGY_COLORS[optimization.strategy] ?? "bg-slate-100 text-slate-600";

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden panel-enter">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              2
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Optimized Prompt</h2>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${strategyColor}`}
            >
              {optimization.strategy}
            </span>
            {isEdited && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">
                ✏️ Edited
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
            <span>{wordCount} words</span>
            {wordDelta !== 0 && (
              <span
                className={
                  wordDelta > 0 ? "text-amber-600" : "text-emerald-600"
                }
              >
                ({wordDelta > 0 ? "+" : ""}
                {wordDelta} vs original)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none ${
                viewMode === "editor"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none ${
                viewMode === "diff"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Word Diff</span>
            </button>
          </div>

          {isEdited && (
            <button
              type="button"
              onClick={() => onChangeOptimizedPrompt(optimization.optimizedPrompt)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={() => onPromoteToOriginal(activeOptimizedPrompt)}
            disabled={isBusy || !activeOptimizedPrompt.trim()}
            title="Use this optimized prompt as the new original for another iteration"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <ArrowUpLeft className="w-3.5 h-3.5" />
            <span>Use as Input</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Editor / Diff */}
        <div className="lg:col-span-7 p-6">
          {viewMode === "editor" ? (
            <div>
              <label htmlFor="optimized-prompt-editor" className="sr-only">
                Optimized Prompt
              </label>
              <textarea
                id="optimized-prompt-editor"
                value={activeOptimizedPrompt}
                onChange={(e) => onChangeOptimizedPrompt(e.target.value)}
                disabled={isBusy}
                rows={8}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors resize-y font-mono"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
              {diffTokens.length === 0 ? (
                <span className="text-slate-400 italic">No changes detected.</span>
              ) : (
                diffTokens.map((tok, i) => {
                  if (tok.type === "added") {
                    return (
                      <span
                        key={i}
                        className="bg-emerald-100 text-emerald-900 px-0.5 rounded-sm"
                      >
                        {tok.value}
                      </span>
                    );
                  }
                  if (tok.type === "removed") {
                    return (
                      <span
                        key={i}
                        className="bg-red-100 text-red-800 line-through opacity-70 px-0.5 rounded-sm"
                      >
                        {tok.value}
                      </span>
                    );
                  }
                  return <span key={i}>{tok.value}</span>;
                })
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Edit the optimized prompt above before running the side-by-side benchmark.
            </p>
            <button
              type="button"
              onClick={onRunBenchmark}
              disabled={isBusy || !activeOptimizedPrompt.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {hasResponses ? "Re-run Benchmark" : "Generate & Evaluate"}
              </span>
            </button>
          </div>
        </div>

        {/* Rationale + Improvements */}
        <div className="lg:col-span-5 p-6 bg-slate-50/30 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
              Optimization Rationale
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">{optimization.rationale}</p>
          </div>

          {optimization.improvements.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Applied Refinements ({optimization.improvements.length})
              </h4>
              <div className="space-y-3">
                {optimization.improvements.map((imp, idx) => (
                  <div
                    key={idx}
                    className="flex gap-3 bg-white rounded-lg border border-slate-200 p-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">{imp.change}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        <span className="capitalize font-medium">{imp.dimension}</span>
                        {imp.impact ? ` · ${imp.impact}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
