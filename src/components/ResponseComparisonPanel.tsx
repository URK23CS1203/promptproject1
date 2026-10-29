import React, { useState } from "react";
import { Check, Copy, RefreshCw, Clock, FileText, Zap } from "lucide-react";
import type { ResponseGenerationPair } from "../types/promptDoctor";
import { FormattedOutput } from "./FormattedOutput";

interface ResponseComparisonPanelProps {
  responses: ResponseGenerationPair;
  onRegenerate: () => void;
  isBusy: boolean;
}

function CopyResponseButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-white transition-colors whitespace-nowrap cursor-pointer"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function ResponseMetaBar({
  wordCount,
  charCount,
  durationMs,
}: {
  wordCount: number;
  charCount: number;
  durationMs: number;
}) {
  return (
    <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-500">
      <span className="flex items-center gap-1">
        <FileText className="w-3 h-3" />
        {wordCount.toLocaleString()} words
      </span>
      <span className="text-slate-300">·</span>
      <span>{charCount.toLocaleString()} chars</span>
      <span className="text-slate-300">·</span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {durationMs.toLocaleString()} ms
      </span>
    </div>
  );
}

export function ResponseComparisonPanel({
  responses,
  onRegenerate,
  isBusy,
}: ResponseComparisonPanelProps) {
  const { originalResponse, optimizedResponse } = responses;

  // Compute improvement in speed and length
  const speedDiff = optimizedResponse.durationMs - originalResponse.durationMs;
  const wordDiff = optimizedResponse.wordCount - originalResponse.wordCount;

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden panel-enter">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              3
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Side-by-Side Model Responses
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Both outputs generated live by{" "}
            <span className="font-mono text-slate-700">{responses.model}</span> under identical
            sampling parameters{" "}
            <span className="text-slate-400">(temperature 0.3, topP 0.95)</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick comparison pills */}
          <div className="hidden sm:flex items-center gap-2">
            {wordDiff !== 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                  wordDiff > 0
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                <Zap className="w-2.5 h-2.5" />
                Opt {wordDiff > 0 ? "+" : ""}
                {wordDiff} words
              </span>
            )}
            {speedDiff !== 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                  speedDiff < 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                <Clock className="w-2.5 h-2.5" />
                {speedDiff < 0 ? "" : "+"}
                {speedDiff.toLocaleString()} ms
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onRegenerate}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`} />
            <span>Regenerate Both</span>
          </button>
        </div>
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Original */}
        <div className="flex flex-col">
          <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <h3 className="text-xs font-bold text-slate-900">Original Prompt Response</h3>
              </div>
              <ResponseMetaBar
                wordCount={originalResponse.wordCount}
                charCount={originalResponse.charCount}
                durationMs={originalResponse.durationMs}
              />
            </div>
            <CopyResponseButton text={originalResponse.text} />
          </div>
          <div className="p-6 max-h-[560px] overflow-y-auto">
            <FormattedOutput text={originalResponse.text} />
          </div>
        </div>

        {/* Optimized */}
        <div className="flex flex-col">
          <div className="px-6 py-3 bg-blue-50/50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-xs font-bold text-slate-900">Optimized Prompt Response</h3>
              </div>
              <ResponseMetaBar
                wordCount={optimizedResponse.wordCount}
                charCount={optimizedResponse.charCount}
                durationMs={optimizedResponse.durationMs}
              />
            </div>
            <CopyResponseButton text={optimizedResponse.text} />
          </div>
          <div className="p-6 max-h-[560px] overflow-y-auto">
            <FormattedOutput text={optimizedResponse.text} />
          </div>
        </div>
      </div>
    </section>
  );
}
