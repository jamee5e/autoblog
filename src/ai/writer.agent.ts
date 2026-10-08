import { z } from "zod";
import {
  getGeminiClient,
  getGeminiWriterFallbackModel,
  getGeminiWriterModel
} from "./gemini.client";
import { buildWriterPrompt, WriterPromptInput } from "./prompts/writer.prompt";
import { HttpError } from "../errors/http.error";

export const articleDraftSchema = z.object({
  title: z.string().trim().min(5).max(180),
  slug: z.string().trim().min(3).max(180),
  excerpt: z.string().trim().min(20).max(500),
  content: z.string().trim().min(300)
});

export type ArticleDraft = z.infer<typeof articleDraftSchema>;

const articleDraftResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    excerpt: { type: "string" },
    content: { type: "string" }
  },
  required: ["title", "slug", "excerpt", "content"]
};

const containsUnsafeHtml = (html: string): boolean =>
  /<(script|style|iframe|form|object|embed)\b/i.test(html) ||
  /\son[a-z]+\s*=/i.test(html) ||
  /javascript\s*:/i.test(html);

export interface WriterAgentResult {
  draft: ArticleDraft;
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
}

const WRITER_CALL_TIMEOUT_MS = 45_000;
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

export const runWriterAgent = async (
  input: WriterPromptInput
): Promise<WriterAgentResult> => {
  const client = await getGeminiClient();
  const primaryModel = getGeminiWriterModel();
  const fallbackModel = getGeminiWriterFallbackModel();
  const models = [...new Set([primaryModel, fallbackModel])];
  const prompt = buildWriterPrompt(input);
  const { ThinkingLevel } = await import("@google/genai");

  let response;
  let usedModel = primaryModel;
  let lastError: unknown;

  for (const model of models) {
    const maxAttempts = model === primaryModel ? 3 : 2;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: articleDraftResponseSchema,
            temperature: 0.4,
            maxOutputTokens: 4500,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW
            },
            abortSignal: AbortSignal.timeout(WRITER_CALL_TIMEOUT_MS)
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
          throw new HttpError(502, "Gemini writer request failed", {
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
      throw new HttpError(504, "Gemini writer request timed out", {
        provider: "GEMINI",
        primaryModel,
        fallbackModel,
        timeoutMs: WRITER_CALL_TIMEOUT_MS
      });
    }

    throw new HttpError(503, "Gemini writer is temporarily unavailable", {
      provider: "GEMINI",
      primaryModel,
      fallbackModel,
      errorMessage: getErrorMessage(lastError)
    });
  }

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new HttpError(502, "Gemini returned an empty writer response", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, "Gemini writer returned invalid JSON", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  const parsedDraft = articleDraftSchema.safeParse(parsedJson);

  if (!parsedDraft.success) {
    throw new HttpError(502, "Gemini writer response did not match the required schema", {
      provider: "GEMINI",
      model: usedModel,
      validationErrors: parsedDraft.error.flatten()
    });
  }

  if (containsUnsafeHtml(parsedDraft.data.content)) {
    throw new HttpError(502, "Gemini writer returned unsafe HTML", {
      provider: "GEMINI",
      model: usedModel
    });
  }

  return {
    draft: parsedDraft.data,
    model: usedModel,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null
    }
  };
};
