/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Lightbulb,
  Menu,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import {
  MODEL_OPTIONS,
  STRATEGY_OPTIONS,
  type BlindEvaluationResult,
  type GeminiModelId,
  type OptimizationStrategy,
  type PromptAnalysisResult,
  type PromptHistoryEntry,
  type PromptOptimizationResult,
  type ResponseGenerationPair,
  type WorkflowStage,
} from "./types/promptDoctor";
import { SAMPLE_PROMPTS } from "./data/samplePrompts";
import {
  analyzePromptApi,
  evaluateResponsesApi,
  generateResponsesApi,
  optimizePromptApi,
} from "./services/api";
import {
  clearAllPromptHistory,
  deleteHistoryEntryById,
  loadPromptHistory,
  upsertHistoryEntry,
} from "./utils/storage";
import { buildMarkdownReport, triggerFileDownload } from "./utils/diff";
import { HistorySidebar } from "./components/HistorySidebar";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { OptimizationPanel } from "./components/OptimizationPanel";
import { ResponseComparisonPanel } from "./components/ResponseComparisonPanel";
import { EvaluationPanel } from "./components/EvaluationPanel";

function generateRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const STAGE_CONFIG: Record<
  WorkflowStage,
  { label: string; step: number; total: number; description: string }
> = {
  idle: { label: "Ready", step: 0, total: 4, description: "" },
  analyzing: {
    label: "Analyzing",
    step: 1,
    total: 4,
    description: "Evaluating clarity, context, constraints & structure...",
  },
  optimizing: {
    label: "Optimizing",
    step: 2,
    total: 4,
    description: "Synthesizing a targeted prompt rewrite from diagnostic findings...",
  },
  generating: {
    label: "Generating",
    step: 3,
    total: 4,
    description: "Running original & optimized prompts in parallel on Gemini...",
  },
  evaluating: {
    label: "Evaluating",
    step: 4,
    total: 4,
    description: "Running blind randomized rubric evaluation on both outputs...",
  },
  complete: { label: "Complete", step: 4, total: 4, description: "" },
  error: { label: "Error", step: 0, total: 4, description: "" },
};

