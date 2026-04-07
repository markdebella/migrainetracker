/**
 * seed.js — Default settings factory
 *
 * Provides the default settings object used when a user signs in for the
 * first time. No personal data is bundled with the app.
 */

const DefaultSettings = {
  get() {
    return {
      version: 1,
      customAttackTypes: [],
      customSymptoms: [],
      customProdromeSymptoms: [],
      customTriggers: [],
      customTreatments: [],
      customAffectedActivities: [],
      notifications: { enabled: false, intervalMinutes: 120 },
    };
  },
};
