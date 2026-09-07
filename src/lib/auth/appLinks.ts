/**
 * "Tap the link on a phone → the app opens" BEFORE universal links.
 *
 * Universal links (Apple) / App Links (Google) let the app claim normal
 * https://chapter3five.app/inherit links, but only from a native build
 * that carries the entitlement — 1.5. Until every phone runs that, the
 * web /inherit route can still hand off through the app's private
 * scheme, which every shipped build already answers to:
 *
 *   Android  intent://… with a browser_fallback_url: Chrome opens the
 *            app if installed and quietly falls back to the web page
 *            if not. Fully automatic.
 *   iOS      a custom scheme with no app installed pops "Safari cannot
 *            open the page". So no auto-attempt: one clear button,
 *            "Open in the chapter3five app", and "Continue on the web"
 *            under it.
 *
 * FLAG. The app-side route (app/inherit.tsx) ships in the OTA that is
 * held until Apple approves 1.4. Flip this on the day that OTA goes
 * out — before then a tap would land on expo-router's unmatched-route
 * screen.
 */
export const APP_LINK_INTERSTITIAL = true; // ON since the 2026-09-07 OTA (update group d7036eb7)

const SCHEME = "chapter3fiveapp";
const ANDROID_PACKAGE = "app.chapter3five";

export function isPhoneUserAgent(ua: string | null): "ios" | "android" | null {
  if (!ua) return null;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}

export function appSchemeUrl(code: string | null): string {
  return code ? `${SCHEME}://inherit?code=${encodeURIComponent(code)}` : `${SCHEME}://inherit`;
}

export function androidIntentUrl(code: string | null, webFallback: string): string {
  const path = code ? `inherit?code=${encodeURIComponent(code)}` : "inherit";
  return `intent://${path}#Intent;scheme=${SCHEME};package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(webFallback)};end`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/** The tiny hand-off page. Self-contained, no JS on iOS at all. */
export function appLinkPage(input: {
  platform: "ios" | "android";
  code: string | null;
  webFallback: string;
}): string {
  const { platform, code, webFallback } = input;
  const scheme = appSchemeUrl(code);
  const intent = androidIntentUrl(code, webFallback);
  const primary = platform === "android" ? intent : scheme;
  const auto =
    platform === "android"
      ? `<meta http-equiv="refresh" content="0;url=${esc(intent)}">`
      : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>chapter3five</title>
${auto}
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1214;color:#f3efe9;font:16px/1.5 -apple-system,system-ui,sans-serif}
  main{max-width:22rem;padding:2rem 1.5rem;text-align:center}
  h1{font-size:1.15rem;font-weight:700;margin:0 0 .5rem}
  p{color:#b9b1a7;margin:0 0 1.5rem}
  a.app{display:block;padding:.9rem 1.2rem;border-radius:999px;background:linear-gradient(90deg,#2ab3a6,#f26d5b);color:#fff;font-weight:700;text-decoration:none}
  a.web{display:block;margin-top:1rem;color:#b9b1a7;text-decoration:underline;text-underline-offset:3px}
  code{color:#f3efe9}
</style></head><body><main>
  <h1>Someone shared their chapter3five code with you</h1>
  <p>${code ? `<code>${esc(code)}</code><br>` : ""}Open it in the app and the code is already filled in.</p>
  <a class="app" href="${esc(primary)}">Open in the chapter3five app</a>
  <a class="web" href="${esc(webFallback)}">Continue on the web</a>
</main></body></html>`;
}