/** Animated progress banner shown while pipeline is running */
function PipelineBanner({
  stage,
  model,
  onCancel,
}: {
  stage: WorkflowStage;
  model: GeminiModelId;
  onCancel: () => void;
}) {
  const cfg = STAGE_CONFIG[stage];
  const pct = (cfg.step / cfg.total) * 100;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-blue-200 overflow-hidden"
    >
      {/* Progress bar */}
      <div className="h-1 bg-blue-100">
        <div
          className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="shimmer px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  step < cfg.step
                    ? "bg-blue-600"
                    : step === cfg.step
                    ? "bg-blue-400 pulse-dot"
                    : "bg-blue-200"
                }`}
              />
            ))}
          </div>
          <div>
            <span className="text-xs font-bold text-blue-900">
              Step {cfg.step} of {cfg.total} · {cfg.label}
            </span>
            <p className="text-[11px] text-blue-700">{cfg.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:block text-[11px] font-mono text-blue-600">{model}</span>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StageSkeletonCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="text-xs font-mono text-blue-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />
          Processing...
        </span>
      </div>
      <div className="mt-4 space-y-3 animate-pulse">
        <div className="h-3 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
      </div>
    </div>
  );
}

/** Inline prompt-writing tips */
const PROMPT_TIPS = [
  "Specify the target audience to calibrate depth and vocabulary.",
  "Add output format requirements: bullet list, JSON, table, prose, etc.",
  "Define length constraints: 'under 200 words' or '3 paragraphs max'.",
  "Provide a concrete example of a good output for complex tasks.",
  "State constraints explicitly: 'Do not include X', 'Avoid Y'.",
  "Include relevant background context the model may not know.",
];

export default function App() {
  const [originalPrompt, setOriginalPrompt] = useState<string>(SAMPLE_PROMPTS[0].prompt);
  const [strategy, setStrategy] = useState<OptimizationStrategy>(
    SAMPLE_PROMPTS[0].recommendedStrategy
  );
  const [model, setModel] = useState<GeminiModelId>("gemini-3.1-flash-lite");

  const [analysis, setAnalysis] = useState<PromptAnalysisResult | null>(null);
  const [optimization, setOptimization] = useState<PromptOptimizationResult | null>(null);
  const [editedOptimizedPrompt, setEditedOptimizedPrompt] = useState<string>("");
  const [responses, setResponses] = useState<ResponseGenerationPair | null>(null);
  const [evaluation, setEvaluation] = useState<BlindEvaluationResult | null>(null);

  const [stage, setStage] = useState<WorkflowStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string>(new Date().toISOString());

  const [history, setHistory] = useState<PromptHistoryEntry[]>(() => loadPromptHistory());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * PROMPT_TIPS.length));

  const abortRef = useRef<AbortController | null>(null);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

  const isBusy =
    stage === "analyzing" ||
    stage === "optimizing" ||
    stage === "generating" ||
    stage === "evaluating";

  const promptMetrics = useMemo(() => {
    const trimmed = originalPrompt.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = originalPrompt.length;
    // Simple heuristic health check before running
    const hasTooFewWords = words > 0 && words < 5;
    const hasNoVerb = words > 0 && words < 3;
    const isHealthy = words >= 10 && chars >= 40;
    return { words, chars, hasTooFewWords, hasNoVerb, isHealthy };
  }, [originalPrompt]);

  const cancelActiveRequest = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStage(analysis ? "complete" : "idle");
  };

  const resetSession = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setOriginalPrompt("");
    setAnalysis(null);
    setOptimization(null);
    setEditedOptimizedPrompt("");
    setResponses(null);
    setEvaluation(null);
    setErrorMessage(null);
    setActiveRunId(null);
    setStage("idle");
  }, []);

  const handleLoadSample = (sampleId: string) => {
    const found = SAMPLE_PROMPTS.find((s) => s.id === sampleId);
    if (!found || isBusy) return;
    setOriginalPrompt(found.prompt);
    setStrategy(found.recommendedStrategy);
    setAnalysis(null);
    setOptimization(null);
    setEditedOptimizedPrompt("");
    setResponses(null);
    setEvaluation(null);
    setErrorMessage(null);
    setActiveRunId(null);
    setStage("idle");
  };

  const handleCopyOriginal = async () => {
    if (!originalPrompt.trim()) return;
    try {
      await navigator.clipboard.writeText(originalPrompt);
      setCopiedOriginal(true);
      window.setTimeout(() => setCopiedOriginal(false), 1800);
    } catch {
      // Ignore clipboard restrictions
    }
  };

  const handleRunWorkflow = async (includeBenchmark: boolean) => {
    const trimmedPrompt = originalPrompt.trim();
    if (!trimmedPrompt) {
      setErrorMessage("Enter a prompt to analyze, or pick one of the sample presets.");
      setStage("error");
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const runId = generateRunId();
    const runTimestamp = new Date().toISOString();

    setActiveRunId(runId);
    setCreatedAt(runTimestamp);
    setErrorMessage(null);
    setAnalysis(null);
    setOptimization(null);
    setEditedOptimizedPrompt("");
    setResponses(null);
    setEvaluation(null);

    try {
      setStage("analyzing");
      const analysisResult = await analyzePromptApi({ prompt: trimmedPrompt, model }, controller.signal);
      setAnalysis(analysisResult);

      setStage("optimizing");
      const optimizationResult = await optimizePromptApi(
        { prompt: trimmedPrompt, strategy, model, analysis: analysisResult },
        controller.signal
      );
      setOptimization(optimizationResult);
      setEditedOptimizedPrompt(optimizationResult.optimizedPrompt);

      const partialEntry: PromptHistoryEntry = {
        id: runId,
        createdAt: runTimestamp,
        originalPrompt: trimmedPrompt,
        editedOptimizedPrompt: optimizationResult.optimizedPrompt,
        strategy,
        model,
        analysis: analysisResult,
        optimization: optimizationResult,
      };
      setHistory((prev) => upsertHistoryEntry(prev, partialEntry));

      if (!includeBenchmark) {
        setStage("complete");
        return;
      }

      setStage("generating");
      const generatedPair = await generateResponsesApi(
        {
          originalPrompt: trimmedPrompt,
          optimizedPrompt: optimizationResult.optimizedPrompt,
          model,
        },
        controller.signal
      );
      setResponses(generatedPair);

      setStage("evaluating");
      const evalResult = await evaluateResponsesApi(
        {
          originalPrompt: trimmedPrompt,
          originalResponse: generatedPair.originalResponse.text,
          optimizedResponse: generatedPair.optimizedResponse.text,
          model,
        },
        controller.signal
      );
      setEvaluation(evalResult);

      const completedEntry: PromptHistoryEntry = {
        ...partialEntry,
        responses: generatedPair,
        evaluation: evalResult,
      };
      setHistory((prev) => upsertHistoryEntry(prev, completedEntry));
      setStage("complete");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while processing the prompt.";
      setErrorMessage(message);
      setStage("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleRunBenchmarkForCurrentOptimization = async () => {
    const trimmedOriginal = originalPrompt.trim();
    const trimmedOptimized = editedOptimizedPrompt.trim();

    if (!trimmedOriginal || !trimmedOptimized || !analysis || !optimization) {
      setErrorMessage("Both original and optimized prompts must be non-empty to generate responses.");
      setStage("error");
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMessage(null);
    setEvaluation(null);

    try {
      setStage("generating");
      const generatedPair = await generateResponsesApi(
        { originalPrompt: trimmedOriginal, optimizedPrompt: trimmedOptimized, model },
        controller.signal
      );
      setResponses(generatedPair);

      setStage("evaluating");
      const evalResult = await evaluateResponsesApi(
        {
          originalPrompt: trimmedOriginal,
          originalResponse: generatedPair.originalResponse.text,
          optimizedResponse: generatedPair.optimizedResponse.text,
          model,
        },
        controller.signal
      );
      setEvaluation(evalResult);

      const entryId = activeRunId ?? generateRunId();
      setActiveRunId(entryId);
      const updatedEntry: PromptHistoryEntry = {
        id: entryId,
        createdAt,
        originalPrompt: trimmedOriginal,
        editedOptimizedPrompt: trimmedOptimized,
        strategy,
        model,
        analysis,
        optimization,
        responses: generatedPair,
        evaluation: evalResult,
      };
      setHistory((prev) => upsertHistoryEntry(prev, updatedEntry));
      setStage("complete");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate and evaluate model responses."
      );
      setStage("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleReevaluateResponses = async () => {
    const trimmedOriginal = originalPrompt.trim();
    if (!trimmedOriginal || !responses || !analysis || !optimization) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMessage(null);

    try {
      setStage("evaluating");
      const evalResult = await evaluateResponsesApi(
        {
          originalPrompt: trimmedOriginal,
          originalResponse: responses.originalResponse.text,
          optimizedResponse: responses.optimizedResponse.text,
          model,
        },
        controller.signal
      );
      setEvaluation(evalResult);

      if (activeRunId) {
        const updatedEntry: PromptHistoryEntry = {
          id: activeRunId,
          createdAt,
          originalPrompt: trimmedOriginal,
          editedOptimizedPrompt: editedOptimizedPrompt.trim(),
          strategy,
          model,
          analysis,
          optimization,
          responses,
          evaluation: evalResult,
        };
        setHistory((prev) => upsertHistoryEntry(prev, updatedEntry));
      }
      setStage("complete");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setErrorMessage(err instanceof Error ? err.message : "Failed to re-evaluate responses.");
      setStage("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleSelectHistoryEntry = (entry: PromptHistoryEntry) => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setActiveRunId(entry.id);
    setCreatedAt(entry.createdAt);
    setOriginalPrompt(entry.originalPrompt);
    setStrategy(entry.strategy);
    setModel(entry.model);
    setAnalysis(entry.analysis);
    setOptimization(entry.optimization);
    setEditedOptimizedPrompt(entry.editedOptimizedPrompt ?? entry.optimization.optimizedPrompt);
    setResponses(entry.responses ?? null);
    setEvaluation(entry.evaluation ?? null);
    setErrorMessage(null);
    setStage("complete");
    topAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteHistoryEntry = (id: string) => {
    setHistory((prev) => deleteHistoryEntryById(prev, id));
    if (activeRunId === id) setActiveRunId(null);
  };

  const handleClearAllHistory = () => {
    setHistory(clearAllPromptHistory());
    setActiveRunId(null);
  };

  const handlePromoteToOriginal = (optimizedText: string) => {
    setOriginalPrompt(optimizedText);
    setAnalysis(null);
    setOptimization(null);
    setEditedOptimizedPrompt("");
    setResponses(null);
    setEvaluation(null);
    setErrorMessage(null);
    setActiveRunId(null);
    setStage("idle");
    topAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const buildCurrentSnapshot = (): PromptHistoryEntry | null => {
    if (!analysis || !optimization) return null;
    return {
      id: activeRunId ?? "export",
      createdAt,
      originalPrompt: originalPrompt.trim(),
      editedOptimizedPrompt: editedOptimizedPrompt.trim(),
      strategy,
      model,
      analysis,
      optimization,
      responses: responses ?? undefined,
      evaluation: evaluation ?? undefined,
    };
  };

  const handleExportMarkdown = () => {
    const snap = buildCurrentSnapshot();
    if (!snap) return;
    triggerFileDownload(
      `prompt-doctor-report-${Date.now()}.md`,
      buildMarkdownReport(snap),
      "text/markdown;charset=utf-8"
    );
  };

  const handleExportJson = () => {
    const snap = buildCurrentSnapshot();
    if (!snap) return;
    triggerFileDownload(
      `prompt-doctor-report-${Date.now()}.json`,
      JSON.stringify(snap, null, 2),
      "application/json;charset=utf-8"
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 h-[57px] bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open prompt history"
            className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <a
            href="#workspace"
            className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </span>
            Prompt Doctor
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-500">
          {[
            { label: "Workbench", href: "#workspace", enabled: true },
            { label: "Diagnosis", href: "#diagnosis", enabled: !!analysis },
            { label: "Responses", href: "#responses", enabled: !!responses },
            { label: "Evaluation", href: "#evaluation", enabled: !!evaluation },
          ].map(({ label, href, enabled }) => (
            <a
              key={label}
              href={href}
              className={`transition-colors whitespace-nowrap ${
                enabled
                  ? "hover:text-slate-900 hover:underline underline-offset-4"
                  : "text-slate-300 pointer-events-none"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {analysis && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Export Report
            </button>
          )}
          <button
            type="button"
            onClick={resetSession}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            New Diagnosis
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        <HistorySidebar
          entries={history}
          activeId={activeRunId}
          onSelectEntry={handleSelectHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
          onClearAll={handleClearAllHistory}
          onNewSession={resetSession}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8">
          <div ref={topAnchorRef} id="workspace" className="max-w-5xl mx-auto space-y-6">

            {/* Hero header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-balance">
                  Prompt Diagnostic & Blind A/B Response Workbench
                </h1>
                <p className="mt-1 text-sm text-slate-500 max-w-2xl leading-relaxed">
                  Inspect structural weaknesses, generate a targeted rewrite, run both prompts
                  against Gemini under identical settings, and compare outputs with a blind rubric.
                </p>
              </div>
              {history.length > 0 && (
                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-400">
                    {history.length} run{history.length !== 1 ? "s" : ""} saved
                  </div>
                  {history[0].evaluation && (
                    <div className="text-xs font-mono font-semibold text-slate-700">
                      Last score delta:{" "}
                      <span
                        className={
                          history[0].evaluation.scoreDelta >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }
                      >
                        {history[0].evaluation.scoreDelta > 0 ? "+" : ""}
                        {history[0].evaluation.scoreDelta.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sample preset strip */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 mr-1 whitespace-nowrap">
                Load preset:
              </span>
              {SAMPLE_PROMPTS.map((preset) => {
                const isSelected = originalPrompt.trim() === preset.prompt.trim();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLoadSample(preset.id)}
                    disabled={isBusy}
                    title={preset.domain}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Prompt Input Card */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span>Original Prompt</span>
                  <span className="font-normal font-mono text-slate-400 normal-case">
                    {promptMetrics.words} words · {promptMetrics.chars.toLocaleString()} chars
                  </span>
                  {promptMetrics.chars > 0 && promptMetrics.chars < 40 && (
                    <span className="text-amber-600 font-normal text-[11px]">
                      ⚠ Very short prompt
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTip((v) => !v)}
                    title="Show a prompt-writing tip"
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                      showTip
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Tip
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyOriginal}
                    disabled={!originalPrompt.trim()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-md hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {copiedOriginal ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedOriginal ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOriginalPrompt("")}
                    disabled={isBusy || !originalPrompt}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-md hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {showTip && (
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-semibold">Writing tip: </span>
                      {PROMPT_TIPS[tipIndex % PROMPT_TIPS.length]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTip(false)}
                    className="text-amber-500 hover:text-amber-700 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="p-5">
                <label htmlFor="original-prompt-textarea" className="sr-only">
                  Original Prompt
                </label>
                <textarea
                  id="original-prompt-textarea"
                  value={originalPrompt}
                  onChange={(e) => setOriginalPrompt(e.target.value)}
                  disabled={isBusy}
                  rows={5}
                  placeholder="Paste or write the prompt you want to diagnose, optimize, and benchmark..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600 transition-shadow resize-y font-mono"
                />

                {/* Controls: Strategy + Model + Actions */}
                <div className="mt-5 pt-5 border-t border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                  <div className="flex flex-wrap items-end gap-5">
                    {/* Strategy selector */}
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Strategy</span>
                      </div>
                      <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        {STRATEGY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStrategy(opt.value)}
                            disabled={isBusy}
                            title={opt.summary}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                              strategy === opt.value
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                            }`}
                          >
                            <span className="mr-1">{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Model selector */}
                    <div>
                      <label
                        htmlFor="gemini-model-select"
                        className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2"
                      >
                        Benchmark Model
                      </label>
                      <select
                        id="gemini-model-select"
                        value={model}
                        onChange={(e) => setModel(e.target.value as GeminiModelId)}
                        disabled={isBusy}
                        className="h-[36px] px-3 text-xs font-medium bg-slate-100 border border-transparent hover:border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer disabled:opacity-60"
                      >
                        {MODEL_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label} {m.badge ? `(${m.badge})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {isBusy ? (
                      <div className="text-xs text-slate-500 font-mono">
                        Running pipeline...
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRunWorkflow(false)}
                          disabled={!originalPrompt.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Analyze & Optimize Only</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRunWorkflow(true)}
                          disabled={!originalPrompt.trim()}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Diagnose & Benchmark</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Pipeline progress banner */}
            {isBusy && (
              <PipelineBanner stage={stage} model={model} onCancel={cancelActiveRequest} />
            )}

            {/* Error banner */}
            {errorMessage && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-red-900">Request failed</h2>
                  <p className="mt-1 text-xs text-red-700 leading-relaxed">{errorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded cursor-pointer whitespace-nowrap shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Stage 1: Diagnosis */}
            <div id="diagnosis" className="scroll-mt-20">
              {stage === "analyzing" && !analysis && (
                <StageSkeletonCard
                  title="01. Prompt Diagnosis"
                  subtitle="Evaluating clarity, context, constraints, and structural completeness..."
                />
              )}
              {analysis && <AnalysisPanel analysis={analysis} />}
            </div>

            {/* Stage 2: Optimization */}
            <div>
              {stage === "optimizing" && !optimization && (
                <StageSkeletonCard
                  title="02. Optimized Prompt"
                  subtitle="Synthesizing targeted prompt improvements while preserving intent..."
                />
              )}
              {optimization && (
                <OptimizationPanel
                  originalPrompt={originalPrompt}
                  optimization={optimization}
                  activeOptimizedPrompt={editedOptimizedPrompt}
                  onChangeOptimizedPrompt={setEditedOptimizedPrompt}
                  onPromoteToOriginal={handlePromoteToOriginal}
                  onRunBenchmark={handleRunBenchmarkForCurrentOptimization}
                  isBusy={isBusy}
                  hasResponses={Boolean(responses)}
                />
              )}
            </div>

            {/* Stage 3: Side-by-Side Responses */}
            <div id="responses" className="scroll-mt-20">
              {stage === "generating" && !responses && (
                <StageSkeletonCard
                  title="03. Side-by-Side Model Responses"
                  subtitle="Running original and optimized prompts in parallel on Gemini..."
                />
              )}
              {responses && (
                <ResponseComparisonPanel
                  responses={responses}
                  onRegenerate={handleRunBenchmarkForCurrentOptimization}
                  isBusy={isBusy}
                />
              )}
            </div>

            {/* Stage 4: Evaluation */}
            <div id="evaluation" className="scroll-mt-20">
              {stage === "evaluating" && !evaluation && (
                <StageSkeletonCard
                  title="04. Blind Rubric Evaluation"
                  subtitle="Scoring anonymous Candidate A and Candidate B on identical criteria..."
                />
              )}
              {evaluation && (
                <EvaluationPanel
                  evaluation={evaluation}
                  onReevaluate={handleReevaluateResponses}
                  onExportMarkdown={handleExportMarkdown}
                  onExportJson={handleExportJson}
                  isBusy={isBusy}
                />
              )}
            </div>

            {/* Empty state feature guide */}
            {!analysis && !isBusy && (
              <div className="border border-slate-200 bg-white rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    n: "1",
                    title: "Structural Prompt Diagnosis",
                    desc: "Scores clarity, context, boundaries, and output formatting on a 0–100 rubric and pinpoints actionable gaps.",
                  },
                  {
                    n: "2",
                    title: "Symmetric Live Generation",
                    desc: "Executes both the original and optimized prompts against the exact same Gemini model and sampling temperature in parallel.",
                  },
                  {
                    n: "3",
                    title: "Unbiased Blind Evaluation",
                    desc: "Anonymizes and randomly assigns outputs to Candidate A and Candidate B so neither receives automatic score inflation.",
                  },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {n}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{title}</h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
