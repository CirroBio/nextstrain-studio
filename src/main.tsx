import React, { type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { DataService } from "@cirrobio/sdk";
import type { SystemInfoResponse } from "@cirrobio/api-client";
import { activeUser, createSignIn, currentUser, forgetStoredUsers, signInError, signOut, startSignIn, usernameOf } from "./auth";
import { chooseTenant, leaveTenant, loadTenants, startOf, takeSignInNow, type Tenant } from "./tenants";
import { FatalError, SignInPage } from "./start/Start";
import { App } from "./app/App";
import { APP_NAME } from "./app/appInfo";
import type { Session } from "./cirro/cirro";
import "./styles/tokens.css";
import "./styles/app.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// A rendering error anywhere shows a message and a way back, not a blank page.
class ErrorBoundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    return this.state.failed
      ? <FatalError title="Something went wrong" message={`${APP_NAME} hit an unexpected error on this page. Reloading usually fixes it.`} action={<button className="button button-primary" onClick={() => window.location.reload()}>Reload</button>} />
      : this.props.children;
  }
}

const render = (node: ReactNode) => root.render(<React.StrictMode><ErrorBoundary>{node}</ErrorBoundary></React.StrictMode>);

// A Cirro tenant: its public system info, then sign-in through its authorize page, then the app
// with an API client whose token comes from the sign-in library on every call.
async function startTenant(tenants: Tenant[], tenant: Tenant) {
  const signInNow = takeSignInNow();
  const leave = () => {
    forgetStoredUsers(tenant.url);
    leaveTenant();
  };
  const actions = (
    <div className="form-actions">
      <button className="button button-primary" onClick={() => chooseTenant(tenant)}>Try again</button>
      <button className="button" onClick={leave}>Back to the start page</button>
    </div>
  );
  render(<main className="centered-page"><p className="muted">Connecting to {tenant.name}…</p></main>);
  const res = await fetch(`${tenant.url}/api/info/system`).catch(() => null);
  if (!res?.ok) {
    render(<FatalError title={`Can't reach ${tenant.name}`} message="Cirro didn't answer. Check your connection and try again." action={actions} />);
    return;
  }
  const system = (await res.json()) as SystemInfoResponse;
  const tenantName = system.tenantInfo.name || tenant.name;
  if (system.maintenanceModeEnabled) {
    render(<FatalError title={`${tenantName} is in maintenance`} message="Cirro is being updated. Try again in a few minutes." action={actions} />);
    return;
  }
  // A failed return from sign-in is shown, not retried: it would fail the same way, in a loop.
  const failed = signInError();
  if (failed) {
    render(<FatalError title={`Logging in to ${tenantName} didn't finish`} message={`Cirro answered: ${failed}`} action={actions} />);
    return;
  }
  const didntFinish = (e: unknown) =>
    render(<FatalError title={`Logging in to ${tenantName} didn't finish`} message={e instanceof Error ? e.message : String(e)} action={actions} />);

  const signIn = await createSignIn(tenant.url, tenant.clientId).catch(didntFinish);
  if (!signIn) return;
  const user = await currentUser(signIn).catch((e: unknown) => {
    didntFinish(e);
    return undefined;
  });
  if (user === undefined) return;
  if (!user) {
    const redirect = () => startSignIn(signIn, tenant.id).catch(didntFinish);
    if (signInNow) await redirect();
    else render(<SignInPage tenantName={tenantName} onSignIn={redirect} onBack={leave} />);
    return;
  }

  const tokenGetter = async () => {
    const current = await activeUser(signIn);
    if (!current) throw new Error("Your Cirro session has ended. Reload the page to log in again.");
    return current.access_token;
  };
  const username = usernameOf(user);
  const session: Session = {
    data: new DataService({ basePath: `${tenant.url}/api`, tokenGetter }),
    username,
    displayName: typeof user.profile.email === "string" ? user.profile.email : username,
    tenantName,
    // The app is left either way: signOut forgets the user even when revocation fails.
    signOut: async () => {
      try {
        await signOut(signIn);
      } catch (e) {
        render(<FatalError title={`Logged out of ${tenantName}`} message={e instanceof Error ? e.message : String(e)} action={<button className="button button-primary" onClick={leave}>Back to the start page</button>} />);
        return;
      }
      leave();
    },
  };
  render(<App tenants={tenants} tenant={tenant} session={session} />);
}

// GitHub Pages can't send a frame-ancestors header, so the app refuses to run inside another
// site's frame (clickjacking) and offers its own tab instead.
if (window.top !== window.self) {
  root.render(
    <main className="centered-page">
      <div className="card">
        <p>{APP_NAME} doesn't run inside another page.</p>
        <a href={window.location.href} target="_blank" rel="noreferrer">Open {APP_NAME} in its own tab</a>
      </div>
    </main>
  );
} else {
  loadTenants()
    .then((tenants) => {
      const start = startOf(tenants);
      if ("tenant" in start) return startTenant(tenants, start.tenant);
      render(<App tenants={tenants} />);
    })
    .catch((e: unknown) => {
      console.error(e);
      render(<FatalError title={`${APP_NAME} couldn't start`} message={e instanceof Error ? e.message : String(e)} action={<button className="button button-primary" onClick={() => window.location.reload()}>Try again</button>} />);
    });
}
