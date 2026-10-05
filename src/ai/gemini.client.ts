import { env } from "../config/env";
import { HttpError } from "../errors/http.error";

export const getGeminiClient = async () => {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(503, "Gemini API is not configured");
  }

  const { GoogleGenAI } = await import("@google/genai");

  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY
  });
};

export const getGeminiModel = (): string => env.GEMINI_MODEL;
