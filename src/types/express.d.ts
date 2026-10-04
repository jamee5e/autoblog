import { AuthenticatedUser } from "../auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};
