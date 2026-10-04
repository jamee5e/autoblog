import { describe, expect, it } from "vitest";
import { buildWordPressApiBaseUrl, normalizeWordPressUrl } from "./wordpress-url";

describe("wordpress url utilities", () => {
  it("normalizes trailing slash", () => {
    expect(normalizeWordPressUrl("https://example.com/")).toBe("https://example.com");
  });

  it("builds wordpress api base url", () => {
    expect(buildWordPressApiBaseUrl("https://example.com/")).toBe("https://example.com/wp-json/wp/v2");
  });

  it("rejects non-https urls", () => {
    expect(() => normalizeWordPressUrl("http://example.com")).toThrow("WordPress URL must use https");
  });
});
