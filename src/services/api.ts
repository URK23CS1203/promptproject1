import type {
  BlindEvaluationResult,
  GeminiModelId,
  OptimizationStrategy,
  PromptAnalysisResult,
  PromptOptimizationResult,
  ResponseGenerationPair,
} from "../types/promptDoctor";

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = "API_ERROR") {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function postJson<TResponse>(
  endpoint: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiClientError(
        `Request to ${endpoint} failed with HTTP ${response.status}.`,
        response.status,
        "HTTP_ERROR"
      );
    }
    throw new ApiClientError("Server returned a non-JSON response.", 502, "INVALID_RESPONSE");
  }

  if (!response.ok) {
    const errBody = data as { error?: string; code?: string } | null;
    throw new ApiClientError(
      errBody?.error || `Request failed with status ${response.status}.`,
      response.status,
      errBody?.code || "API_ERROR"
    );
  }

  return data as TResponse;
}

export function analyzePromptApi(
  params: { prompt: string; model: GeminiModelId },
  signal?: AbortSignal
): Promise<PromptAnalysisResult> {
  return postJson<PromptAnalysisResult>("/api/analyze", params, signal);
}

export function optimizePromptApi(
  params: {
    prompt: string;
    strategy: OptimizationStrategy;
    model: GeminiModelId;
    analysis?: PromptAnalysisResult;
  },
  signal?: AbortSignal
): Promise<PromptOptimizationResult> {
  return postJson<PromptOptimizationResult>("/api/optimize", params, signal);
}

export function generateResponsesApi(
  params: {
    originalPrompt: string;
    optimizedPrompt: string;
    model: GeminiModelId;
  },
  signal?: AbortSignal
): Promise<ResponseGenerationPair> {
  return postJson<ResponseGenerationPair>("/api/generate-responses", params, signal);
}

export function evaluateResponsesApi(
  params: {
    originalPrompt: string;
    originalResponse: string;
    optimizedResponse: string;
    model: GeminiModelId;
  },
  signal?: AbortSignal
): Promise<BlindEvaluationResult> {
  return postJson<BlindEvaluationResult>("/api/evaluate", params, signal);
}
