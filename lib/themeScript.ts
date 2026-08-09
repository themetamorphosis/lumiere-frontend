/**
 * The blocking script injected into <head> to set the theme before first paint.
 *
 * It lives here, rather than inline in layout.tsx, so `next.config.ts` can hash
 * the exact same string for the Content-Security-Policy `script-src`. A hash
 * keeps the pages statically renderable — the nonce alternative requires
 * reading headers() per request, which opts every route into dynamic
 * rendering.
 *
 * Editing this string changes its hash. The config computes the hash from this
 * export at build time, so the two cannot drift.
 */
export const THEME_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('wv-global-theme');
    if (t === 'retro-light') {
      document.documentElement.setAttribute('data-theme', 'retro-light');
    } else {
      document.documentElement.setAttribute('data-theme', 'retro-dark');
    }
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'retro-dark');
  }
})();
`;
