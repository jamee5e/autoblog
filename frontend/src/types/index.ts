export type UserRole = "ADMIN" | "EDITOR";

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Website {
  id: string;
  companyId: string;
  name: string;
  wordpressUrl: string;
  wordpressUsername: string;
  defaultAuthor: string | null;
  defaultCategory: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface ResearchFact {
  fact: string;
  confidence: "high" | "medium" | "low";
  verificationNeeded: boolean;
}

export interface ResearchSection {
  heading: string;
  purpose: string;
}

export interface ResearchBrief {
  searchIntent: string;
  targetAudience: string;
  contentAngle: string;
  keyQuestions: string[];
  keyFacts: ResearchFact[];
  recommendedSections: ResearchSection[];
  relatedKeywords: string[];
  entities: string[];
  notesForWriter: string[];
}

export interface ResearchUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface ResearchResponse {
  articleId: string;
  status: string;
  model: string;
  usage: ResearchUsage;
  research: ResearchBrief;
}

export interface ArticleSummary {
  id: string;
  topic: string;
  title: string | null;
  website: string;
  primaryKeyword: string;
  seoScore: number | null;
  status: string;
  createdAt: string;
}

export interface ArticlePreview {
  id: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions: string | null;
  researchData: ResearchBrief | null;
  website: string;
  researchRun: {
    model: string;
    status: string;
    inputTokens: number | null;
    outputTokens: number | null;
    completedAt: string | null;
  } | null;
  title: string | null;
  metaDescription: string | null;
  seoScore: number | null;
  content: string | null;
  status: string;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  createdAt: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  module: string;
  message: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
}

export interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}
