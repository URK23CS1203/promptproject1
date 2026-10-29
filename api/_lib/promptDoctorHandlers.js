import "dotenv/config";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const ALLOWED_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
];
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MAX_PROMPT_LENGTH = 16000;
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

const EVALUATION_WEIGHTS = {
  relevance: 0.25,
  completeness: 0.2,
  clarity: 0.2,
  accuracy: 0.2,
  structure: 0.15,
};

function createHttpError(statusCode, message, code = "API_ERROR") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Sends a JSON HTTP response compatible with both Vercel Serverless (Node http.ServerResponse)
 * and Express Response objects.
 * @param {any} res
 * @param {number} statusCode
 * @param {Record<string, unknown>} payload
 */
export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/**
 * Ensures the incoming request uses HTTP POST (with OPTIONS preflight support).
 * Returns true if valid POST, or false after writing the appropriate response.
 * @param {any} req
 * @param {any} res
 * @param {string} endpointPath
 */
export function ensurePostMethod(req, res, endpointPath) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "POST, OPTIONS");
    res.end();
    return false;
  }
  if (method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    sendJson(res, 405, {
      error: `Method ${method} not allowed. Send a POST request with a JSON body to ${endpointPath}.`,
      code: "METHOD_NOT_ALLOWED",
      endpoint: endpointPath,
      status: "online",
    });
    return false;
  }
  return true;
}

/**
 * Safely parses JSON request body across Vercel Serverless (pre-parsed object/string/buffer)
 * and raw Node IncomingMessage streams.
 * @param {any} req
 * @returns {Promise<Record<string, any>>}
 */
