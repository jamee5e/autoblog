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
  featuredMediaId?: number;
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

const readErrorPayload = async (response: Response): Promise<unknown> => {
  const bodyText = await response.text();

  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
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
    const errorPayload = await readErrorPayload(response);

    throw new HttpError(502, toSafeErrorMessage(response.status), {
      httpStatus: response.status,
      endpoint: params.endpoint,
      response: errorPayload
    });
  }

  return (await response.json()) as T;
};

const requestWordPressCollection = async <T>(params: {
  websiteId: string;
  endpoint: string;
}): Promise<{ data: T; totalPages: number; totalItems: number }> => {
  const credentials = await getWebsiteWordPressCredentials(params.websiteId);
  const authHeader = buildAuthHeader(
    credentials.username,
    credentials.applicationPassword
  );
  const url = `${credentials.apiBaseUrl}${params.endpoint}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader
    }
  });

  if (!response.ok) {
    const errorPayload = await readErrorPayload(response);

    throw new HttpError(502, toSafeErrorMessage(response.status), {
      httpStatus: response.status,
      endpoint: params.endpoint,
      response: errorPayload
    });
  }

  const totalPages = Math.max(
    1,
    Number.parseInt(response.headers.get("x-wp-totalpages") || "1", 10) || 1
  );

  const totalItems =
    Math.max(
      0,
      Number.parseInt(response.headers.get("x-wp-total") || "0", 10) || 0
    );

  return {
    data: (await response.json()) as T,
    totalPages,
    totalItems
  };
};

const usersMeSchema = z.object({
  id: z.number()
});

const draftResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
  link: z.string().nullable().optional()
});

const wordpressContentItemSchema = z.object({
  id: z.number(),
  link: z.string(),
  slug: z.string(),
  title: z.object({
    rendered: z.string()
  })
});

const wordpressContentListSchema = z.array(wordpressContentItemSchema);

const wordpressMediaItemSchema = z.object({
  id: z.number(),
  source_url: z.string().min(1),
  mime_type: z.string().nullable().optional(),
  media_type: z.string().nullable().optional(),
  title: z.object({
    rendered: z.string().default("")
  }),
  alt_text: z.string().nullable().optional().default(""),
  caption: z.object({
    rendered: z.string().default("")
  }).nullable().optional(),
  description: z.object({
    rendered: z.string().default("")
  }).nullable().optional(),
  media_details: z.object({
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional()
  }).passthrough().nullable().optional()
});

const wordpressMediaListSchema = z.array(wordpressMediaItemSchema);

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
          ...(article.featuredMediaId !== undefined
            ? { featured_media: article.featuredMediaId }
            : {}),
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
          slug: article.slug,
          ...(article.featuredMediaId !== undefined
            ? { featured_media: article.featuredMediaId }
            : {})
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
        const errorPayload = await readErrorPayload(response);

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

  async getMediaLibrary(websiteId: string): Promise<Array<{
    id: number;
    title: string;
    sourceUrl: string;
    altText: string;
    caption: string;
    description: string;
    mimeType: string | null;
    width: number | null;
    height: number | null;
  }>> {
    const context = { action: "getMediaLibrary", websiteId };

    try {
      const fields =
        "id,source_url,mime_type,media_type,title,alt_text,caption,description,media_details";
      const ordering = "orderby=id&order=asc";

      const probe = await requestWordPressCollection<unknown>({
        websiteId,
        endpoint: `/media?per_page=1&offset=0&${ordering}&_fields=id`
      });

      const totalItems = probe.totalItems;

      if (totalItems === 0) {
        return [];
      }

      const fetchBatch = async (
        offset: number,
        limit: number
      ): Promise<z.infer<typeof wordpressMediaItemSchema>[]> => {
        try {
          const response = await requestWordPressCollection<unknown>({
            websiteId,
            endpoint:
              `/media?per_page=${limit}&offset=${offset}&${ordering}&_fields=${fields}`
          });

          return wordpressMediaListSchema.parse(response.data);
        } catch (error) {
          const status =
            error instanceof HttpError &&
            error.details &&
            typeof error.details === "object" &&
            "httpStatus" in error.details
              ? Number((error.details as { httpStatus?: unknown }).httpStatus)
              : null;

          if (status !== null && status >= 500 && limit > 1) {
            const firstSize = Math.floor(limit / 2);
            const secondSize = limit - firstSize;

            const first = await fetchBatch(offset, firstSize);
            const second = await fetchBatch(offset + firstSize, secondSize);

            return [...first, ...second];
          }

          if (status !== null && status >= 500 && limit === 1) {
            await createSystemLog({
              module: "wordpress",
              level: SystemLogLevel.WARN,
              message: "Skipped one WordPress media item after repeated server error",
              metadata: {
                action: "getMediaLibrary",
                websiteId,
                offset,
                details:
                  error instanceof HttpError
                    ? error.details
                    : undefined
              }
            });

            return [];
          }

          throw error;
        }
      };

      const items: z.infer<typeof wordpressMediaItemSchema>[] = [];
      const batchSize = 100;

      for (let offset = 0; offset < totalItems; offset += batchSize) {
        const remaining = totalItems - offset;
        const limit = Math.min(batchSize, remaining);
        const batch = await fetchBatch(offset, limit);
        items.push(...batch);
      }

      return items
        .filter(
          (item) =>
            item.media_type === "image" ||
            item.mime_type?.toLowerCase().startsWith("image/")
        )
        .map((item) => ({
          id: item.id,
          title: item.title.rendered,
          sourceUrl: item.source_url,
          altText: item.alt_text || "",
          caption: item.caption?.rendered || "",
          description: item.description?.rendered || "",
          mimeType: item.mime_type || null,
          width: item.media_details?.width ?? null,
          height: item.media_details?.height ?? null
        }));
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to fetch WordPress media library");
    }
  },

  async getPublishedContent(websiteId: string): Promise<Array<{
    id: number;
    title: string;
    url: string;
    slug: string;
    type: "post" | "page";
  }>> {
    const context = { action: "getPublishedContent", websiteId };

    try {
      const fetchAll = async (type: "posts" | "pages") => {
        const first = await requestWordPressCollection<unknown>({
          websiteId,
          endpoint: `/${type}?status=publish&per_page=100&page=1&_fields=id,title,link,slug`
        });

        const items = wordpressContentListSchema.parse(first.data);

        for (let page = 2; page <= first.totalPages; page += 1) {
          const next = await requestWordPressCollection<unknown>({
            websiteId,
            endpoint: `/${type}?status=publish&per_page=100&page=${page}&_fields=id,title,link,slug`
          });

          items.push(...wordpressContentListSchema.parse(next.data));
        }

        return items;
      };

      const [posts, pages] = await Promise.all([
        fetchAll("posts"),
        fetchAll("pages")
      ]);

      return [
        ...posts.map((item) => ({
          id: item.id,
          title: item.title.rendered,
          url: item.link,
          slug: item.slug,
          type: "post" as const
        })),
        ...pages.map((item) => ({
          id: item.id,
          title: item.title.rendered,
          url: item.link,
          slug: item.slug,
          type: "page" as const
        }))
      ];
    } catch (error) {
      await toErrorMetadata(error, context);
      throw new HttpError(502, "Unable to fetch published WordPress content");
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
