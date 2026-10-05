import { z } from "zod";
import { getGeminiClient, getGeminiModel } from "./gemini.client";
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

export const runResearchAgent = async (
  input: ResearchPromptInput
): Promise<ResearchAgentResult> => {
  const client = await getGeminiClient();
  const model = getGeminiModel();
  const prompt = buildResearchPrompt(input);

  let response;

  try {
    response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: researchResponseSchema,
        temperature: 0.2
      }
    });
  } catch (error) {
    throw new HttpError(502, "Gemini research request failed", {
      provider: "GEMINI",
      model,
      errorMessage: error instanceof Error ? error.message : "Unknown Gemini error"
    });
  }

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new HttpError(502, "Gemini returned an empty research response", {
      provider: "GEMINI",
      model
    });
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, "Gemini returned invalid JSON", {
      provider: "GEMINI",
      model
    });
  }

  const parsedResearch = researchBriefSchema.safeParse(parsedJson);

  if (!parsedResearch.success) {
    throw new HttpError(502, "Gemini research response did not match the required schema", {
      provider: "GEMINI",
      model,
      validationErrors: parsedResearch.error.flatten()
    });
  }

  return {
    research: parsedResearch.data,
    model,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: response.usageMetadata?.totalTokenCount ?? null
    }
  };
};
