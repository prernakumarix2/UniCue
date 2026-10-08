// Loading placeholders: same silhouette as the real screens, so nothing jumps when data arrives.
const bar = (w, h = 12) => `<span class="skel" style="width:${w};height:${h}px"></span>`;
const card = () => `<div class="card skel-card">${bar("32%", 18)}${bar("86%", 16)}${bar("100%")}${bar("64%")}</div>`;

export function skeleton(routeName = "") {
  const head = `<div class="page-header">${bar("46%", 28)}<div style="height:8px"></div>${bar("70%")}</div>`;
  const body = routeName.endsWith("detail")
    ? `<div class="card skel-card">${bar("28%", 18)}${bar("90%", 22)}${bar("60%", 12)}${bar("100%")}${bar("100%")}${bar("80%")}</div>`
    : `<div class="stack">${card()}${card()}${routeName === "home" ? "" : card()}</div>`;
  return `<div class="skeleton" aria-busy="true" aria-label="Loading">${head}${body}</div>`;
}
