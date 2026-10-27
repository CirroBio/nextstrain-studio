import { UserManager, WebStorageStateStore, type OidcMetadata, type User } from "oidc-client-ts";
import { APP_ID } from "./app/appInfo";

// Sign-in goes through the tenant's Cirro authorize page, which names this app and the permissions
// it asks for, then hands off to the tenant's sign-in provider. Tokens come with PKCE (no client
// secret), and oidc-client-ts keeps them in USER_STORE.

// Web storage is shared by every page on an origin. At the root of a domain of its own the app keeps
// the sign-in in localStorage, so every tab shares it; under a path, such as
// cirrobio.github.io/virscan-studio/, other sites share the origin, so it stays in this tab.
const USER_STORE = import.meta.env.BASE_URL === "/" ? window.localStorage : window.sessionStorage;

// Sign-in returns here: origin plus the app's path, trailing slash included. The tenant finds the
// app's registration by it, and the registration must list it character for character: the end of
// a SAML (Microsoft) sign-in compares exactly.
export const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;

// Public Apps allow only the openid scope; asking for more fails with invalid_scope.
const SCOPE = "openid";

// clientId is set for a tenant whose registration isn't discoverable, such as a development
// registration; otherwise the tenant gives the client ID for this app's callback URL.
export async function createSignIn(tenantUrl: string, clientId: string | undefined): Promise<UserManager> {
  // Fetched here rather than through the library's metadataUrl: the document is served as
  // text/json, and oidc-client-ts refuses any Content-Type but application/json.
  const url = `${tenantUrl}/.well-known/oauth-authorization-server`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load sign-in settings: ${url} answered HTTP ${res.status}`);
  const metadata: Partial<OidcMetadata> = await res.json();
  return new UserManager({
    authority: tenantUrl,
    metadata,
    client_id: clientId || (await registeredClientId(metadata.registration_endpoint)),
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    // The ID token carries the username; skip the userinfo request.
    loadUserInfo: false,
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: USER_STORE }),
  });
}

// Asks the tenant for the client ID of the registration that lists this app's callback URL
// (dynamic client registration, RFC 7591). A tenant admin sets that registration up with discovery
// enabled; the app never ships a client ID for it.
async function registeredClientId(endpoint: string | undefined): Promise<string> {
  if (!endpoint) throw new Error("This Cirro doesn't offer app registration lookup, so tenants.json needs this app's client ID for it.");
  // A tenant whose lookup doesn't answer other sites fails here, before any status.
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  }).catch(() => {
    throw new Error(`This Cirro didn't answer the app's registration lookup from ${window.location.origin}, so ${REDIRECT_URI} may not be registered there yet. A Cirro admin registers it, with discovery enabled.`);
  });
  if (res.status === 401) throw new Error(`No app is registered in this Cirro for ${REDIRECT_URI}. A Cirro admin registers it, with discovery enabled.`);
  if (res.status === 409) throw new Error(`More than one app in this Cirro is registered for ${REDIRECT_URI}; each app needs its own callback URL.`);
  if (!res.ok) throw new Error(`Could not get this app's client ID: ${endpoint} answered HTTP ${res.status}`);
  return (await res.json()).client_id;
}

// Where the user was when they signed in, restored after the return.
type ReturnState = { returnTo: string };

// The tenant this tab is signing in to. The saved tenant choice is shared by every tab, so another
// tab can change it while this one is at Cirro's authorize page; the return must not follow it.
const SIGN_IN_TENANT_KEY = `${APP_ID}.sign-in-tenant`;

export async function startSignIn(signIn: UserManager, tenantId: string) {
  window.sessionStorage.setItem(SIGN_IN_TENANT_KEY, tenantId);
  await signIn.signinRedirect({ state: { returnTo: window.location.search } satisfies ReturnState });
}

export const isSignInReturn = (params: URLSearchParams) => params.has("state") && (params.has("code") || params.has("error"));

// The tenant this tab started signing in to, when this page load is the return from it.
export function signInReturnTenant(): string | null {
  return isSignInReturn(new URLSearchParams(window.location.search)) ? window.sessionStorage.getItem(SIGN_IN_TENANT_KEY) : null;
}

// A failed return from sign-in (?error=), usually a registration that doesn't match. Shown rather
// than signing in again, which would fail the same way, in a loop. Only a return to a sign-in this
// browser started counts (oidc-client-ts stores its pending state in localStorage under
// oidc.<state>), so a crafted link can't put its own text on the page.
export function signInError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  if (!params.has("error") || !state || window.localStorage.getItem(`oidc.${state}`) === null) return null;
  return params.get("error_description") ?? params.get("error");
}

// Finishes a sign-in redirect if this page load is one, then returns the signed-in user, if any.
export async function currentUser(signIn: UserManager): Promise<User | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    const user = await signIn.signinRedirectCallback();
    const returnTo = (user.state as ReturnState | undefined)?.returnTo ?? "";
    window.history.replaceState({}, "", window.location.pathname + returnTo);
    return user;
  }
  return activeUser(signIn);
}

// The stored user, renewed with the refresh token if its access token has expired (a reload after
// its 15 minutes, or a tab that slept past automatic renewal); null when renewal fails, which means
// the user is signed out.
export async function activeUser(signIn: UserManager): Promise<User | null> {
  const user = await signIn.getUser();
  if (!user?.expired) return user;
  return signIn.signinSilent().catch(() => null);
}

// The username Cirro knows the user by, from the ID token.
export const usernameOf = (user: User) => String(user.profile["cognito:username"] ?? user.profile.sub);

// Ends the app's session in this browser: revokes the refresh token (the only kind the token server
// revokes) and forgets the user. The user stays signed in to Cirro itself. The caller decides where
// to go next: the start page, or another tenant.
export async function signOut(signIn: UserManager) {
  try {
    await signIn.revokeTokens(["refresh_token"]);
  } catch (e) {
    throw new Error(`Logged out of this app, but the refresh token was not revoked: ${e instanceof Error ? e.message : e}`);
  } finally {
    // Forget the user even when revocation fails, so a failed sign-out can't leave them signed in.
    await signIn.removeUser();
  }
}

// Signed in to this tenant in this browser: oidc-client-ts keeps the user under
// oidc.user:<authority>:<client id>, and the authority is the tenant's URL. The client ID may only
// be known once the tenant is asked, so any one counts.
export function hasSignedInUser(tenantUrl: string): boolean {
  const prefix = `oidc.user:${tenantUrl}:`;
  try {
    const store = USER_STORE;
    return Array.from({ length: store.length }, (_, i) => store.key(i)).some((k) => k?.startsWith(prefix));
  } catch {
    return false;
  }
}

// Forgets every login stored for this tenant, whichever registration it was made under: one from a
// registration since replaced would otherwise keep reopening the tenant.
export function forgetStoredUsers(tenantUrl: string) {
  const prefix = `oidc.user:${tenantUrl}:`;
  const store = USER_STORE;
  const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => !!k?.startsWith(prefix));
  for (const k of keys) store.removeItem(k);
}
