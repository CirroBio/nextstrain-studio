import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ApiError, FileService, type DataService } from "@cirrobio/sdk";
import type { Tenant } from "../tenants";

export type Session = {
  data: DataService;
  username: string;
  // How the user is named in notes the app writes: their email where the ID token has it.
  displayName: string;
  tenantName: string;
  signOut: () => Promise<void>;
};

export type Cirro = Session & { tenant: Tenant; files: FileService };

const CirroContext = createContext<Cirro | null>(null);

export function CirroProvider({ tenant, session, children }: { tenant: Tenant; session: Session; children: ReactNode }) {
  const value = useMemo<Cirro>(() => ({ ...session, tenant, files: new FileService(session.data.file) }), [tenant, session]);
  return <CirroContext.Provider value={value}>{children}</CirroContext.Provider>;
}

export function useSignedIn(): Cirro {
  const c = useContext(CirroContext);
  if (!c) throw new Error("This page needs a Cirro sign-in.");
  return c;
}

const RATE_LIMIT_WAITS_MS = [2000, 5000, 10000];
const isRateLimited = (e: unknown) => e instanceof ApiError && e.errorCode === 429;

// Retries a call Cirro answered with 429. The file-credential endpoint is rate-limited per user,
// and several apps signed in as one person share it.
export async function retryRateLimited<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRateLimited(e) || attempt >= RATE_LIMIT_WAITS_MS.length) throw e;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAITS_MS[attempt]));
    }
  }
}

// The permission a refusal names: "Not allowed to RUN_ANALYSIS on project ...".
export const refusedPermission = (e: unknown): string | null =>
  e instanceof ApiError && e.errorCode === 403 ? /Not allowed to ([A-Z_]+)/.exec([e.message, ...e.errors].join(" "))?.[1] ?? null : null;

export const needsPermission = (perm: string) =>
  `This needs the ${perm} permission, which your role in this project or this app's registration doesn't grant. A project owner can change your role, or a Cirro admin can grant the app the permission.`;

// Plain words for an API failure; a refusal names who can fix it.
export function describeError(e: unknown, action?: string): string {
  if (e instanceof ApiError) {
    if (e.errorCode === 401) return "Your Cirro session has expired. Log in again.";
    if (isRateLimited(e)) return "Cirro is limiting how fast this account can make requests. Wait a minute and try again.";
    if (e.errorCode === 403) {
      const perm = refusedPermission(e);
      return perm ? needsPermission(perm) : `You don't have permission to ${action ?? "do this"} in this project. (${e.message})`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
