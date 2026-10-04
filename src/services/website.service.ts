import { Website } from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../errors/http.error";
import { decryptSecret } from "../utils/encryption";
import { buildWordPressApiBaseUrl } from "../utils/wordpress-url";

export const findWebsiteById = async (websiteId: string): Promise<Website> => {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });

  if (!website) {
    throw new HttpError(404, "Website not found");
  }

  return website;
};

export const getWebsiteWordPressCredentials = async (websiteId: string): Promise<{
  website: Website;
  apiBaseUrl: string;
  username: string;
  applicationPassword: string;
}> => {
  const website = await findWebsiteById(websiteId);

  return {
    website,
    apiBaseUrl: buildWordPressApiBaseUrl(website.wordpressUrl),
    username: website.wordpressUsername,
    applicationPassword: decryptSecret(website.wordpressApplicationPasswordEncrypted)
  };
};
