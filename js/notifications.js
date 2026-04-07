/**
 * notifications.js — Browser Notification API
 *
 * When an active attack is running, the user can opt-in to periodic reminders
 * to log a check-in. The interval is set in Settings.
 *
 * Important: permission must be requested from a user gesture — never auto-prompted.
 */

const Notifications = (() => {
  let intervalId = null;

  function isSupported() {
    return 'Notification' in window;
  }

  function hasPermission() {
    return isSupported() && Notification.permission === 'granted';
  }

  function fire(title, body) {
    if (!hasPermission()) return;
    try {
      const n = new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" stroke="%237c6aff" stroke-width="2" fill="none"/><circle cx="20" cy="20" r="2.5" fill="%237c6aff"/></svg>',
        tag: 'migraine-checkin',
      });
      n.onclick = () => {
        window.focus();
        const active = Manifest.activeEntry();
        if (active) Router.go('check-in', { id: active.id });
        n.close();
      };
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  }

  return {
    /** Called on app boot — just restores interval if active attack exists. */
    init() {
      if (!isSupported()) return;
      const active = Manifest.activeEntry();
      if (!active) return;

      const settings = Alpine.store('data').settings;
      if (settings?.notifications?.enabled && hasPermission()) {
        Notifications.start(settings.notifications.intervalMinutes ?? 120);
      }
    },

    /**
     * Called when the user clicks "Start Attack".
     * Shows a prompt in the UI (via Toast) — does NOT auto-request permission.
     */
    startPrompt() {
      if (!isSupported() || hasPermission()) {
        // Already granted or not supported — just start silently
        const settings = Alpine.store('data').settings;
        if (settings?.notifications?.enabled) {
          Notifications.start(settings.notifications.intervalMinutes ?? 120);
        }
        return;
      }
      // We cannot request here — must be from a user gesture in Settings
      // Just remind via toast
      Toast.info('Enable check-in reminders in Settings → Notifications.');
    },

    /** Start the periodic reminder. intervalMinutes: how often to fire. */
    start(intervalMinutes = 120) {
      Notifications.stop(); // clear any existing
      if (!hasPermission()) return;

      intervalId = setInterval(() => {
        const active = Manifest.activeEntry();
        if (!active) { Notifications.stop(); return; }
        const elapsed = Utils.elapsed(active.startTime);
        fire('Time for a headache check-in', `Your headache has been active for ${elapsed}. Log how you're feeling.`);
      }, intervalMinutes * 60 * 1000);
    },

    /** Stop the reminder interval. */
    stop() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    },

    /**
     * Request permission from a user gesture (e.g. Settings toggle).
     * Returns a promise resolving to true if granted.
     */
    async requestPermission() {
      if (!isSupported()) return false;
      if (hasPermission()) return true;
      const result = await Notification.requestPermission();
      return result === 'granted';
    },

    isSupported,
    hasPermission,
    permission() { return isSupported() ? Notification.permission : 'unsupported'; },
  };
})();
