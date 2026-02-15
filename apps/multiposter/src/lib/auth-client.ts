import { createAuthClient } from "@ac/auth/client";

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : "http://localhost:5173",
});