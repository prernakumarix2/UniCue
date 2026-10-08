// Module-loader hook: serve the Firebase SDK URLs from local fakes.
export async function resolve(specifier, context, nextResolve) {
  const match = /^https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z]+)\.js$/.exec(specifier);
  if (match) return { url: new URL(`./${match[1]}.js`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