export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString("utf8").trim();
      if (!str) return {};
      try {
        return JSON.parse(str);
      } catch {
        throw createHttpError(400, "Invalid JSON in request body.", "INVALID_JSON");
      }
    }
    if (typeof req.body === "string") {
      const trimmed = req.body.trim();
      if (!trimmed) return {};
      try {
        return JSON.parse(trimmed);
      } catch {
        throw createHttpError(400, "Invalid JSON in request body.", "INVALID_JSON");
      }
    }
    if (typeof req.body === "object") {
      return req.body;
    }
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    let totalBytes = 0;

    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(createHttpError(413, "Request payload exceeds 1 MB limit.", "PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      raw += buf.toString("utf8");
    });

    req.on("end", () => {
      const trimmed = raw.trim();
      if (!trimmed) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        reject(createHttpError(400, "Invalid JSON in request body.", "INVALID_JSON"));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function resolveModel(requestedModel) {
  if (typeof requestedModel === "string" && ALLOWED_MODELS.includes(requestedModel)) {
    return requestedModel;
  }
  return DEFAULT_MODEL;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey.trim() === "MY_GEMINI_API_KEY") {
    throw createHttpError(
      503,
      "GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Vercel Project Settings > Environment Variables (and redeploy), AI Studio Secrets, or your local .env file.",
      "MISSING_API_KEY"
    );
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      timeout: 55000,
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function withModelThinkingConfig(model, config = {}) {
  return {
    ...config,
    thinkingConfig: {
      thinkingLevel:
        model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
    },
  };
}

function isTransientOverloadError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /503|504|UNAVAILABLE|DEADLINE_EXCEEDED|high demand|overloaded|timed out|timeout|aborted/i.test(
    msg
  );
}

function getFallbackChain(preferred) {
  const chain = [preferred];
  for (const candidate of ALLOWED_MODELS) {
    if (!chain.includes(candidate)) {
      chain.push(candidate);
    }
  }
  return chain;
}

async function generateWithModelFallback(ai, preferredModel, contents, config) {
  const chain = getFallbackChain(preferredModel);
  let lastError = null;

  for (const candidateModel of chain) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents,
        config: withModelThinkingConfig(candidateModel, config),
      });
      return { response, usedModel: candidateModel };
    } catch (err) {
      lastError = err;
      if (!isTransientOverloadError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parseJsonModelOutput(rawText, stageName) {
  if (!rawText || !rawText.trim()) {
    throw createHttpError(
      502,
      `Gemini returned an empty output during ${stageName}.`,
      "EMPTY_MODEL_OUTPUT"
    );
  }

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw createHttpError(
      502,
      `Failed to parse structured JSON returned during ${stageName}. Please retry.`,
      "INVALID_MODEL_JSON"
    );
  }
}

function validatePromptInput(value, fieldLabel) {
  if (typeof value !== "string" || !value.trim()) {
    throw createHttpError(400, `${fieldLabel} cannot be empty.`, "VALIDATION_ERROR");
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    throw createHttpError(
      400,
      `${fieldLabel} exceeds the maximum length of ${MAX_PROMPT_LENGTH.toLocaleString()} characters.`,
      "VALIDATION_ERROR"
    );
  }
  return trimmed;
}

function computeWeightedResponseScore(criteria) {
  const weighted =
    criteria.relevance * EVALUATION_WEIGHTS.relevance +
    criteria.completeness * EVALUATION_WEIGHTS.completeness +
    criteria.clarity * EVALUATION_WEIGHTS.clarity +
    criteria.accuracy * EVALUATION_WEIGHTS.accuracy +
    criteria.structure * EVALUATION_WEIGHTS.structure;
  return Math.round(weighted * 10) / 10;
}

function remapBlindLabels(text, originalIsCandidateA) {
  return text.replace(/\bCandidate\s+([AB])\b/gi, (_, letter) => {
    const isA = String(letter).toUpperCase() === "A";
    if (isA) {
      return originalIsCandidateA ? "Original Response" : "Optimized Response";
    }
    return originalIsCandidateA ? "Optimized Response" : "Original Response";
  });
}

async function generateSingleResponseStrictModel(ai, model, promptText) {
  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model,
    contents: promptText,
    config: withModelThinkingConfig(model, {
      temperature: 0.3,
      topP: 0.95,
    }),
  });
  const durationMs = Date.now() - startedAt;
  const text = response.text ?? "";

  if (!text.trim()) {
    const finishReason = response.candidates?.[0]?.finishReason ?? "UNKNOWN";
    throw createHttpError(
      422,
      `The AI model returned an empty completion (reason: ${finishReason}). Adjust the prompt and try again.`,
      "EMPTY_COMPLETION"
    );
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    text,
    durationMs,
    wordCount,
    charCount: text.length,
    model,
  };
}

