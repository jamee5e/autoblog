import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { HttpError } from "../errors/http.error";

let geminiClient: GoogleGenAI | null = null;

export const getGeminiClient = (): GoogleGenAI => {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(503, "Gemini API is not configured");
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY
    });
  }

  return geminiClient;
};

export const getGeminiModel = (): string => env.GEMINI_MODEL;
