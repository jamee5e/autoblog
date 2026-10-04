import crypto from "crypto";
import { env } from "../config/env";
import { HttpError } from "../errors/http.error";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const deriveKey = (rawKey: string): Buffer => {
  return crypto.createHash("sha256").update(rawKey, "utf8").digest();
};

export const encryptSecret = (value: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(env.ENCRYPTION_KEY);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptSecret = (encryptedValue: string): string => {
  const parts = encryptedValue.split(":");

  if (parts.length !== 3) {
    throw new HttpError(500, "Invalid encrypted secret format");
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const key = deriveKey(env.ENCRYPTION_KEY);
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};
