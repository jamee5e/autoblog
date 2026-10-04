import { SystemLogLevel } from "@prisma/client";
import { z } from "zod";
import { createSystemLog } from "../services/system-log.service";
import { getWebsiteWordPressCredentials } from "../services/website.service";
import { HttpError } from "../errors/http.error";

export interface WordPressArticleInput {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
}

export interface UploadMediaInput {
  filename: string;
  contentType: string;
  data: Buffer;
}

const buildAuthHeader = (username: string, applicationPassword: string): string => {
  const token = Buffer.from(`${username}:${applicationPassword}`, "utf8").toString("base64");
  return `Basic ${token}`;
};

const toSafeErrorMessage = (status: number): string => {
  if (status === 401 || status === 403) {
    return "WordPress authentication failed";
  }

  if (status >= 500) {
    return "WordPress service is unavailable";
  }

  return "WordPress request failed";
};

const toErrorMetadata = async (error: unknown, context: Record<string, unknown>): Promise<void> => {
  if (error instanceof HttpError) {
    await createSystemLog({
      module: "wordpress",
      level: SystemLogLevel.ERROR,
      message: error.message,
      metadata: {
        ...context,
        details: error.details
      }
    });
    return;
  }

  await createSystemLog({
    module: "wordpress",
    level: SystemLogLevel.ERROR,
    message: "Unexpected WordPress adapter error",
    metadata: {
      ...context,
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    }
  });
};

const requestWordPress = async <T>(params: {
  websiteId: string;
  endpoint: string;
  method?: "GET" | "POST";
  body?: unknown;
  customHeaders?: Record<string, string>;
}): Promise<T> => {
  const credentials = await getWebsiteWordPressCredentials(params.websiteId);
  const authHeader = buildAuthHeader(credentials.username, credentials.applicationPassword);
  const url = `${credentials.apiBaseUrl}${params.endpoint}`;

  const response = await fetch(url, {
    method: params.method ?? "GET",
    headers: {
      Authorization: authHeader,
      ...(params.customHeaders ?? {}),
      ...(params.body ? { "Content-Type": "application/json" } : {})
    },
    body: params.body ? JSON.stringify(params.body) : undefined
  });

  if (!response.ok) {
    let errorPayload: unknown;

    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = await response.text();
    }

    throw new HttpError(502, toSafeErrorMessage(response.status), {
      httpStatus: response.status,
      endpoint: params.endpoint,
      response: errorPayload
    });
  }

  return (await response.json()) as T;
};

const usersMeSchema = z.object({
  id: z.number()
});

const draftResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
  link: z.string().nullable().optional()
});

export const wordpressAdapter = {
  async testConnection(websiteId: string): Promise<{ website: string }> {
    const context = { action: "testConnection", websiteId };

    try {
      const credentials = await getWebsiteWordPressCredentials(websiteId);
      const usersMe = await requestWordPress({
        websiteId,
        endpoint: "/users/me"
      });
      usersMeSchema.parse(usersMe);

      return { website: credentials.website.name };
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to connect to WordPress");
    }
  },

  async createDraft(websiteId: string, article: WordPressArticleInput): Promise<{
    wordpressPostId: number;
    wordpressUrl: string | null;
    status: string;
  }> {
    const context = { action: "createDraft", websiteId };

    try {
      const createdResponse = await requestWordPress({
        websiteId,
        endpoint: "/posts",
        method: "POST",
        body: {
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          slug: article.slug,
          status: "draft"
        }
      });
      const created = draftResponseSchema.parse(createdResponse);

      return {
        wordpressPostId: created.id,
        wordpressUrl: created.link ?? null,
        status: created.status
      };
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to create draft on WordPress");
    }
  },

  async updatePost(websiteId: string, wordpressPostId: string, article: WordPressArticleInput): Promise<void> {
    const context = { action: "updatePost", websiteId, wordpressPostId };

    try {
      await requestWordPress({
        websiteId,
        endpoint: `/posts/${wordpressPostId}`,
        method: "POST",
        body: {
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          slug: article.slug
        }
      });
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to update WordPress post");
    }
  },

  async publishPost(websiteId: string, wordpressPostId: string): Promise<void> {
    const context = { action: "publishPost", websiteId, wordpressPostId };

    try {
      await requestWordPress({
        websiteId,
        endpoint: `/posts/${wordpressPostId}`,
        method: "POST",
        body: {
          status: "publish"
        }
      });
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to publish WordPress post");
    }
  },

  async uploadMedia(websiteId: string, file: UploadMediaInput): Promise<{ id: number; sourceUrl?: string }> {
    const context = { action: "uploadMedia", websiteId, filename: file.filename, contentType: file.contentType };

    try {
      const credentials = await getWebsiteWordPressCredentials(websiteId);
      const authHeader = buildAuthHeader(credentials.username, credentials.applicationPassword);
      const url = `${credentials.apiBaseUrl}/media`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Content-Type": file.contentType
        },
        body: file.data
      });

      if (!response.ok) {
        let errorPayload: unknown;

        try {
          errorPayload = await response.json();
        } catch {
          errorPayload = await response.text();
        }

        throw new HttpError(502, toSafeErrorMessage(response.status), {
          httpStatus: response.status,
          endpoint: "/media",
          response: errorPayload
        });
      }

      const payload = (await response.json()) as { id: number; source_url?: string };
      return { id: payload.id, sourceUrl: payload.source_url };
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to upload media to WordPress");
    }
  },

  async getCategories(websiteId: string): Promise<Array<{ id: number; name: string; slug: string }>> {
    const context = { action: "getCategories", websiteId };

    try {
      return await requestWordPress<Array<{ id: number; name: string; slug: string }>>({
        websiteId,
        endpoint: "/categories?per_page=100"
      });
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to fetch WordPress categories");
    }
  }
};
