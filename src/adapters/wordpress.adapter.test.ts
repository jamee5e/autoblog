import { beforeEach, describe, expect, it, vi } from "vitest";
import { wordpressAdapter } from "./wordpress.adapter";

const { createSystemLogMock, getWebsiteWordPressCredentialsMock } = vi.hoisted(() => ({
  createSystemLogMock: vi.fn(),
  getWebsiteWordPressCredentialsMock: vi.fn()
}));

vi.mock("../services/system-log.service", () => ({
  createSystemLog: createSystemLogMock
}));

vi.mock("../services/website.service", () => ({
  getWebsiteWordPressCredentials: getWebsiteWordPressCredentialsMock
}));

describe("wordpress adapter error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebsiteWordPressCredentialsMock.mockResolvedValue({
      website: { name: "Site A" },
      apiBaseUrl: "https://example.com/wp-json/wp/v2",
      username: "wp-user",
      applicationPassword: "top-secret-password"
    });
  });

  it("passes test connection when wordpress responds with user profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, name: "WP User" })
      })
    );

    await expect(wordpressAdapter.testConnection("website-1")).resolves.toEqual({
      website: "Site A"
    });
  });

  it("returns safe error and logs details for incorrect wordpress credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: "rest_forbidden" }),
        text: async () => "forbidden"
      })
    );

    await expect(wordpressAdapter.testConnection("website-1")).rejects.toThrow("Unable to connect to WordPress");
    expect(createSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "wordpress",
        message: "WordPress authentication failed"
      })
    );
  });

  it("handles wordpress url unavailable during connection test", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(wordpressAdapter.testConnection("website-1")).rejects.toThrow("Unable to connect to WordPress");
    expect(createSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "wordpress",
        message: "Unexpected WordPress adapter error"
      })
    );
  });

  it("handles connection timeout safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    await expect(wordpressAdapter.testConnection("website-1")).rejects.toThrow("Unable to connect to WordPress");
    expect(createSystemLogMock).toHaveBeenCalled();
  });

  it("creates draft successfully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 101, status: "draft", link: "https://example.com/?p=101" })
      })
    );

    await expect(
      wordpressAdapter.createDraft("website-1", {
        title: "KSD Auto Blog Integration Test",
        slug: "ksd-auto-blog-integration-test",
        excerpt: "Test post created by KSD Auto Blog Platform.",
        content: "<p>This is a WordPress integration test from the KSD Auto Blog Platform.</p>"
      })
    ).resolves.toEqual({
      wordpressPostId: 101,
      wordpressUrl: "https://example.com/?p=101",
      status: "draft"
    });
  });

  it("returns safe error when draft creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "server down" }),
        text: async () => "server down"
      })
    );

    await expect(
      wordpressAdapter.createDraft("website-1", {
        title: "KSD Auto Blog Integration Test",
        slug: "ksd-auto-blog-integration-test",
        excerpt: "Test post created by KSD Auto Blog Platform.",
        content: "<p>This is a WordPress integration test from the KSD Auto Blog Platform.</p>"
      })
    ).rejects.toThrow("Unable to create draft on WordPress");
    expect(createSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "wordpress"
      })
    );
  });

  it("handles malformed wordpress response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ postId: "not-a-number", state: "draft" })
      })
    );

    await expect(
      wordpressAdapter.createDraft("website-1", {
        title: "KSD Auto Blog Integration Test",
        slug: "ksd-auto-blog-integration-test",
        excerpt: "Test post created by KSD Auto Blog Platform.",
        content: "<p>This is a WordPress integration test from the KSD Auto Blog Platform.</p>"
      })
    ).rejects.toThrow("Unable to create draft on WordPress");
    expect(createSystemLogMock).toHaveBeenCalled();
  });
});
