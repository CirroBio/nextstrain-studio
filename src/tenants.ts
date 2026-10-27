import { APP_ID } from "./app/appInfo";
import { hasSignedInUser, isSignInReturn, signInReturnTenant } from "./auth";
import { TENANT_URL } from "./tenantUrl";

// tenants.json lists the Cirro tenants the log-in box suggests. It is edited on the host, never
// built in. The app asks each tenant for its client ID by callback URL, unless the entry gives
// one (a registration without discovery, such as an App Developer's own), so the user may also
// type the address of a Cirro the list doesn't name.

export type Tenant = { id: string; name: string; url: string; clientId?: string };

// The tenant the app opens in; cleared on log-out.
const TENANT_KEY = `${APP_ID}.tenant`;
// The tenant last chosen in the log-in box, which fills it next time. Kept after log-out.
const LAST_TENANT_KEY = `${APP_ID}.last-tenant`;
// Set when the user picks a tenant to log in to, so its page goes straight to sign-in.
const SIGN_IN_NOW_KEY = `${APP_ID}.sign-in-now`;
// Suggestions appear once this much is typed, so the box doesn't list every tenant to anyone.
export const SUGGEST_AFTER = 3;

export async function loadTenants(): Promise<Tenant[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}tenants.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load tenants.json (HTTP ${res.status}).`);
  const { tenants } = await res.json();
  if (!Array.isArray(tenants)) throw new Error("tenants.json has no tenants list.");
  for (const t of tenants) {
    if (!t.id || !t.url) throw new Error(`tenants.json entry ${JSON.stringify(t.id ?? t)} needs id and url.`);
    if (!TENANT_URL.test(t.url)) throw new Error(`tenants.json entry ${JSON.stringify(t.id)} has url ${t.url}; it must be an https address with no path.`);
  }
  return tenants.map((t: Tenant) => ({ ...t, url: t.url.replace(/\/$/, "") }));
}

const stored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const hostOf = (t: Tenant) => new URL(t.url).host;

// What the user typed, as a host when it is an address.
const bare = (text: string) => text.trim().toLowerCase().replace(/^https:\/\//, "").replace(/\/$/, "");

// A Cirro the list doesn't name, typed as its address; its id is its host.
function typedTenant(text: string): Tenant | null {
  const host = bare(text);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  return { id: host, name: host, url: `https://${host}` };
}

// A tenant by its id: a listed one, or one the user typed (whose id is its address).
const byId = (id: string | null, tenants: Tenant[]) => (id ? tenants.find((t) => t.id === id) ?? typedTenant(id) ?? undefined : undefined);

const names = (t: Tenant) => [t.id, t.name, hostOf(t)].map((n) => n.toLowerCase());

// The tenant the log-in box names: a listed one by name, id or address, or another Cirro's address.
export function tenantNamed(text: string, tenants: Tenant[]): Tenant | null {
  const q = bare(text);
  return tenants.find((t) => names(t).includes(q)) ?? typedTenant(q);
}

export function suggestTenants(text: string, tenants: Tenant[]): Tenant[] {
  const q = text.trim().toLowerCase();
  return q.length < SUGGEST_AFTER ? [] : tenants.filter((t) => names(t).some((n) => n.includes(q)));
}

export const lastTenant = (tenants: Tenant[]) => byId(stored(LAST_TENANT_KEY), tenants);

export type Start = { tenant: Tenant } | { signedOut: true };

// Where a page load starts. A link naming a listed tenant wins; a return from sign-in goes to the
// tenant this tab signed in to; someone still signed in goes back to their tenant. Public datasets
// and local files work either way.
export function startOf(tenants: Tenant[]): Start {
  const params = new URLSearchParams(window.location.search);
  const named = params.get("tenant");
  // A typed tenant opens only by the user's own choice, so a link can't send them to a look-alike host.
  const fromUrl = named ? tenants.find((t) => t.id === named) ?? (named === stored(TENANT_KEY) ? typedTenant(named) : null) : null;
  if (fromUrl) {
    localStorage.setItem(TENANT_KEY, fromUrl.id);
    return { tenant: fromUrl };
  }
  const returning = byId(signInReturnTenant(), tenants);
  if (returning) return { tenant: returning };
  const remembered = byId(stored(TENANT_KEY), tenants);
  if (remembered && (isSignInReturn(params) || hasSignedInUser(remembered.url))) return { tenant: remembered };
  return { signedOut: true };
}

export function takeSignInNow(): boolean {
  const now = window.sessionStorage.getItem(SIGN_IN_NOW_KEY) !== null;
  window.sessionStorage.removeItem(SIGN_IN_NOW_KEY);
  return now;
}

// The current page's address with the given parameters set; `keep` keeps the page the user is on.
const appUrl = (params: Record<string, string> = {}, keep = false) => {
  const url = new URL(keep ? window.location.href : window.location.pathname, window.location.href);
  url.hash = "";
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
};

// Sign-in and the API client are created once per page load, for one tenant.
export function chooseTenant(t: Tenant) {
  localStorage.setItem(TENANT_KEY, t.id);
  localStorage.setItem(LAST_TENANT_KEY, t.id);
  window.sessionStorage.setItem(SIGN_IN_NOW_KEY, "1");
  window.location.assign(appUrl({ tenant: t.id }, true));
}

export function leaveTenant() {
  localStorage.removeItem(TENANT_KEY);
  window.location.assign(appUrl());
}

export const landingUrl = () => appUrl();
