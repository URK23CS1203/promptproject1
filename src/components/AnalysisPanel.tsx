import React from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, TrendingUp } from "lucide-react";
import type { PromptAnalysisResult, PromptDimensionKey } from "../types/promptDoctor";

interface AnalysisPanelProps {
  analysis: PromptAnalysisResult;
}

const DIMENSION_LABELS: Array<{ key: PromptDimensionKey; label: string; tip: string }> = [
  { key: "clarity", label: "Clarity", tip: "How specific and unambiguous the prompt is" },
  { key: "context", label: "Context", tip: "Background and scope provided to the model" },
  { key: "constraints", label: "Constraints", tip: "Boundaries, format rules, and limits" },
  { key: "structure", label: "Structure", tip: "Output formatting and organization guidance" },
];

function scoreQualityLabel(score: number): {
  label: string;
  colorClass: string;
  barClass: string;
  bgClass: string;
} {
  if (score >= 80)
    return {
      label: "Strong",
      colorClass: "text-emerald-700",
      barClass: "bg-emerald-500",
      bgClass: "bg-emerald-50",
    };
  if (score >= 55)
    return {
      label: "Moderate",
      colorClass: "text-amber-700",
      barClass: "bg-amber-400",
      bgClass: "bg-amber-50",
    };
  return {
    label: "Needs Work",
    colorClass: "text-red-600",
    barClass: "bg-red-500",
    bgClass: "bg-red-50",
  };
}

/** Animated SVG ring for the overall score */
function ScoreRing({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const quality = scoreQualityLabel(score);

  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28 shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={score >= 80 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
          {score}
        </span>
        <span className={`text-[10px] font-semibold ${quality.colorClass}`}>
          {quality.label}
        </span>
      </div>
    </div>
  );
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const quality = scoreQualityLabel(analysis.overallScore);

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden panel-enter">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              1
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Prompt Diagnosis</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-xl leading-relaxed">
            <span className="font-medium text-slate-700">Intent detected:</span>{" "}
            {analysis.detectedIntent}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Prompt Health Score</span>
        </div>
      </div>

      {/* Score + Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200">
        {/* Score ring */}
        <div className="md:col-span-1 flex items-center justify-center p-6 bg-slate-50/30">
          <ScoreRing score={analysis.overallScore} />
        </div>

        {/* Dimension bars */}
        <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {DIMENSION_LABELS.map(({ key, label, tip }) => {
            const val = analysis.dimensions[key];
            const dimMeta = scoreQualityLabel(val);
            return (
              <div key={key} className="px-5 py-5 group relative" title={tip}>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700">{label}</span>
                  <span
                    className={`text-xs font-mono font-bold tabular-nums ${dimMeta.colorClass}`}
                  >
                    {val}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${dimMeta.barClass}`}
                    style={{ width: `${Math.max(4, Math.min(100, val))}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[10px] text-slate-400">{dimMeta.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Issues + Strengths */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Issues */}
        <div className="lg:col-span-7 p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Diagnostic Issues{" "}
              {analysis.issues.length > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${quality.bgClass} ${quality.colorClass}`}
                >
                  {analysis.issues.length}
                </span>
              )}
            </h3>
            <span className="text-[10px] text-slate-400">Ranked by severity</span>
          </div>

          {analysis.issues.length === 0 ? (
            <div className="flex items-start gap-2.5 py-4 text-sm text-slate-600 bg-emerald-50 rounded-lg px-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                No structural ambiguities detected. This prompt is already clear and well-scoped.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.issues
                .sort((a, b) => {
                  const order = { high: 0, medium: 1, low: 2 };
                  return order[a.severity] - order[b.severity];
                })
                .map((issue, idx) => {
                  const Icon =
                    issue.severity === "high"
                      ? AlertCircle
                      : issue.severity === "medium"
                      ? AlertTriangle
                      : Info;
                  const styles =
                    issue.severity === "high"
                      ? {
                          icon: "text-red-600",
                          border: "border-red-200",
                          bg: "bg-red-50/60",
                          badge: "bg-red-100 text-red-700",
                        }
                      : issue.severity === "medium"
                      ? {
                          icon: "text-amber-600",
                          border: "border-amber-200",
                          bg: "bg-amber-50/60",
                          badge: "bg-amber-100 text-amber-700",
                        }
                      : {
                          icon: "text-blue-500",
                          border: "border-blue-200",
                          bg: "bg-blue-50/40",
                          badge: "bg-blue-100 text-blue-700",
                        };

                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3.5 ${styles.border} ${styles.bg}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${styles.icon}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-xs font-bold text-slate-900">{issue.title}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${styles.badge}`}
                            >
                              {issue.severity}
                            </span>
                            <span className="text-[10px] text-slate-400 capitalize">
                              · {issue.dimension}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {issue.description}
                          </p>
                          {issue.fixSuggestion && (
                            <p className="mt-2 text-xs text-slate-800 bg-white/70 rounded px-2 py-1.5 border border-slate-200/80">
                              <span className="font-semibold text-slate-900">→ Fix: </span>
                              {issue.fixSuggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Strengths */}
        <div className="lg:col-span-5 p-6 bg-slate-50/30">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
            Preserved Strengths
          </h3>
          {analysis.strengths.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              No distinct structural strengths noted in the input.
            </p>
          ) : (
            <ul className="space-y-3">
              {analysis.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span className="text-xs text-slate-700 leading-relaxed">{strength}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Quick metrics */}
          <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-2 gap-3">
            {[
              { label: "Issues Found", value: analysis.issues.length, unit: "found" },
              {
                label: "High Severity",
                value: analysis.issues.filter((i) => i.severity === "high").length,
                unit: "critical",
              },
              { label: "Strengths", value: analysis.strengths.length, unit: "noted" },
              {
                label: "Avg Dimension",
                value: Math.round(
                  Object.values(analysis.dimensions).reduce((a, b) => a + b, 0) /
                    Object.values(analysis.dimensions).length
                ),
                unit: "/ 100",
              },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
                <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                  {value}
                </div>
                <div className="text-[10px] text-slate-500">{label}</div>
                <div className="text-[10px] text-slate-400">{unit}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