async function generateSymmetricPairWithFallback(
  ai,
  preferredModel,
  originalPrompt,
  optimizedPrompt
) {
  const chain = getFallbackChain(preferredModel);
  let lastError = null;

  for (const candidateModel of chain) {
    try {
      const [originalResponse, optimizedResponse] = await Promise.all([
        generateSingleResponseStrictModel(ai, candidateModel, originalPrompt),
        generateSingleResponseStrictModel(ai, candidateModel, optimizedPrompt),
      ]);
      return {
        originalResponse,
        optimizedResponse,
        usedModel: candidateModel,
      };
    } catch (err) {
      lastError = err;
      if (!isTransientOverloadError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

/**
 * Centralized error response writer.
 * @param {any} err
 * @param {any} res
 */
export function handleApiError(err, res) {
  const status =
    err?.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  const rawMessage =
    err?.message || "Unexpected server error while communicating with Gemini API.";

  let userMessage = rawMessage;
  let code = err?.code || "SERVER_ERROR";
  let finalStatus = status;

  if (/API_KEY_INVALID|invalid api key|API key not valid/i.test(rawMessage)) {
    finalStatus = 401;
    code = "INVALID_API_KEY";
    userMessage =
      "The configured GEMINI_API_KEY was rejected as invalid. Verify GEMINI_API_KEY in Vercel Environment Variables, AI Studio Secrets, or your local .env file.";
  } else if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
    finalStatus = 429;
    code = "RATE_LIMITED";
    userMessage = "Gemini API rate limit or quota reached. Wait a moment and retry your request.";
  } else if (
    code !== "MISSING_API_KEY" &&
    /503|504|UNAVAILABLE|DEADLINE_EXCEEDED|high demand/i.test(rawMessage)
  ) {
    finalStatus = 503;
    code = "MODEL_UNAVAILABLE";
    userMessage =
      "Gemini models are temporarily experiencing high demand. Please retry in a few seconds.";
  }

  sendJson(res, finalStatus, {
    error: userMessage,
    code,
  });
}

/**
 * POST /api/analyze
 * @param {any} req
 * @param {any} res
 */
export async function handleAnalyze(req, res) {
  if (!ensurePostMethod(req, res, "/api/analyze")) return;

  try {
    const body = await readJsonBody(req);
    const prompt = validatePromptInput(body?.prompt, "Original prompt");
    const preferredModel = resolveModel(body?.model);
    const ai = getGeminiClient();

    const { response, usedModel } = await generateWithModelFallback(
      ai,
      preferredModel,
      `Analyze the following user prompt objectively across four prompt-engineering dimensions:\n\n"""\n${prompt}\n"""`,
      {
        temperature: 0.2,
        systemInstruction: `You are an objective prompt engineering diagnostician.
Evaluate the user's prompt strictly on merit across 4 dimensions (0-100 integer scale):
- clarity: How unambiguous, specific, and direct the core task is.
- context: Whether relevant background, target audience, or domain scope is clear.
- constraints: Whether boundaries, edge cases, tone, or length/scope expectations are defined where needed.
- structure: Whether the desired output format or organization is clear.

Fairness & calibration rules:
- Score honestly: vague, underspecified one-liners should score low (15-45), moderately clear prompts mid-range (50-75), and clear, well-scoped prompts high (80-98).
- Do NOT penalize concise prompts if their intent, scope, and expected output are already unambiguous.
- Provide concrete, actionable issues (if any exist) and genuine strengths.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedIntent: {
              type: Type.STRING,
              description: "Concise one-sentence summary of what the user wants to accomplish.",
            },
            dimensions: {
              type: Type.OBJECT,
              properties: {
                clarity: {
                  type: Type.INTEGER,
                  description: "0 to 100 score for clarity and specificity.",
                },
                context: {
                  type: Type.INTEGER,
                  description: "0 to 100 score for context and scope.",
                },
                constraints: {
                  type: Type.INTEGER,
                  description: "0 to 100 score for boundaries and constraints.",
                },
                structure: {
                  type: Type.INTEGER,
                  description: "0 to 100 score for output format clarity.",
                },
              },
              required: ["clarity", "context", "constraints", "structure"],
            },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "1 to 4 genuine strengths present in the prompt.",
            },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: {
                    type: Type.STRING,
                    description: "Must be one of: high, medium, low",
                  },
                  dimension: {
                    type: Type.STRING,
                    description: "Must be one of: clarity, context, constraints, structure",
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  fixSuggestion: { type: Type.STRING },
                },
                required: ["severity", "dimension", "title", "description", "fixSuggestion"],
              },
            },
          },
          required: ["detectedIntent", "dimensions", "strengths", "issues"],
        },
      }
    );

    const parsed = parseJsonModelOutput(response.text, "prompt analysis");

    const dimensions = {
      clarity: clampScore(parsed.dimensions?.clarity),
      context: clampScore(parsed.dimensions?.context),
      constraints: clampScore(parsed.dimensions?.constraints),
      structure: clampScore(parsed.dimensions?.structure),
    };

    const overallScore = Math.round(
      (dimensions.clarity + dimensions.context + dimensions.constraints + dimensions.structure) / 4
    );

    const validSeverities = new Set(["high", "medium", "low"]);
    const validDimensions = new Set(["clarity", "context", "constraints", "structure"]);

    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((item) => item && item.title && item.description)
          .map((item) => ({
            severity: validSeverities.has(String(item.severity).toLowerCase())
              ? String(item.severity).toLowerCase()
              : "medium",
            dimension: validDimensions.has(String(item.dimension).toLowerCase())
              ? String(item.dimension).toLowerCase()
              : "clarity",
            title: String(item.title).trim(),
            description: String(item.description).trim(),
            fixSuggestion: String(item.fixSuggestion ?? "").trim(),
          }))
      : [];

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean)
      : [];

    sendJson(res, 200, {
      overallScore,
      detectedIntent:
        String(parsed.detectedIntent ?? "").trim() || "General user task execution.",
      dimensions,
      strengths,
      issues,
      analyzedAt: new Date().toISOString(),
      model: usedModel,
    });
  } catch (err) {
    handleApiError(err, res);
  }
}

/**
 * POST /api/optimize
 * @param {any} req
 * @param {any} res
 */
export async function handleOptimize(req, res) {
  if (!ensurePostMethod(req, res, "/api/optimize")) return;

  try {
    const body = await readJsonBody(req);
    const prompt = validatePromptInput(body?.prompt, "Original prompt");
    const preferredModel = resolveModel(body?.model);
    const rawStrategy = typeof body?.strategy === "string" ? body.strategy : "balanced";
    const allowedStrategies = ["balanced", "concise", "structured", "reasoning"];
    const strategy = allowedStrategies.includes(rawStrategy) ? rawStrategy : "balanced";

    const analysisContext = body?.analysis
      ? `\nDiagnostic findings to address:\n${JSON.stringify(
          {
            detectedIntent: body.analysis.detectedIntent,
            issues: body.analysis.issues,
          },
          null,
          2
        )}`
      : "";

    const strategyInstructions = {
      balanced:
        "Balance precision, necessary context, and clear output formatting without unnecessary verbosity.",
      concise:
        "Keep the rewritten prompt compact and high-signal. Eliminate ambiguity using minimal extra words and request a direct, fluff-free response.",
      structured:
        "Specify clear structural organization, explicit sections or schema expectations, and concrete constraints.",
      reasoning:
        "Encourage systematic analytical steps, explicit assumptions/trade-offs, and verification of edge cases.",
    };

    const ai = getGeminiClient();
    const { response, usedModel } = await generateWithModelFallback(
      ai,
      preferredModel,
      `Original Prompt:\n"""\n${prompt}\n"""\n\nOptimization Strategy: ${strategy} (${strategyInstructions[strategy]})${analysisContext}`,
      {
        temperature: 0.3,
        systemInstruction: `You are an expert prompt engineer. Rewrite the user's Original Prompt to make it clearer, better scoped, and more effective while faithfully preserving 100% of the user's original intent and factual details.

Rules:
1. Return ONLY the ready-to-send prompt inside 'optimizedPrompt' (no surrounding quotes or meta explanations).
2. Do NOT invent arbitrary domain facts, fake company names, or constraints that conflict with the user's goal.
3. Avoid generic filler clichés like "Act as a world-class genius with 30 years of experience". Use clean, specific instructions.
4. Ensure the optimized prompt asks for an accurate, well-structured, concise-yet-complete response tailored to the user's real goal.
5. If the original prompt is already strong and explicit, refine only minor ambiguities rather than over-complicating it.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedPrompt: {
              type: Type.STRING,
              description: "The improved, ready-to-use prompt text.",
            },
            rationale: {
              type: Type.STRING,
              description: "Brief explanation of how the rewrite strengthens prompt effectiveness.",
            },
            improvements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dimension: { type: Type.STRING },
                  change: { type: Type.STRING },
                  impact: { type: Type.STRING },
                },
                required: ["dimension", "change", "impact"],
              },
            },
          },
          required: ["optimizedPrompt", "rationale", "improvements"],
        },
      }
    );

    const parsed = parseJsonModelOutput(response.text, "prompt optimization");
    const optimizedPrompt = String(parsed.optimizedPrompt ?? "").trim();

    if (!optimizedPrompt) {
      throw createHttpError(
        502,
        "Optimizer returned an empty prompt. Please retry.",
        "EMPTY_OPTIMIZATION"
      );
    }

    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements
          .filter((item) => item && item.change)
          .map((item) => ({
            dimension: String(item.dimension ?? "General").trim(),
            change: String(item.change).trim(),
            impact: String(item.impact ?? "").trim(),
          }))
      : [];

    sendJson(res, 200, {
      optimizedPrompt,
      rationale: String(parsed.rationale ?? "").trim(),
      improvements,
      strategy,
      optimizedAt: new Date().toISOString(),
      model: usedModel,
    });
  } catch (err) {
    handleApiError(err, res);
  }
}

