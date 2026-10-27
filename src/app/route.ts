// The URL is the app's state, so every page can be linked to and Back works. Tenant, project and
// dataset are plain keys that other Cirro apps use too; the rest are this app's own.

export type Route =
  | { page: "home" }
  | { page: "catalog" }
  | { page: "files" }
  | { page: "sign-in" }
  | { page: "projects" }
  | { page: "project"; project: string }
  | { page: "new-build"; project: string }
  | { page: "view-nextstrain"; path: string }
  | { page: "view-url"; url: string }
  | { page: "view-cirro"; project: string; dataset: string; auspice: string };

const PAGE_KEY = "ns";

export function routeOf(search: string): Route {
  const p = new URLSearchParams(search);
  const project = p.get("project");
  const dataset = p.get("dataset");
  const auspice = p.get("auspice");
  if (project && dataset && auspice) return { page: "view-cirro", project, dataset, auspice };
  const nextstrain = p.get("nextstrain");
  if (nextstrain) return { page: "view-nextstrain", path: nextstrain };
  const url = p.get("url");
  if (url) return { page: "view-url", url };
  const page = p.get(PAGE_KEY);
  if (project) return page === "new-build" ? { page: "new-build", project } : { page: "project", project };
  if (page === "catalog" || page === "files" || page === "sign-in" || page === "projects") return { page };
  return { page: "home" };
}

// The search string for a route, keeping the tenant the page was opened for.
export function searchOf(route: Route, tenantId?: string): string {
  const p = new URLSearchParams();
  if (tenantId) p.set("tenant", tenantId);
  switch (route.page) {
    case "home":
      break;
    case "catalog":
    case "files":
    case "sign-in":
    case "projects":
      p.set(PAGE_KEY, route.page);
      break;
    case "project":
      p.set("project", route.project);
      break;
    case "new-build":
      p.set("project", route.project);
      p.set(PAGE_KEY, "new-build");
      break;
    case "view-nextstrain":
      p.set("nextstrain", route.path);
      break;
    case "view-url":
      p.set("url", route.url);
      break;
    case "view-cirro":
      p.set("project", route.project);
      p.set("dataset", route.dataset);
      p.set("auspice", route.auspice);
      break;
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
