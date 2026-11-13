import { z } from "zod";
import {
  getGeminiClient,
  getGeminiModel,
  getGeminiResearchFallbackModel
} from "./gemini.client";
import { buildResearchPrompt, ResearchPromptInput } from "./prompts/research.prompt";
import { HttpError } from "../errors/http.error";

const researchFactSchema = z.object({
  fact: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  verificationNeeded: z.boolean()
});

const researchSectionSchema = z.object({
  heading: z.string().min(1),
  purpose: z.string().min(1)
});

export const researchBriefSchema = z.object({
  searchIntent: z.string().min(1),
  targetAudience: z.string().min(1),
  contentAngle: z.string().min(1),
  keyQuestions: z.array(z.string().min(1)),
  keyFacts: z.array(researchFactSchema),
  recommendedSections: z.array(researchSectionSchema),
  relatedKeywords: z.array(z.string().min(1)),
  entities: z.array(z.string().min(1)),
  notesForWriter: z.array(z.string().min(1))
});

export type ResearchBrief = z.infer<typeof researchBriefSchema>;

const researchResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    searchIntent: { type: "string" },
    targetAudience: { type: "string" },
    contentAngle: { type: "string" },
    keyQuestions: {
      type: "array",
      items: { type: "string" }
    },
    keyFacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fact: { type: "string" },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"]
          },
          verificationNeeded: { type: "boolean" }
        },
        required: ["fact", "confidence", "verificationNeeded"]
      }
    },
    recommendedSections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          purpose: { type: "string" }
        },
        required: ["heading", "purpose"]
      }
    },
    relatedKeywords: {
      type: "array",
      items: { type: "string" }
    },
    entities: {
      type: "array",
      items: { type: "string" }
    },
    notesForWriter: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "searchIntent",
    "targetAudience",
    "contentAngle",
    "keyQuestions",
    "keyFacts",
    "recommendedSections",
    "relatedKeywords",
    "entities",
    "notesForWriter"
  ]
};

export interface ResearchAgentResult {
  research: ResearchBrief;
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
}

const RESEARCH_CALL_TIMEOUT_MS = 45_000;
const RESEARCH_RETRY_DELAYS_MS = [1_000, 2_500];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : JSON.stringify(error);

const isDailyQuotaError = (error: unknown): boolean => {
  const message = getErrorMessage(error);

  return (
    /requests per day/i.test(message) ||
    /per day per model/i.test(message) ||
    /daily.*quota/i.test(message)
  );
};

const isTransientGeminiError = (error: unknown): boolean => {
  const message = getErrorMessage(error);

  return (
    /"code"\s*:\s*(429|500|502|503|504)/i.test(message) ||
    /\b(429|500|502|503|504)\b/.test(message) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|high demand|temporarily overloaded/i.test(message) ||
    /Unexpected HTTP client error|TypeError:\s*unusable|fetch failed|network error|ECONNRESET|ETIMEDOUT/i.test(message)
  );
};

const isTimeoutError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  return ["TimeoutError", "AbortError", "RequestTimeoutError"].includes(
    error.name
  );
};

export const runResearchAgent = async (
  input: ResearchPromptInput
): Promise<ResearchAgentResult> => {
  const client = await getGeminiClient();
  const primaryModel = getGeminiModel();
  const fallbackModel = getGeminiResearchFallbackModel();
  const models = [...new Set([primaryModel, fallbackModel])];
  const prompt = buildResearchPrompt(input);
  const { ThinkingLevel } = await import("@google/genai");

  let response;
  let usedModel = primaryModel;
  let lastError: unknown;

  for (const model of models) {
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: researchResponseSchema,
            temperature: 0.2,
            maxOutputTokens: 3000,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW
            },
            abortSignal: AbortSignal.timeout(RESEARCH_CALL_TIMEOUT_MS)
          }
        });

        usedModel = model;
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (isDailyQuotaError(error) || isTimeoutError(error)) {
          break;
        }

        if (!isTransientGeminiError(error)) {
          throw new HttpError(502, "Gemini research request failed", {
            provider: "GEMINI",
            model,
            errorMessage: getErrorMessage(error)
          });
        }

        if (attempt < maxAttempts - 1) {
          const jitterMs = Math.floor(Math.random() * 400);
          await sleep(
            RESEARCH_RETRY_DELAYS_MS[
              Math.min(attempt, RESEARCH_RETRY_DELAYS_MS.length - 1)
            ] + jitterMs
          );
        }
      }
    }

    if (response) break;
  }

  if (!response) {
    const dailyQuotaExceeded = isDailyQuotaError(lastError);

    if (isTimeoutError(lastError)) {
      throw new HttpError(504, "Gemini research request timed out", {
        provider: "GEMINI",
        attemptedModels: models,
        timeoutMs: RESEARCH_CALL_TIMEOUT_MS
      });
    }

    throw new HttpError(
      dailyQuotaExceeded ? 429 : 503,
      dailyQuotaExceeded
        ? "Gemini research daily quota exceeded for all configured models"
        : "Gemini research is temporarily unavailable",
      {
        provider: "GEMINI",
        attemptedModels: models,
        errorMessage: getErrorMessage(lastError)
      }
    );
  }

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new HttpError(502, "Gemini returned an empty research response", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, "Gemini returned invalid JSON", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  const parsedResearch = researchBriefSchema.safeParse(parsedJson);

  if (!parsedResearch.success) {
    throw new HttpError(
      502,
      "Gemini research response did not match the required schema",
      {
        provider: "GEMINI",
        model: usedModel,
        validationErrors: parsedResearch.error.flatten()
      }
    );
  }

  return {
    research: parsedResearch.data,
    model: usedModel,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null
    }
  };
};
