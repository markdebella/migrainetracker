/**
 * auth.js — Google Identity Services token management
 *
 * Flow:
 *  1. init()       — page load: sets up both GIS APIs, attempts silent sign-in
 *  2. Silent path  — google.accounts.id.prompt() fires silently if Google session
 *                    is active; callback then requests Drive token with prompt:''
 *  3. Manual path  — user clicks Sign In → requestAccessToken({ prompt:'' })
 *                    (skips account picker if Google session is active)
 *  4. signOut()    — revokes token, disables auto-select, clears state
 *  5. Auto-refresh — silent re-request 5 min before expiry
 */

const Auth = (() => {
  let tokenClient       = null;
  let tokenData         = null;   // { access_token, expires_at }
  let refreshTimer      = null;
  let gapiReady         = false;
  let _afterCredential  = false;  // true when token request originated from One Tap

  /** Called when the OAuth2 token client delivers a token */
  function handleToken(response) {
    if (response.error) {
      if (_afterCredential) {
        // One Tap confirmed identity but the silent Drive-scope request failed
        // (common in Edge with tracking prevention, or on first consent).
        // Automatically retry with a visible OAuth popup so the user doesn't
        // get stuck — they'll see a brief Google consent window and be in.
        _afterCredential = false;
        tokenClient.requestAccessToken({});
        return;
      }
      // Silent refresh or manual attempt failed — show sign-in button.
      Alpine.store('auth').status = 'signed_out';
      return;
    }
    _afterCredential = false;

    const expiresAt = Date.now() + (response.expires_in - 60) * 1000;
    tokenData = { access_token: response.access_token, expires_at: expiresAt };

    gapi.client.setToken({ access_token: response.access_token });
    localStorage.setItem('mt_signed_in', '1');

    Alpine.store('auth').status = 'signed_in';

    // Schedule silent token refresh 5 min before expiry
    const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (tokenClient) tokenClient.requestAccessToken({ prompt: '' });
    }, Math.max(refreshIn, 0));

    App.onSignedIn();
  }

  /** Called by google.accounts.id (One Tap / silent sign-in) */
  function handleCredential(/* credentialResponse */) {
    // Identity confirmed — try to get the Drive token silently first.
    // If that fails, handleToken will retry with a visible popup.
    _afterCredential = true;
    if (tokenClient) tokenClient.requestAccessToken({ prompt: '' });
  }

  return {
    init() {
      // ── 1. OAuth2 token client (Drive access) ───────────────────────────
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.clientId,
        scope:     'https://www.googleapis.com/auth/drive.file',
        callback:  handleToken,
      });

      // ── 2. ID library (One Tap / silent sign-in) ─────────────────────────
      // auto_select: true means if the user has an active Google session and
      // has previously signed in, the callback fires without any UI.
      google.accounts.id.initialize({
        client_id:           CONFIG.clientId,
        auto_select:         true,
        callback:            handleCredential,
        cancel_on_tap_outside: false,
      });

      // ── 3. Load GAPI, then attempt silent sign-in ─────────────────────────
      gapi.load('client', async () => {
        await gapi.client.init({});
        gapiReady = true;
        Alpine.store('auth').gapiReady = true;

        if (localStorage.getItem('mt_signed_in')) {
          // Try One Tap silent sign-in first (works even when third-party
          // cookies are restricted, because it uses the Google session).
          google.accounts.id.prompt((notification) => {
            // If One Tap can't be shown (e.g. user dismissed it too many
            // times), fall back to a direct silent token request.
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              tokenClient.requestAccessToken({ prompt: '' });
            }
          });
        }
      });
    },

    /** Manual sign-in — called when user clicks the Sign In button */
    signIn() {
      // prompt:'' skips the account picker if Google already knows the user.
      // Google will only show the full picker when it genuinely needs it.
      tokenClient.requestAccessToken({ prompt: '' });
    },

    signOut() {
      if (tokenData?.access_token) {
        google.accounts.oauth2.revoke(tokenData.access_token, () => {});
      }
      google.accounts.id.disableAutoSelect();   // prevent silent re-login
      tokenData = null;
      clearTimeout(refreshTimer);
      gapi.client.setToken(null);
      Alpine.store('auth').status    = 'signed_out';
      Alpine.store('auth').user      = null;
      Alpine.store('data').manifest  = null;
      Alpine.store('data').activeIncident = null;
      localStorage.removeItem('mt_folder_id');
      localStorage.removeItem('mt_signed_in');
    },

    getToken()   { return tokenData?.access_token ?? null; },
    isSignedIn() { return !!tokenData?.access_token && Date.now() < (tokenData?.expires_at ?? 0); },
  };
})();
