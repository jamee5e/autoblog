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

export type QualityDecision = "PASS" | "REVISION_REQUIRED";

export interface QualityIssue {
  category: "SEO" | "FACTUAL" | "READABILITY" | "BRAND" | "STRUCTURE" | "OTHER";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  suggestion: string;
}

export interface QualityReview {
  decision: QualityDecision;
  seoScore: number;
  qualityScore: number;
  metaDescription: string;
  summary: string;
  issues: QualityIssue[];
  revisionInstructions: string[];
}

export interface OrchestrationResponse {
  articleId: string;
  status: string;
  decision: QualityDecision;
  revisionCount: number;
  maxRevisions: number;
  research: {
    model: string;
    usage: ResearchUsage;
  };
  writer: {
    model: string;
    usage: ResearchUsage;
  };
  quality: {
    model: string;
    usage: ResearchUsage;
    review: QualityReview;
  };
}

export type ScheduledJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type ScheduledJobAction =
  | "GENERATE_ONLY"
  | "GENERATE_AND_DRAFT";

export interface ScheduledJob {
  id: string;
  websiteId: string;
  topic: string;
  primaryKeyword: string;
  additionalInstructions: string | null;
  scheduledAt: string;
  timezone: string;
  action: ScheduledJobAction;
  status: ScheduledJobStatus;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  website: {
    name: string;
  };
  article: {
    id: string;
    status: string;
    title: string | null;
    wordpressPostId: string | null;
    wordpressUrl: string | null;
  } | null;
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
  qualityData: QualityReview | null;
  qualityScore: number | null;
  revisionCount: number;
  website: string;
  researchRun: {
    model: string;
    status: string;
    inputTokens: number | null;
    outputTokens: number | null;
    completedAt: string | null;
  } | null;
  writerRun: {
    model: string;
    status: string;
    inputTokens: number | null;
    outputTokens: number | null;
    completedAt: string | null;
  } | null;
  qualityRun: {
    model: string;
    status: string;
    inputTokens: number | null;
    outputTokens: number | null;
    completedAt: string | null;
  } | null;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  metaDescription: string | null;
  seoScore: number | null;
  content: string | null;
  status: string;
  wordpressPostId: string | null;
  wordpressUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  createdAt: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  module: string;
  message: string;
  metadata: Record<string, unknown> | null;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T[];
}

export interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}