/**
 * POST /api/generate-responses
 * @param {any} req
 * @param {any} res
 */
export async function handleGenerateResponses(req, res) {
  if (!ensurePostMethod(req, res, "/api/generate-responses")) return;

  try {
    const body = await readJsonBody(req);
    const originalPrompt = validatePromptInput(body?.originalPrompt, "Original prompt");
    const optimizedPrompt = validatePromptInput(body?.optimizedPrompt, "Optimized prompt");
    const preferredModel = resolveModel(body?.model);
    const ai = getGeminiClient();

    const { originalResponse, optimizedResponse, usedModel } =
      await generateSymmetricPairWithFallback(
        ai,
        preferredModel,
        originalPrompt,
        optimizedPrompt
      );

    sendJson(res, 200, {
      originalResponse,
      optimizedResponse,
      generatedAt: new Date().toISOString(),
      model: usedModel,
    });
  } catch (err) {
    handleApiError(err, res);
  }
}

/**
 * POST /api/evaluate
 * @param {any} req
 * @param {any} res
 */
export async function handleEvaluate(req, res) {
  if (!ensurePostMethod(req, res, "/api/evaluate")) return;

  try {
    const body = await readJsonBody(req);
    const originalPrompt = validatePromptInput(body?.originalPrompt, "Original prompt");
    const originalResponse = validatePromptInput(body?.originalResponse, "Original response");
    const optimizedResponse = validatePromptInput(
      body?.optimizedResponse,
      "Optimized response"
    );
    const preferredModel = resolveModel(body?.model);
    const ai = getGeminiClient();

    const responsesAreIdentical = originalResponse === optimizedResponse;
    const originalIsCandidateA = Math.random() < 0.5;

    const candidateAText = originalIsCandidateA ? originalResponse : optimizedResponse;
    const candidateBText = originalIsCandidateA ? optimizedResponse : originalResponse;

    const candidateSchema = {
      type: Type.OBJECT,
      properties: {
        criteria: {
          type: Type.OBJECT,
          properties: {
            relevance: {
              type: Type.INTEGER,
              description: "0-100 score for alignment with user's intent.",
            },
            completeness: {
              type: Type.INTEGER,
              description: "0-100 score for thoroughness on key requirements.",
            },
            clarity: {
              type: Type.INTEGER,
              description: "0-100 score for readability, directness, and absence of fluff.",
            },
            accuracy: {
              type: Type.INTEGER,
              description: "0-100 score for factual/technical correctness and sound reasoning.",
            },
            structure: {
              type: Type.INTEGER,
              description: "0-100 score for organization, formatting, and actionability.",
            },
          },
          required: ["relevance", "completeness", "clarity", "accuracy", "structure"],
        },
        strengths: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        weaknesses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        rationale: {
          type: Type.STRING,
        },
      },
      required: ["criteria", "strengths", "weaknesses", "rationale"],
    };

    const { response: evalResponse, usedModel } = await generateWithModelFallback(
      ai,
      preferredModel,
      `User's Core Request:\n"""\n${originalPrompt}\n"""\n\n=== CANDIDATE A ===\n"""\n${candidateAText}\n"""\n\n=== CANDIDATE B ===\n"""\n${candidateBText}\n"""`,
      {
        temperature: 0.1,
        systemInstruction: `You are an impartial, blind AI output evaluator.
You are given a User's Core Request and two anonymous AI-generated responses: Candidate A and Candidate B.
You do NOT know how Candidate A or Candidate B were prompted.

Evaluate BOTH Candidate A and Candidate B using the EXACT SAME 5 criteria (0 to 100 integer scale):
1. relevance (25% weight): Directly answers the user's core request without drifting off-topic or inventing unrequested constraints.
2. completeness (20% weight): Covers all essential parts needed to fulfill the user's request.
3. clarity (20% weight): Clear, readable, direct expression. CRITICAL: Do NOT reward length or verbosity for its own sake. Penalize filler, unnecessary preamble, or over-complicated padding when a concise response serves the user better.
4. accuracy (20% weight): Technical/factual correctness, logical coherence, and absence of hallucinations.
5. structure (15% weight): Appropriate formatting and organization that makes the answer immediately usable.

STRICT FAIRNESS RULES:
- Neither Candidate A nor Candidate B should be favored by position or length.
- Candidate A may score higher, Candidate B may score higher, or they may tie.
- If both candidates are identical in text, give them identical scores.
- Refer to the outputs as "Candidate A" and "Candidate B" in your rationale and comparativeSummary.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidateA: candidateSchema,
            candidateB: candidateSchema,
            comparativeSummary: {
              type: Type.STRING,
              description:
                "2-3 sentence unbiased comparison explaining why one candidate scored higher or why they tied.",
            },
          },
          required: ["candidateA", "candidateB", "comparativeSummary"],
        },
      }
    );

    const parsed = parseJsonModelOutput(evalResponse.text, "response evaluation");

    const normalizeCandidate = (raw) => {
      const criteria = {
        relevance: clampScore(raw?.criteria?.relevance),
        completeness: clampScore(raw?.criteria?.completeness),
        clarity: clampScore(raw?.criteria?.clarity),
        accuracy: clampScore(raw?.criteria?.accuracy),
        structure: clampScore(raw?.criteria?.structure),
      };
      const overallScore = computeWeightedResponseScore(criteria);
      return {
        criteria,
        overallScore,
        strengths: Array.isArray(raw?.strengths)
          ? raw.strengths
              .map((s) => remapBlindLabels(String(s).trim(), originalIsCandidateA))
              .filter(Boolean)
          : [],
        weaknesses: Array.isArray(raw?.weaknesses)
          ? raw.weaknesses
              .map((s) => remapBlindLabels(String(s).trim(), originalIsCandidateA))
              .filter(Boolean)
          : [],
        rationale: remapBlindLabels(String(raw?.rationale ?? "").trim(), originalIsCandidateA),
      };
    };

    const normalizedA = normalizeCandidate(parsed.candidateA);
    const normalizedB = responsesAreIdentical
      ? normalizedA
      : normalizeCandidate(parsed.candidateB);

    const originalEvaluation = originalIsCandidateA ? normalizedA : normalizedB;
    const optimizedEvaluation = originalIsCandidateA ? normalizedB : normalizedA;

    const scoreDelta =
      Math.round((optimizedEvaluation.overallScore - originalEvaluation.overallScore) * 10) / 10;
    const winner =
      optimizedEvaluation.overallScore > originalEvaluation.overallScore
        ? "optimized"
        : originalEvaluation.overallScore > optimizedEvaluation.overallScore
        ? "original"
        : "tie";

    const comparativeSummary = responsesAreIdentical
      ? "Both prompts produced identical model outputs, resulting in an exact tie across all evaluation criteria."
      : remapBlindLabels(String(parsed.comparativeSummary ?? "").trim(), originalIsCandidateA);

    sendJson(res, 200, {
      original: originalEvaluation,
      optimized: optimizedEvaluation,
      weights: EVALUATION_WEIGHTS,
      scoreDelta,
      winner,
      comparativeSummary,
      blindAssignment: {
        originalAssignedTo: originalIsCandidateA ? "Candidate A" : "Candidate B",
        optimizedAssignedTo: originalIsCandidateA ? "Candidate B" : "Candidate A",
      },
      evaluatedAt: new Date().toISOString(),
      model: usedModel,
    });
  } catch (err) {
    handleApiError(err, res);
  }
}
