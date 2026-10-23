import {
  ArticleStatus,
  SystemLogLevel
} from "@prisma/client";
import { wordpressAdapter } from "../adapters/wordpress.adapter";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { createSystemLog } from "./system-log.service";

const getArticleForPublication = async (companyId: string, articleId: string) => {
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      website: {
        companyId
      }
    },
    include: {
      website: true
    }
  });

  if (!article) {
    throw new HttpError(404, "Article not found");
  }

  if (!article.title || !article.content) {
    throw new HttpError(409, "Article content is incomplete");
  }

  return article;
};

const toWordPressArticleInput = (article: {
  title: string | null;
  content: string | null;
  excerpt: string | null;
  slug: string | null;
}) => {
  if (!article.title || !article.content) {
    throw new HttpError(409, "Article content is incomplete");
  }

  return {
    title: article.title,
    content: article.content,
    excerpt: article.excerpt ?? undefined,
    slug: article.slug ?? undefined
  };
};

export const saveArticleToWordPressDraft = async (input: {
  companyId: string;
  articleId: string;
}) => {
  const article = await getArticleForPublication(input.companyId, input.articleId);

  if (article.status !== ArticleStatus.READY) {
    throw new HttpError(409, "Article must be READY before creating a WordPress draft");
  }

  const payload = toWordPressArticleInput(article);

  if (article.wordpressPostId) {
    await wordpressAdapter.updatePost(
      article.websiteId,
      article.wordpressPostId,
      payload
    );

    await createSystemLog({
      module: "wordpress-publish",
      level: SystemLogLevel.INFO,
      message: "WordPress draft updated",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        wordpressPostId: article.wordpressPostId
      }
    });

    return {
      articleId: article.id,
      wordpressPostId: article.wordpressPostId,
      wordpressUrl: article.wordpressUrl,
      status: "draft",
      action: "updated"
    };
  }

  const draft = await wordpressAdapter.createDraft(article.websiteId, payload);

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      wordpressPostId: String(draft.wordpressPostId),
      wordpressUrl: draft.wordpressUrl
    }
  });

  await createSystemLog({
    module: "wordpress-publish",
    level: SystemLogLevel.INFO,
    message: "WordPress draft created",
    metadata: {
      articleId: article.id,
      websiteId: article.websiteId,
      wordpressPostId: draft.wordpressPostId
    }
  });

  return {
    articleId: article.id,
    wordpressPostId: updated.wordpressPostId,
    wordpressUrl: updated.wordpressUrl,
    status: draft.status,
    action: "created"
  };
};

export const publishArticleToWordPress = async (input: {
  companyId: string;
  articleId: string;
}) => {
  const article = await getArticleForPublication(input.companyId, input.articleId);

  if (article.status !== ArticleStatus.READY) {
    throw new HttpError(409, "Article must be READY before publishing");
  }

  if (!article.wordpressPostId) {
    throw new HttpError(409, "Create a WordPress draft before publishing");
  }

  await prisma.article.update({
    where: { id: article.id },
    data: { status: ArticleStatus.PUBLISHING }
  });

  try {
    await wordpressAdapter.updatePost(
      article.websiteId,
      article.wordpressPostId,
      toWordPressArticleInput(article)
    );

    await wordpressAdapter.publishPost(
      article.websiteId,
      article.wordpressPostId
    );

    const publishedAt = new Date();

    const updated = await prisma.article.update({
      where: { id: article.id },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt
      }
    });

    await createSystemLog({
      module: "wordpress-publish",
      level: SystemLogLevel.INFO,
      message: "Article published to WordPress",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        wordpressPostId: article.wordpressPostId,
        publishedAt
      }
    });

    return {
      articleId: updated.id,
      status: updated.status,
      wordpressPostId: updated.wordpressPostId,
      wordpressUrl: updated.wordpressUrl,
      publishedAt: updated.publishedAt
    };
  } catch (error) {
    await prisma.article.update({
      where: { id: article.id },
      data: { status: ArticleStatus.READY }
    });

    await createSystemLog({
      module: "wordpress-publish",
      level: SystemLogLevel.ERROR,
      message: "WordPress publish failed",
      metadata: {
        articleId: article.id,
        websiteId: article.websiteId,
        wordpressPostId: article.wordpressPostId,
        details: error instanceof HttpError ? error.details : undefined
      }
    });

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(502, "Unable to publish article to WordPress");
  }
};
