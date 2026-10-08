export interface ResearchPromptInput {
  websiteName: string;
  wordpressUrl: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions?: string;
  language?: string;
  brandContext?: {
    tone?: string;
    targetAudience?: string;
    brandPrompt?: string;
    seoRules?: unknown;
    prohibitedTerms?: unknown;
  };
}

const formatOptionalJson = (value: unknown): string => {
  if (value === undefined || value === null) return "Not provided";
  return JSON.stringify(value);
};

export const buildResearchPrompt = (input: ResearchPromptInput): string => {
  const language = input.language?.trim() || "English";
  const instructions = input.additionalInstructions?.trim() || "None";
  const brand = input.brandContext;

  return [
    "You are a senior travel content research analyst.",
    "Prepare a factual research brief that will be handed to a separate writer agent.",
    "",
    "Research principles:",
    "- Focus on useful information that directly supports the requested topic and search intent.",
    "- Do not invent prices, schedules, policies, statistics, wildlife sightings, guarantees, or operational details.",
    "- If a fact may change over time or cannot be safely assumed, mark it as needing verification.",
    "- Separate factual research from writing recommendations.",
    "- Avoid promotional exaggeration and unsupported superlatives.",
    "- Keep recommendations specific enough for a writer to build a useful article.",
    "",
    "Website:",
    `- Name: ${input.websiteName}`,
    `- URL: ${input.wordpressUrl}`,
    `- Output language: ${language}`,
    "",
    "Content brief:",
    `- Topic: ${input.topic}`,
    `- Primary keyword: ${input.primaryKeyword}`,
    `- Additional instructions: ${instructions}`,
    "",
    "Brand context:",
    `- Tone: ${brand?.tone || "Not provided"}`,
    `- Target audience: ${brand?.targetAudience || "Not provided"}`,
    `- Brand guidance: ${brand?.brandPrompt || "Not provided"}`,
    `- SEO rules: ${formatOptionalJson(brand?.seoRules)}`,
    `- Prohibited terms: ${formatOptionalJson(brand?.prohibitedTerms)}`,
    "",
    "Return only the requested structured research brief."
  ].join("\n");
};
