import { useEffect, useMemo, useState } from "react";
import { CirroProvider, type Session } from "../cirro/cirro";
import { leaveTenant, type Tenant } from "../tenants";
import { SignIn } from "../start/Start";
import { CatalogPage } from "../catalog/CatalogPage";
import { FilesPage } from "../local/FilesPage";
import { ViewerPage } from "../viewer/ViewerPage";
import { nextstrainSource, urlSource } from "../viewer/sources";
import { ProjectsPage } from "../project/ProjectsPage";
import { ProjectPage } from "../project/ProjectPage";
import { NewBuildPage } from "../project/NewBuildPage";
import { CirroViewerPage } from "../project/CirroViewerPage";
import { SaveToCirro } from "../project/SaveToCirro";
import { Home } from "./Home";
import { APP_NAME } from "./appInfo";
import { routeOf, searchOf, type Route } from "./route";

type Props = { tenants: Tenant[]; tenant?: Tenant; session?: Session };

export function App({ tenants, tenant, session }: Props) {
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.search));
  useEffect(() => {
    const onPop = () => setRoute(routeOf(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (next: Route) => {
    window.history.pushState(null, "", window.location.pathname + searchOf(next, tenant?.id));
    setRoute(next);
    window.scrollTo(0, 0);
  };

  const shell = (
    <div className="app">
      <TopBar route={route} go={go} session={session} />
      <Page route={route} go={go} tenants={tenants} session={session} />
    </div>
  );
  return tenant && session ? <CirroProvider tenant={tenant} session={session}>{shell}</CirroProvider> : shell;
}

function TopBar({ route, go, session }: { route: Route; go: (r: Route) => void; session?: Session }) {
  const current = (page: Route["page"]) => (route.page === page ? "page" : undefined);
  return (
    <header className="topbar">
      <button className="brand link-reset" onClick={() => go({ page: "home" })}>
        <svg className="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 12h4M7 6v12M7 6h6M7 18h4M13 6V3M13 6v4M13 3h7M13 10h5M11 18v-2M11 18v3M11 16h6M11 21h9" />
        </svg>
        {APP_NAME}
      </button>
      <nav className="crumbs">
        <button className="crumb" aria-current={current("catalog")} onClick={() => go({ page: "catalog" })}>Public datasets</button>
        <button className="crumb" aria-current={current("files")} onClick={() => go({ page: "files" })}>Open files</button>
        {session && <button className="crumb" aria-current={current("projects")} onClick={() => go({ page: "projects" })}>Projects</button>}
      </nav>
      <div className="topbar-right">
        {session ? (
          <span className="user">
            <span className="muted">{session.tenantName} · {session.displayName}</span>
            <button className="button button-small" onClick={() => session.signOut()}>Log out</button>
          </span>
        ) : (
          <button className="button button-small" onClick={() => go({ page: "sign-in" })}>Log in to Cirro</button>
        )}
      </div>
    </header>
  );
}

function Page({ route, go, tenants, session }: { route: Route; go: (r: Route) => void; tenants: Tenant[]; session?: Session }) {
  // Sources are made once per address, so the viewer doesn't refetch on every render.
  const key = searchOf(route);
  const source = useMemo(
    () => (route.page === "view-nextstrain" ? nextstrainSource(route.path) : route.page === "view-url" ? urlSource(route.url) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
  const needsCirro = <SignInFirst tenants={tenants} />;

  switch (route.page) {
    case "home":
      return <Home go={go} signedInTo={session?.tenantName ?? null} />;
    case "catalog":
      return <CatalogPage go={go} />;
    case "files":
      return <FilesPage actions={session ? (files) => <SaveToCirro files={files} go={go} /> : undefined} />;
    case "sign-in":
      return session ? <ProjectsPage go={go} /> : <SignIn tenants={tenants} onBack={() => go({ page: "home" })} />;
    case "projects":
      return session ? <ProjectsPage go={go} /> : needsCirro;
    case "project":
      return session ? <ProjectPage key={route.project} projectId={route.project} go={go} /> : needsCirro;
    case "new-build":
      return session ? <NewBuildPage key={route.project} projectId={route.project} go={go} /> : needsCirro;
    case "view-cirro":
      return session ? <CirroViewerPage key={key} projectId={route.project} datasetId={route.dataset} auspicePath={route.auspice} go={go} /> : needsCirro;
    case "view-nextstrain":
    case "view-url":
      return <ViewerPage source={source!} />;
  }
}

function SignInFirst({ tenants }: { tenants: Tenant[] }) {
  return (
    <>
      <p className="notice" style={{ maxWidth: 520, margin: "24px auto 0" }}>This page is in a Cirro project. Log in to open it.</p>
      <SignIn tenants={tenants} onBack={leaveTenant} />
    </>
  );
}
