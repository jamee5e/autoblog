import { beforeEach, describe, expect, it, vi } from "vitest";
import { Request, Response } from "express";
import { createWebsite, getWebsiteById, listWebsites } from "./website.controller";
import { decryptSecret } from "../utils/encryption";
import { HttpError } from "../errors/http.error";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    website: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("../config/database", () => ({
  prisma: prismaMock
}));

const createResponseMock = (): Response => {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  } as unknown as Response;

  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);

  return response;
};

describe("website controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters website listing by authenticated user company", async () => {
    const response = createResponseMock();
    const request = {
      authUser: {
        id: "user-1",
        companyId: "company-1",
        role: "ADMIN",
        email: "admin@example.com",
        name: "Admin"
      }
    } as Request;

    prismaMock.website.findMany.mockResolvedValue([]);

    await listWebsites(request, response);

    expect(prismaMock.website.findMany).toHaveBeenCalledWith({
      where: { companyId: "company-1" },
      orderBy: { createdAt: "desc" }
    });
  });

  it("does not allow reading website from another company", async () => {
    const response = createResponseMock();
    const request = {
      params: { id: "website-1" },
      authUser: {
        id: "user-1",
        companyId: "company-1",
        role: "ADMIN",
        email: "admin@example.com",
        name: "Admin"
      }
    } as unknown as Request;

    prismaMock.website.findUnique.mockResolvedValue({
      id: "website-1",
      companyId: "company-2"
    });

    await expect(getWebsiteById(request, response)).rejects.toMatchObject({
      message: "Website not found"
    } satisfies Partial<HttpError>);
  });

  it("stores wordpress application password encrypted at rest", async () => {
    const response = createResponseMock();
    const request = {
      authUser: {
        id: "user-1",
        companyId: "company-1",
        role: "ADMIN",
        email: "admin@example.com",
        name: "Admin"
      },
      body: {
        companyId: "company-1",
        name: "Site A",
        wordpressUrl: "https://example.com/",
        wordpressUsername: "wp-user",
        wordpressApplicationPassword: "app-password-1234",
        defaultAuthor: "KSD",
        defaultCategory: "News"
      }
    } as Request;

    prismaMock.website.create.mockResolvedValue({
      id: "website-1",
      companyId: "company-1",
      name: "Site A",
      wordpressUrl: "https://example.com",
      wordpressUsername: "wp-user",
      defaultAuthor: "KSD",
      defaultCategory: "News",
      status: "ACTIVE",
      createdAt: new Date()
    });

    await createWebsite(request, response);

    const call = prismaMock.website.create.mock.calls[0][0];
    const encryptedValue = call.data.wordpressApplicationPasswordEncrypted as string;

    expect(encryptedValue).not.toBe("app-password-1234");
    expect(decryptSecret(encryptedValue)).toBe("app-password-1234");
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.not.objectContaining({
          wordpressApplicationPasswordEncrypted: expect.anything()
        })
      })
    );
  });
});
