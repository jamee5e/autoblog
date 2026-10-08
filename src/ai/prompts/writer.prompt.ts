export interface WriterPromptInput {
  websiteName: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions?: string | null;
  researchData: unknown;
  language?: string;
  brandContext?: {
    tone?: string;
    targetAudience?: string;
    brandPrompt?: string;
    seoRules?: unknown;
    prohibitedTerms?: unknown;
    defaultCta?: string | null;
  };
}

const formatOptionalJson = (value: unknown): string => {
  if (value === undefined || value === null) return "Not provided";
  return JSON.stringify(value);
};

export const buildWriterPrompt = (input: WriterPromptInput): string => {
  const language = input.language?.trim() || "English";
  const instructions = input.additionalInstructions?.trim() || "None";
  const brand = input.brandContext;

  return [
    "You are the Writer Agent for a travel content publishing workflow.",
    "Write a useful, trustworthy article using the supplied research brief.",
    "",
    "Writing rules:",
    "- Treat the research brief as the factual source for this draft.",
    "- Do not invent prices, schedules, policies, statistics, guarantees, or operational details.",
    "- Omit or carefully qualify facts marked as needing verification.",
    "- Use the primary keyword naturally. Do not keyword-stuff.",
    "- Write for humans first, with clear headings, short paragraphs, and useful detail.",
    "- Target roughly 900-1,200 words for the pilot article unless the supplied instructions clearly require less.",
    "- Match the supplied brand tone and target audience when available.",
    "- Follow prohibited-term rules when provided.",
    "- Return article body HTML only inside the content field. Do not return a full HTML document.",
    "- Allowed body structure should be simple editorial HTML such as h2, h3, p, ul, ol, li, strong, em, and blockquote.",
    "- Do not include script, style, iframe, form, object, embed, or event-handler attributes.",
    "",
    "Website:",
    `- Name: ${input.websiteName}`,
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
    `- Default CTA: ${brand?.defaultCta || "Not provided"}`,
    "",
    "Research brief:",
    JSON.stringify(input.researchData),
    "",
    "Return only the requested structured article draft."
  ].join("\n");
};
