export type GeminiModelId =
  | "gemini-flash-latest"
  | "gemini-3.8-flash"
  | "gemini-3.1-flash-lite";

export type OptimizationStrategy = "balanced" | "concise" | "structured" | "reasoning";

export type IssueSeverity = "high" | "medium" | "low";

export type PromptDimensionKey = "clarity" | "context" | "constraints" | "structure";

export interface PromptDiagnosticIssue {
  severity: IssueSeverity;
  dimension: PromptDimensionKey;
  title: string;
  description: string;
  fixSuggestion: string;
}

export interface PromptAnalysisResult {
  overallScore: number;
  detectedIntent: string;
  dimensions: Record<PromptDimensionKey, number>;
  strengths: string[];
  issues: PromptDiagnosticIssue[];
  analyzedAt: string;
  model: GeminiModelId;
}

export interface PromptImprovementItem {
  dimension: string;
  change: string;
  impact: string;
}

export interface PromptOptimizationResult {
  optimizedPrompt: string;
  rationale: string;
  improvements: PromptImprovementItem[];
  strategy: OptimizationStrategy;
  optimizedAt: string;
  model: GeminiModelId;
}

export interface GeneratedResponseData {
  text: string;
  durationMs: number;
  wordCount: number;
  charCount: number;
  model: GeminiModelId;
}

export interface ResponseGenerationPair {
  originalResponse: GeneratedResponseData;
  optimizedResponse: GeneratedResponseData;
  generatedAt: string;
  model: GeminiModelId;
}

export type EvaluationCriterionKey =
  | "relevance"
  | "completeness"
  | "clarity"
  | "accuracy"
  | "structure";

export interface CandidateEvaluationDetail {
  criteria: Record<EvaluationCriterionKey, number>;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  rationale: string;
}

export type EvaluationWinner = "optimized" | "original" | "tie";

export interface BlindEvaluationResult {
  original: CandidateEvaluationDetail;
  optimized: CandidateEvaluationDetail;
  weights: Record<EvaluationCriterionKey, number>;
  scoreDelta: number;
  winner: EvaluationWinner;
  comparativeSummary: string;
  blindAssignment: {
    originalAssignedTo: "Candidate A" | "Candidate B";
    optimizedAssignedTo: "Candidate A" | "Candidate B";
  };
  evaluatedAt: string;
  model: GeminiModelId;
}

export type WorkflowStage =
  | "idle"
  | "analyzing"
  | "optimizing"
  | "generating"
  | "evaluating"
  | "complete"
  | "error";

export interface PromptHistoryEntry {
  id: string;
  createdAt: string;
  originalPrompt: string;
  editedOptimizedPrompt?: string;
  strategy: OptimizationStrategy;
  model: GeminiModelId;
  analysis: PromptAnalysisResult;
  optimization: PromptOptimizationResult;
  responses?: ResponseGenerationPair;
  evaluation?: BlindEvaluationResult;
}

export const EVALUATION_CRITERIA_META: Array<{
  key: EvaluationCriterionKey;
  label: string;
  weightPct: number;
  description: string;
}> = [
  {
    key: "relevance",
    label: "Intent Relevance",
    weightPct: 25,
    description: "Direct alignment with the user's goal without off-topic drift.",
  },
  {
    key: "completeness",
    label: "Completeness",
    weightPct: 20,
    description: "Coverage of essential requirements and necessary depth.",
  },
  {
    key: "clarity",
    label: "Clarity & Conciseness",
    weightPct: 20,
    description: "Readable, direct language free of unnecessary padding or filler.",
  },
  {
    key: "accuracy",
    label: "Accuracy & Soundness",
    weightPct: 20,
    description: "Factual, technical, and logical validity.",
  },
  {
    key: "structure",
    label: "Structure & Usability",
    weightPct: 15,
    description: "Clean organization and actionable formatting.",
  },
];

export const STRATEGY_OPTIONS: Array<{
  value: OptimizationStrategy;
  label: string;
  summary: string;
  icon: string;
}> = [
  {
    value: "balanced",
    label: "Balanced",
    summary: "Clarifies scope, constraints, and structure proportionally.",
    icon: "⚖️",
  },
  {
    value: "concise",
    label: "Concise",
    summary: "Tightens wording and requests direct, compact output.",
    icon: "✂️",
  },
  {
    value: "structured",
    label: "Structured",
    summary: "Defines explicit sections, formatting rules, and boundaries.",
    icon: "🗂️",
  },
  {
    value: "reasoning",
    label: "Analytical",
    summary: "Emphasizes step-by-step analysis, trade-offs, and edge cases.",
    icon: "🔍",
  },
];

export const MODEL_OPTIONS: Array<{
  value: GeminiModelId;
  label: string;
  badge?: string;
}> = [
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", badge: "Fast" },
  { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash", badge: "Balanced" },
  { value: "gemini-flash-latest", label: "Gemini Flash (Latest)", badge: "Latest" },
];
