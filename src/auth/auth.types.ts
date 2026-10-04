import { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  companyId: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface JwtPayload {
  sub: string;
}
