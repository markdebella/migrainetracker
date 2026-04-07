/**
 * auth.js — Google Identity Services token management
 *
 * Flow:
 *  1. initAuth()      — called on app boot; sets up the token client (no popup)
 *  2. signIn()        — called on button click; triggers Google popup
 *  3. signOut()       — revokes token, clears state
 *  4. Auto-refresh    — silent re-request at 55-min mark before expiry
 */

const Auth = (() => {
  let tokenClient = null;
  let tokenData   = null;  // { access_token, expires_at }
  let refreshTimer = null;

  /** Called when GIS delivers a token (initial or refresh) */
  function handleToken(response) {
    if (response.error) {
      // Silent auto-login failed — just show the sign-in button, no error toast
      Alpine.store('auth').status = 'signed_out';
      return;
    }

    const expiresAt = Date.now() + (response.expires_in - 60) * 1000; // 60s safety margin
    tokenData = { access_token: response.access_token, expires_at: expiresAt };

    // Apply to GAPI
    gapi.client.setToken({ access_token: response.access_token });

    // Remember that this user has signed in (enables silent auto-login next visit)
    localStorage.setItem('mt_signed_in', '1');

    // Update Alpine store
    Alpine.store('auth').status = 'signed_in';

    // Schedule silent refresh 5 minutes before expiry
    const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(silentRefresh, Math.max(refreshIn, 0));

    // Trigger app bootstrap (Drive folder + manifest) on first sign-in
    App.onSignedIn();
  }

  function silentRefresh() {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  return {
    /** Call once on page load after GIS script is ready */
    init() {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: handleToken,
      });

      // Load GAPI client (needed for Drive API calls)
      gapi.load('client', async () => {
        await gapi.client.init({});
        Alpine.store('auth').gapiReady = true;

        // Auto-login: if the user has signed in before, attempt a silent token
        // request. Works as long as their Google session is still active (typically
        // 30+ days). Falls back silently to the sign-in button if it fails.
        if (localStorage.getItem('mt_signed_in')) {
          tokenClient.requestAccessToken({ prompt: '' });
        }
      });
    },

    /** Open Google sign-in popup */
    signIn() {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    },

    /** Revoke the current token and reset state */
    signOut() {
      if (tokenData?.access_token) {
        google.accounts.oauth2.revoke(tokenData.access_token, () => {});
      }
      tokenData = null;
      clearTimeout(refreshTimer);
      gapi.client.setToken(null);
      Alpine.store('auth').status = 'signed_out';
      Alpine.store('auth').user   = null;
      Alpine.store('data').manifest = null;
      Alpine.store('data').activeIncident = null;
      localStorage.removeItem('mt_folder_id');
      localStorage.removeItem('mt_signed_in');
    },

    /** Returns the raw access token string, or null */
    getToken() {
      return tokenData?.access_token ?? null;
    },

    isSignedIn() {
      return !!tokenData?.access_token && Date.now() < (tokenData?.expires_at ?? 0);
    },
  };
})();
