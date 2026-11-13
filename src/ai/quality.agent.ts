import { z } from "zod";
import {
  getGeminiClient,
  getGeminiQualityFallbackModel,
  getGeminiQualityModel
} from "./gemini.client";
import { buildQualityPrompt, QualityPromptInput } from "./prompts/quality.prompt";
import { HttpError } from "../errors/http.error";

const issueSchema = z.object({
  category: z.enum(["SEO", "FACTUAL", "READABILITY", "BRAND", "STRUCTURE", "OTHER"]),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  message: z.string().trim().min(1).max(500),
  suggestion: z.string().trim().min(1).max(500)
});

export const qualityReviewSchema = z.object({
  decision: z.enum(["PASS", "REVISION_REQUIRED"]),
  seoScore: z.number().int().min(0).max(100),
  qualityScore: z.number().int().min(0).max(100),
  metaDescription: z.string().trim().min(50).max(180),
  summary: z.string().trim().min(1).max(1000),
  issues: z.array(issueSchema).max(20),
  revisionInstructions: z.array(z.string().trim().min(1).max(500)).max(12)
});

export type QualityReview = z.infer<typeof qualityReviewSchema>;

const qualityResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "string",
      enum: ["PASS", "REVISION_REQUIRED"]
    },
    seoScore: { type: "integer", minimum: 0, maximum: 100 },
    qualityScore: { type: "integer", minimum: 0, maximum: 100 },
    metaDescription: { type: "string" },
    summary: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: {
            type: "string",
            enum: ["SEO", "FACTUAL", "READABILITY", "BRAND", "STRUCTURE", "OTHER"]
          },
          severity: {
            type: "string",
            enum: ["HIGH", "MEDIUM", "LOW"]
          },
          message: { type: "string" },
          suggestion: { type: "string" }
        },
        required: ["category", "severity", "message", "suggestion"]
      }
    },
    revisionInstructions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "decision",
    "seoScore",
    "qualityScore",
    "metaDescription",
    "summary",
    "issues",
    "revisionInstructions"
  ]
};

const QUALITY_CALL_TIMEOUT_MS = 45_000;
const RETRY_DELAYS_MS = [1_000, 2_500];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : JSON.stringify(error);

const isTransientGeminiError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return (
    /"code"\s*:\s*(429|503)/i.test(message) ||
    /\b(429|503)\b/.test(message) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|temporarily overloaded/i.test(message)
  );
};

const isTimeoutError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return ["TimeoutError", "AbortError", "RequestTimeoutError"].includes(error.name);
};

export interface QualityAgentResult {
  review: QualityReview;
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
}

export const runQualityAgent = async (
  input: QualityPromptInput
): Promise<QualityAgentResult> => {
  const client = await getGeminiClient();
  const primaryModel = getGeminiQualityModel();
  const fallbackModel = getGeminiQualityFallbackModel();
  const models = [...new Set([primaryModel, fallbackModel])];
  const prompt = buildQualityPrompt(input);
  const { ThinkingLevel } = await import("@google/genai");

  let response;
  let usedModel = primaryModel;
  let lastError: unknown;

  for (const model of models) {
    const maxAttempts = model === primaryModel ? 2 : 2;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: qualityResponseSchema,
            temperature: 0.1,
            maxOutputTokens: 2500,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW
            },
            abortSignal: AbortSignal.timeout(QUALITY_CALL_TIMEOUT_MS)
          }
        });

        usedModel = model;
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (isTimeoutError(error)) {
          break;
        }

        if (!isTransientGeminiError(error)) {
          throw new HttpError(502, "Gemini quality request failed", {
            provider: "GEMINI",
            model,
            errorMessage: getErrorMessage(error)
          });
        }

        if (attempt < maxAttempts - 1) {
          const jitterMs = Math.floor(Math.random() * 400);
          await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] + jitterMs);
        }
      }
    }

    if (response) break;
  }

  if (!response) {
    if (isTimeoutError(lastError)) {
      throw new HttpError(504, "Gemini quality request timed out", {
        provider: "GEMINI",
        attemptedModels: models,
        timeoutMs: QUALITY_CALL_TIMEOUT_MS
      });
    }

    throw new HttpError(503, "Gemini quality is temporarily unavailable", {
      provider: "GEMINI",
      attemptedModels: models,
      errorMessage: getErrorMessage(lastError)
    });
  }

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new HttpError(502, "Gemini returned an empty quality response", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, "Gemini quality returned invalid JSON", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  const parsedReview = qualityReviewSchema.safeParse(parsedJson);

  if (!parsedReview.success) {
    throw new HttpError(502, "Gemini quality response did not match the required schema", {
      provider: "GEMINI",
      model: usedModel,
      validationErrors: parsedReview.error.flatten()
    });
  }

  const hasHighIssue = parsedReview.data.issues.some((issue) => issue.severity === "HIGH");
  const mustRevise =
    parsedReview.data.seoScore < 75 ||
    parsedReview.data.qualityScore < 80 ||
    hasHighIssue;

  const issueRevisionInstructions = parsedReview.data.issues
    .filter((issue) => issue.severity !== "LOW")
    .map((issue) => issue.suggestion);

  const fallbackRevisionInstructions =
    issueRevisionInstructions.length > 0
      ? issueRevisionInstructions
      : [`Improve the draft based on this quality review: ${parsedReview.data.summary}`];

  const normalizedReview: QualityReview = {
    ...parsedReview.data,
    decision: mustRevise ? "REVISION_REQUIRED" : "PASS",
    revisionInstructions: mustRevise
      ? (
          parsedReview.data.revisionInstructions.length > 0
            ? parsedReview.data.revisionInstructions
            : fallbackRevisionInstructions
        )
      : []
  };

  return {
    review: normalizedReview,
    model: usedModel,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null
    }
  };
};
