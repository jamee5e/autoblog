export interface QualityPromptInput {
  websiteName: string;
  topic: string;
  primaryKeyword: string;
  researchData: unknown;
  title: string;
  excerpt?: string | null;
  content: string;
  language?: string;
  brandContext?: {
    tone?: string;
    targetAudience?: string;
    brandPrompt?: string;
    seoRules?: unknown;
    prohibitedTerms?: unknown;
  };
}

const asJson = (value: unknown): string =>
  value === undefined || value === null ? "Not provided" : JSON.stringify(value);

export const buildQualityPrompt = (input: QualityPromptInput): string => {
  const brand = input.brandContext;

  return [
    "You are the SEO & Quality Agent in a travel content publishing workflow.",
    "Review the article against the supplied research brief and brand rules.",
    "Do not browse or invent facts. Evaluate factual consistency only against the supplied research.",
    "",
    "Decision rules:",
    "- PASS only when seoScore >= 75, qualityScore >= 80, and there are no HIGH severity issues.",
    "- Otherwise return REVISION_REQUIRED.",
    "- Keep revision instructions specific, actionable, and limited to what the Writer Agent should change.",
    "- Do not request changes merely for stylistic preference when the content is already clear and useful.",
    "",
    "Review criteria:",
    "- Search intent alignment and topic coverage.",
    "- Natural use of the primary keyword in title, introduction, and relevant headings without stuffing.",
    "- Helpful structure, readability, clarity, and paragraph length.",
    "- Consistency with the research brief; flag unsupported or contradictory claims.",
    "- Brand tone, target audience, prohibited terms, and SEO rules.",
    "- Title usefulness and click clarity.",
    "- Create a concise meta description of roughly 120-160 characters suitable for search results.",
    "",
    `Website: ${input.websiteName}`,
    `Language: ${input.language?.trim() || "English"}`,
    `Topic: ${input.topic}`,
    `Primary keyword: ${input.primaryKeyword}`,
    "",
    "Brand context:",
    `- Tone: ${brand?.tone || "Not provided"}`,
    `- Target audience: ${brand?.targetAudience || "Not provided"}`,
    `- Brand guidance: ${brand?.brandPrompt || "Not provided"}`,
    `- SEO rules: ${asJson(brand?.seoRules)}`,
    `- Prohibited terms: ${asJson(brand?.prohibitedTerms)}`,
    "",
    "Research brief:",
    JSON.stringify(input.researchData),
    "",
    "Article:",
    `Title: ${input.title}`,
    `Excerpt: ${input.excerpt || "Not provided"}`,
    "Content HTML:",
    input.content,
    "",
    "Return only the requested structured quality review."
  ].join("\n");
};
