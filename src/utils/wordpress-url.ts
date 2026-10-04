import { HttpError } from "../errors/http.error";

const normalizePathname = (pathname: string): string => {
  if (!pathname || pathname === "/") {
    return "";
  }

  return pathname.replace(/\/+$/, "");
};

export const normalizeWordPressUrl = (input: string): string => {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new HttpError(400, "Invalid WordPress URL");
  }

  if (parsed.protocol !== "https:") {
    throw new HttpError(400, "WordPress URL must use https");
  }

  if (!parsed.hostname) {
    throw new HttpError(400, "Invalid WordPress URL");
  }

  if (parsed.search || parsed.hash) {
    throw new HttpError(400, "WordPress URL must not include query string or hash");
  }

  const normalizedPath = normalizePathname(parsed.pathname);
  return `${parsed.origin}${normalizedPath}`;
};

export const buildWordPressApiBaseUrl = (wordpressUrl: string): string => {
  const normalized = normalizeWordPressUrl(wordpressUrl);
  return `${normalized}/wp-json/wp/v2`;
};
