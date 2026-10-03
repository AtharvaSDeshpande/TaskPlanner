// Demo auto-login via URL parameters.
//
// Lets a link sign a viewer in automatically so the app can be shown to end
// users without them typing credentials. Credentials may be passed either in:
//   • the URL hash  (preferred):  https://app/#username=demo@x.edu&password=secret
//   • the query string:           https://app/?username=demo@x.edu&password=secret
//
// The hash is preferred because, unlike the query string, it is NEVER sent to
// the server — so it stays out of access logs, proxies/CDNs and the Referer
// header. Either way the params are stripped from the URL immediately after they
// are read (see scrubUrlCredentials) so they don't linger in the address bar,
// browser history, or any link the viewer copies. `username` accepts the login
// email; `email` is accepted as an alias.

const CRED_KEYS = ['username', 'email', 'password'];

function paramsFromHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

// Reads one-time demo credentials from the URL, or null if none are present.
export function readUrlCredentials() {
  if (typeof window === 'undefined') return null;
  const hash = paramsFromHash();
  const query = new URLSearchParams(window.location.search);
  const pick = (key) => hash.get(key) || query.get(key);

  const username = pick('username') || pick('email');
  const password = pick('password');
  if (!username || !password) return null;
  return { username: username.trim(), password };
}

export function hasUrlCredentials() {
  return Boolean(readUrlCredentials());
}

// Removes the credential params from the URL (both query and hash) without a
// reload or a new history entry.
export function scrubUrlCredentials() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  CRED_KEYS.forEach((k) => url.searchParams.delete(k));

  const hash = paramsFromHash();
  CRED_KEYS.forEach((k) => hash.delete(k));
  const remainingHash = hash.toString();
  url.hash = remainingHash ? `#${remainingHash}` : '';

  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}
