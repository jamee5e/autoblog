import { z } from "zod";
import { getGeminiClient, getGeminiModel } from "./gemini.client";
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

const WRITER_TIMEOUT_MS = 90_000;

export const runWriterAgent = async (
  input: WriterPromptInput
): Promise<WriterAgentResult> => {
  const client = await getGeminiClient();
  const model = getGeminiModel();
  const prompt = buildWriterPrompt(input);
  const { ThinkingLevel } = await import("@google/genai");

  let response;

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
        abortSignal: AbortSignal.timeout(WRITER_TIMEOUT_MS)
      }
    });
  } catch (error) {
    const errorName =
      error instanceof Error ? error.name : "UnknownError";

    if (errorName === "TimeoutError" || errorName === "AbortError" || errorName === "RequestTimeoutError") {
      throw new HttpError(504, "Gemini writer request timed out", {
        provider: "GEMINI",
        model,
        timeoutMs: WRITER_TIMEOUT_MS
      });
    }

    throw new HttpError(502, "Gemini writer request failed", {
      provider: "GEMINI",
      model,
      errorMessage: error instanceof Error ? error.message : "Unknown Gemini error"
    });
  }
  const responseText = response.text?.trim();

  if (!responseText) {
    throw new HttpError(502, "Gemini returned an empty writer response", {
      provider: "GEMINI",
      model
    });
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, "Gemini writer returned invalid JSON", {
      provider: "GEMINI",
      model
    });
  }

  const parsedDraft = articleDraftSchema.safeParse(parsedJson);

  if (!parsedDraft.success) {
    throw new HttpError(502, "Gemini writer response did not match the required schema", {
      provider: "GEMINI",
      model,
      validationErrors: parsedDraft.error.flatten()
    });
  }

  if (containsUnsafeHtml(parsedDraft.data.content)) {
    throw new HttpError(502, "Gemini writer returned unsafe HTML", {
      provider: "GEMINI",
      model
    });
  }

  return {
    draft: parsedDraft.data,
    model,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null
    }
  };
};
