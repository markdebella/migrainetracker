// Public configuration — no secrets here.
// The OAuth client ID is safe to commit; Google's security relies on authorized origins, not secret IDs.
const CONFIG = {
  clientId: '155253754677-eec50p196kbcv4i265su1ufpsl8bkg82.apps.googleusercontent.com', // Replace with your Google Cloud OAuth client ID
  driveFolderName: 'MigraineTracker',
  appVersion: '2026.04.06.19.46.47',

  // Attack types shown in the incident form (user can add more in Settings)
  attackTypes: [
    { id: 'migraine',              label: 'Migraine' },
    { id: 'thunderclap',           label: 'Thunderclap' },
    { id: 'thunderclap_precursor', label: 'Thunderclap Precursor' },
    { id: 'tension',               label: 'Tension' },
    { id: 'cluster',               label: 'Cluster' },
    { id: 'sinus',                 label: 'Sinus' },
    { id: 'cervicogenic',          label: 'Cervicogenic' },
    { id: 'hemiplegic',            label: 'Hemiplegic' },
    { id: 'vestibular',            label: 'Vestibular' },
  ],

  symptoms: [
    { id: 'photophobia',     label: 'Sensitivity to light' },
    { id: 'phonophobia',     label: 'Sensitivity to sound' },
    { id: 'neck_pain',       label: 'Neck pain' },
    { id: 'nausea',          label: 'Nausea' },
    { id: 'vomiting',        label: 'Vomiting' },
    { id: 'throbbing',       label: 'Throbbing pain' },
    { id: 'worse_moving',    label: 'Worse when moving' },
    { id: 'brain_fog',       label: 'Confusion / Brain fog' },
    { id: 'tinnitus',        label: 'Ringing in ears (tinnitus)' },
    { id: 'aura_visual',     label: 'Aura (visual)' },
    { id: 'aura_sensory',    label: 'Aura (sensory)' },
    { id: 'numbness',        label: 'Numbness / Tingling' },
    { id: 'dizziness',       label: 'Dizziness' },
    { id: 'fatigue',         label: 'Fatigue' },
  ],

  premonitorySymptoms: [
    { id: 'prodrome_headache',        label: 'Headache' },
    { id: 'muscle_stiffness',         label: 'Muscle stiffness' },
    { id: 'tingling_neck',            label: 'Tingling in neck' },
    { id: 'tingling_head',            label: 'Tingling in head' },
    { id: 'yawning',                  label: 'Yawning' },
    { id: 'mood_changes',             label: 'Mood changes' },
    { id: 'food_cravings',            label: 'Food cravings' },
    { id: 'prodrome_fatigue',         label: 'Fatigue' },
    { id: 'prodrome_light_sensitive', label: 'Light sensitivity' },
    { id: 'neck_stiffness',           label: 'Neck stiffness' },
  ],

  triggers: [
    { id: 'rebound',          label: 'Rebound headache' },
    { id: 'sleep_disruption', label: 'Interrupted sleep' },
    { id: 'posture',          label: 'Posture' },
    { id: 'stress',           label: 'Stress' },
    { id: 'dehydration',      label: 'Dehydration' },
    { id: 'weather',          label: 'Weather change' },
    { id: 'alcohol',          label: 'Alcohol' },
    { id: 'caffeine',         label: 'Caffeine (excess / withdrawal)' },
    { id: 'skipped_meals',    label: 'Skipped meals' },
    { id: 'bright_light',     label: 'Bright light' },
    { id: 'strong_smells',    label: 'Strong smells' },
    { id: 'screen_time',      label: 'Screen time' },
    { id: 'hormonal',         label: 'Hormonal changes' },
    { id: 'exertion',         label: 'Physical exertion' },
    { id: 'neck_pain_trig',   label: 'Neck pain' },
  ],

  affectedActivities: [
    { id: 'work',        label: 'Missed work' },
    { id: 'social',      label: 'Missed social plans' },
    { id: 'driving',     label: "Couldn't drive" },
    { id: 'sleep',       label: "Couldn't sleep" },
    { id: 'exercise',    label: 'Missed exercise' },
    { id: 'bedridden',   label: 'Bedridden' },
    { id: 'reduced',     label: 'Reduced productivity' },
    { id: 'unaffected',  label: 'Not affected' },
  ],

  medications: [
    { id: 'sumatriptan_inj',  label: 'Sumatriptan 3mg Injection' },
    { id: 'sumatriptan_oral', label: 'Sumatriptan 100mg Oral' },
    { id: 'topiramate',       label: 'Topiramate 25mg' },
    { id: 'aspirin',          label: 'Aspirin' },
    { id: 'ibuprofen',        label: 'Ibuprofen' },
    { id: 'acetaminophen',    label: 'Acetaminophen' },
    { id: 'rizatriptan',      label: 'Rizatriptan' },
    { id: 'naratriptan',      label: 'Naratriptan' },
    { id: 'ergotamine',       label: 'Ergotamine' },
    { id: 'marijuana',        label: 'Marijuana' },
    { id: 'caffeine_med',     label: 'Caffeine' },
  ],

  nonDrugMethods: [
    { id: 'ice_packs',    label: 'Ice packs' },
    { id: 'hot_shower',   label: 'Hot shower' },
    { id: 'dark_room',    label: 'Dark room rest' },
    { id: 'sleep',        label: 'Sleep' },
    { id: 'cold_compress',label: 'Cold compress' },
    { id: 'massage',      label: 'Massage' },
    { id: 'meditation',   label: 'Meditation' },
    { id: 'fresh_air',    label: 'Fresh air' },
    { id: 'caffeine_drink',label: 'Caffeine drink' },
    { id: 'lying_flat',   label: 'Lying flat' },
  ],

  // Pain scale labels indexed 1–10
  painLabels: {
    1: 'Minimal', 2: 'Minimal',
    3: 'Mild',    4: 'Mild',
    5: 'Moderate',6: 'Moderate',
    7: 'Severe',  8: 'Severe',
    9: 'Worst',  10: 'Worst',
  },
};
