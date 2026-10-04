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

export interface ArticleSummary {
  id: string;
  title: string | null;
  website: string;
  primaryKeyword: string;
  seoScore: number | null;
  status: string;
  createdAt: string;
}

export interface ArticlePreview {
  id: string;
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
