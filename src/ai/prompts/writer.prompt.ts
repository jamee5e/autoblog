export interface WriterPromptInput {
  websiteName: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions?: string | null;
  contentFormat?: "AUTO" | "LIST_GUIDE" | "DESTINATION_GUIDE" | "COMPARISON" | "PLANNING_GUIDE";
  targetWordMin?: number;
  targetWordMax?: number;
  suggestedSections?: number | null;
  researchData: unknown;
  currentDraft?: {
    title: string;
    slug?: string | null;
    excerpt?: string | null;
    content: string;
  };
  revisionInstructions?: string[];
  allowedInternalLinks?: Array<{
    title: string;
    url: string;
    contentType?: string | null;
    targetKeywords: string[];
    anchorSuggestions: string[];
  }>;
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

const buildFormatRules = (
  format: WriterPromptInput["contentFormat"],
  suggestedSections?: number | null
): string[] => {
  const sectionTarget = suggestedSections
    ? `Aim for about ${suggestedSections} main H2 sections when the topic supports it.`
    : "Use only as many H2 sections as the topic genuinely needs.";

  switch (format) {
    case "LIST_GUIDE":
      return [
        "- Format this as a practical list guide.",
        "- After a short 1-2 paragraph introduction, use numbered H2 headings such as '1. Phi Phi Islands', '2. Phang Nga Bay', etc.",
        `- ${sectionTarget}`,
        "- Each numbered section should explain why the item matters, what kind of experience it offers, and who it may suit.",
        "- Avoid filler between list items and do not force a generic conclusion."
      ];
    case "DESTINATION_GUIDE":
      return [
        "- Format this as a destination guide.",
        "- After a short 1-2 paragraph introduction, give each destination or area its own clear H2 heading.",
        `- ${sectionTarget}`,
        "- Explain the character of each place, why travelers may choose it, and the kind of experience to expect.",
        "- Add a final decision-help section such as 'Which destination should you choose?' only when it genuinely helps."
      ];
    case "COMPARISON":
      return [
        "- Format this as a comparison guide that helps the reader make a decision.",
        "- Open with the decision the traveler is trying to make, then compare the options with clear H2 headings.",
        `- ${sectionTarget}`,
        "- Compare practical differences, best-fit traveler types, atmosphere, and experience without inventing rankings or unsupported claims.",
        "- End with a concise 'Which option is right for you?' style decision section when useful."
      ];
    case "PLANNING_GUIDE":
      return [
        "- Format this as a practical trip-planning guide.",
        "- Use a short introduction followed by clear planning H2 sections in a logical sequence.",
        `- ${sectionTarget}`,
        "- Prioritize actionable help such as choosing areas, activities, timing, preparation, and booking considerations supported by the research.",
        "- Use bullets or short checklists where they improve scanning. Do not invent exact schedules, prices, or availability."
      ];
    case "AUTO":
    default:
      return [
        "- Choose the most natural travel-guide structure for the search intent.",
        "- Prefer a list guide for 'best/things to do/top' topics, a destination guide for places/areas, a comparison for X-vs-Y topics, and a planning guide for itinerary/how-to topics.",
        "- Use a short 1-2 paragraph introduction and clear descriptive H2 headings.",
        `- ${sectionTarget}`
      ];
  }
};

export const buildWriterPrompt = (input: WriterPromptInput): string => {
  const language = input.language?.trim() || "English";
  const instructions = input.additionalInstructions?.trim() || "None";
  const brand = input.brandContext;
  const isRevision = Boolean(input.currentDraft);
  const revisionInstructions = input.revisionInstructions?.length
    ? input.revisionInstructions
    : [];
  const allowedInternalLinks = input.allowedInternalLinks ?? [];
  const contentFormat = input.contentFormat ?? "AUTO";
  const targetWordMin = input.targetWordMin ?? 700;
  const targetWordMax = input.targetWordMax ?? 1000;
  const formatRules = buildFormatRules(contentFormat, input.suggestedSections);

  return [
    "You are the Writer Agent for a travel content publishing workflow.",
    isRevision
      ? "Revise the existing article using the quality feedback while preserving strong content."
      : "Write a useful, trustworthy article using the supplied research brief.",
    "",
    "Writing rules:",
    "- Treat the research brief as the factual source for this draft.",
    "- Do not invent prices, schedules, policies, statistics, guarantees, or operational details.",
    "- Omit or carefully qualify facts marked as needing verification.",
    "- Use the primary keyword naturally. Do not keyword-stuff.",
    "- Write for humans first, with clear headings, short paragraphs, and useful detail.",
    `- Target roughly ${targetWordMin}-${targetWordMax} words. Useful coverage matters more than hitting an exact number.`,
    "- Keep paragraphs short and readable, usually 2-4 sentences.",
    "- Write like a helpful local travel guide, not a generic SEO article.",
    "- Avoid AI-sounding headings and filler such as 'Conclusion', 'Final Thoughts', 'Unlock the Magic of...', or repetitive promotional language.",
    "- Avoid overusing adjectives such as breathtaking, stunning, unforgettable, hidden gem, and must-visit.",
    "- Give readers practical decision-making information rather than repeating broad destination descriptions.",
    "- Match the supplied brand tone and target audience when available.",
    "- Follow prohibited-term rules when provided.",
    "- Return article body HTML only inside the content field. Do not return a full HTML document.",
    "- Allowed body structure should be simple editorial HTML such as h2, h3, p, ul, ol, li, strong, em, blockquote, and a.",
    "- Use 2-4 internal links only when they are genuinely relevant to the surrounding sentence.",
    "- Use only URLs from the Allowed internal links list below. Never invent, modify, shorten, or guess a URL.",
    "- If no allowed internal link is relevant, do not force one.",
    "- Use natural descriptive anchor text. Avoid generic anchors such as click here.",
    "- Do not include external links. This workflow manages only approved internal links.",
    "- Do not place the final call-to-action box inside the content HTML. Return it separately in finalCta.",
    "- When at least one Allowed internal link is genuinely relevant, set finalCta.enabled=true and choose exactly one URL from that list.",
    "- The final CTA appears after the article body. Write a short helpful heading, one concise supporting sentence, and a clear button label.",
    "- Never invent or modify the finalCta URL. Copy it exactly from the Allowed internal links list.",
    "- Prefer a commercial or destination landing page that closely matches the article over the home or about page.",
    "- If there is no relevant allowed link, set finalCta.enabled=false and return empty strings for heading, description, buttonText, and url.",
    "- Do not include script, style, iframe, form, object, embed, or event-handler attributes.",
    "",
    "Content format rules:",
    `- Selected format: ${contentFormat}`,
    ...formatRules,
    "",
    "Website:"
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
    "Allowed internal links:",
    allowedInternalLinks.length > 0
      ? JSON.stringify(allowedInternalLinks)
      : "None available. Do not add internal links.",
    "",
    ...(isRevision
      ? [
          "Existing draft:",
          JSON.stringify(input.currentDraft),
          "",
          "Required revision instructions:",
          JSON.stringify(revisionInstructions),
          "",
          "Revision rules:",
          "- Address every revision instruction that is relevant and supported by the research.",
          "- Do not introduce new unsupported facts while revising.",
          "- Preserve useful sections that do not need changes.",
          "- Keep or improve the final CTA using the same approved-link rules. The CTA is separate from content HTML.",
          ""
        ]
      : []),
    "Return only the requested structured article draft, including finalCta."
  ].join("\n");
};
