import request from "supertest";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("../config/database", () => ({
  prisma: prismaMock
}));

describe("authentication endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in successfully with valid credentials", async () => {
    const passwordHash = await bcrypt.hash("TopSecret123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      passwordHash
    });

    const { app } = await import("../app.js");
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "TopSecret123!"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe("admin@example.com");
  });

  it("fails login with wrong password", async () => {
    const passwordHash = await bcrypt.hash("TopSecret123!", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      companyId: "company-1",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      passwordHash
    });

    const { app } = await import("../app.js");
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@example.com",
      password: "wrong-password"
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("blocks protected route without token", async () => {
    const { app } = await import("../app.js");
    const response = await request(app).get("/api/websites");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Missing authorization token");
  });
});
