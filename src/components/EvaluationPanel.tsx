import React from "react";
import { Download, RefreshCw, CheckCircle2, MinusCircle, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  EVALUATION_CRITERIA_META,
  type BlindEvaluationResult,
} from "../types/promptDoctor";

interface EvaluationPanelProps {
  evaluation: BlindEvaluationResult;
  onReevaluate: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  isBusy: boolean;
}

export function EvaluationPanel({
  evaluation,
  onReevaluate,
  onExportMarkdown,
  onExportJson,
  isBusy,
}: EvaluationPanelProps) {
  const { original, optimized, scoreDelta, winner, comparativeSummary, blindAssignment } =
    evaluation;

  const verdictConfig =
    winner === "optimized"
      ? {
          heading: "Optimized Prompt Won",
          tone: "text-emerald-700",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          icon: <Trophy className="w-5 h-5 text-emerald-600" />,
          label: "Optimized",
        }
      : winner === "original"
      ? {
          heading: "Original Prompt Won",
          tone: "text-amber-700",
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: <Trophy className="w-5 h-5 text-amber-600" />,
          label: "Original",
        }
      : {
          heading: "Scores Tied",
          tone: "text-slate-700",
          bg: "bg-slate-50",
          border: "border-slate-200",
          icon: <Minus className="w-5 h-5 text-slate-500" />,
          label: "Tie",
        };

  const formattedDelta =
    scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1);

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden panel-enter">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              4
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Blind Rubric Evaluation
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Evaluated anonymously:{" "}
            <span className="font-mono text-slate-700">
              Original = {blindAssignment.originalAssignedTo}
            </span>{" "}
            ·{" "}
            <span className="font-mono text-slate-700">
              Optimized = {blindAssignment.optimizedAssignedTo}
            </span>{" "}
            using identical rubric weights.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReevaluate}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`} />
            <span>Re-evaluate</span>
          </button>

          <button
            type="button"
            onClick={onExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export MD</span>
          </button>

          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Verdict Banner */}
      <div
        className={`mx-6 mt-6 rounded-xl border p-5 flex items-center gap-4 ${verdictConfig.bg} ${verdictConfig.border}`}
      >
        <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center shadow-sm shrink-0">
          {verdictConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold ${verdictConfig.tone}`}>{verdictConfig.heading}</div>
          <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{comparativeSummary}</p>
        </div>
        <div
          className={`text-right font-mono tabular-nums shrink-0 ${verdictConfig.tone}`}
        >
          <div className="text-2xl font-bold">{formattedDelta}</div>
          <div className="text-[10px] text-slate-400">score delta</div>
        </div>
      </div>

      {/* Score Summary */}
      <div className="grid grid-cols-2 gap-4 px-6 pt-5 pb-2">
        {[
          {
            label: "Original Response",
            score: original.overallScore,
            color: "text-slate-700",
            barColor: "bg-slate-400",
            accent: winner === "original",
          },
          {
            label: "Optimized Response",
            score: optimized.overallScore,
            color: "text-blue-700",
            barColor: "bg-blue-500",
            accent: winner === "optimized",
          },
        ].map(({ label, score, color, barColor, accent }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${
              accent ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-slate-50/40"
            }`}
          >
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className={`text-3xl font-bold font-mono tabular-nums ${color}`}>
              {score.toFixed(1)}
              <span className="text-sm text-slate-400 font-normal ml-1">/ 100</span>
            </div>
            <div className="mt-2 h-2 bg-white rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full ${barColor} transition-all duration-700`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Criterion-by-Criterion Table */}
      <div className="px-6 pb-6 pt-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Criterion Breakdown
        </h3>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Criterion</th>
                <th className="py-3 px-3 text-right font-mono">Weight</th>
                <th className="py-3 px-3 text-right font-mono">Original</th>
                <th className="py-3 px-3 text-right font-mono">Optimized</th>
                <th className="py-3 px-3 text-right font-mono">Delta</th>
                <th className="py-3 px-4 w-48 hidden sm:table-cell">Comparison</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {EVALUATION_CRITERIA_META.map((criterion) => {
                const origVal = original.criteria[criterion.key];
                const optVal = optimized.criteria[criterion.key];
                const diff = optVal - origVal;
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const DeltaIcon =
                  diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
                const diffColor =
                  diff > 0
                    ? "text-emerald-700"
                    : diff < 0
                    ? "text-red-600"
                    : "text-slate-400";

                return (
                  <tr key={criterion.key} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{criterion.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {criterion.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-500">
                      {criterion.weightPct}%
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                      {origVal}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-blue-700">
                      {optVal}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono tabular-nums font-semibold ${diffColor}`}>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        <DeltaIcon className="w-3 h-3" />
                        {diffText}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-400 w-7">Orig</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-400 rounded-full"
                              style={{ width: `${origVal}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-400 w-7">Opt</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${optVal}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Qualitative Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 border-t border-slate-200">
        {[
          {
            label: "Original Response Assessment",
            detail: original,
            dotColor: "bg-slate-400",
          },
          {
            label: "Optimized Response Assessment",
            detail: optimized,
            dotColor: "bg-blue-500",
          },
        ].map(({ label, detail, dotColor }) => (
          <div key={label} className="p-6 space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                <h3 className="text-xs font-bold text-slate-900">{label}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{detail.rationale}</p>
            </div>

            {detail.strengths.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2">
                  Strengths
                </h4>
                <ul className="space-y-1.5">
                  {detail.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.weaknesses.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2">
                  Limitations
                </h4>
                <ul className="space-y-1.5">
                  {detail.weaknesses.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                      <MinusCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
