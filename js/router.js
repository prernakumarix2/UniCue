function parseHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  return raw.replace(/\/+$/, "") || "/";
}

function match(pattern, path) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i];
    const actual = pathParts[i];

    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }

  return params;
}

const routes = [
  ["login", "/login"],
  ["signup", "/signup"],
  ["forgot", "/forgot"],
  ["home", "/"],
  ["attendance", "/attendance"],
  ["leave-planner", "/attendance/planner"],
  ["timetable", "/attendance/timetable"],
  ["setup-shared", "/setup/:payload"],
  ["timetable-import", "/attendance/import"],
  ["course-form", "/attendance/course/new"],
  ["course-form-edit", "/attendance/course/:id/edit"],
  ["course-detail", "/attendance/course/:id"],
  ["deadlines", "/deadlines"],
  ["deadline-form", "/deadlines/new"],
  ["deadline-form-edit", "/deadlines/:id/edit"],
  ["deadline-shared", "/shared/:payload"],
  ["information", "/information"],
  ["information-detail", "/information/:id"],
  ["company", "/company/:name"],
  ["placement", "/placement"],
  ["placement-detail", "/placement/:id"],
  ["profile", "/profile"],
  ["more", "/more"],
  ["settings", "/settings"],
  ["about", "/about"],
  ["privacy", "/privacy"],
  ["university-guide", "/guide"],
  ["admin", "/admin"],
  ["admin-dashboard", "/admin/dashboard"],
  ["admin-information", "/admin/information"],
  ["admin-information-new", "/admin/information/new"],
  ["admin-information-edit", "/admin/information/:id/edit"],
  ["admin-information-duplicate", "/admin/information/:id/duplicate"],
  ["admin-semester", "/admin/semester"],
  ["admin-placements", "/admin/placements"],
  ["admin-placements-new", "/admin/placements/new"],
  ["admin-placements-edit", "/admin/placements/:id/edit"],
  ["admin-placements-duplicate", "/admin/placements/:id/duplicate"]
];

export const router = {
  current() {
    const path = parseHash();

    for (const [name, pattern] of routes) {
      const params = match(pattern, path);
      if (params) return { name, path, params };
    }

    return { name: "notFound", path, params: {} };
  },

  go(path) {
    const target = String(path).startsWith("#") ? String(path) : `#${path}`;
    // Setting the same hash fires no "hashchange", so force a re-render.
    if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else window.location.hash = target;
  }
};
