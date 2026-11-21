// Firebase wiring: App, App Check, Auth, Firestore (offline-first), Remote Config, AI Logic.
import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  type User,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
} from "firebase/remote-config";
import { getAI, GoogleAIBackend } from "firebase/ai";

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// --- App Check (required by Firebase AI Logic) -----------------------------
// In local dev, set VITE_APPCHECK_DEBUG=true and register the debug token that
// is printed to the console in Firebase console > App Check > Manage debug tokens.
if (env.VITE_APPCHECK_DEBUG === "true") {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    env.VITE_APPCHECK_DEBUG_TOKEN || true;
}
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || "debug"),
  isTokenAutoRefreshEnabled: true,
});

// --- Firestore with persistent offline cache --------------------------------
// Entries written while offline are stored in IndexedDB and synced later.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// --- Auth --------------------------------------------------------------------
export const auth = getAuth(app);

export function whenSignedIn(cb: (u: User) => void) {
  onAuthStateChanged(auth, (u) => {
    if (u) cb(u);
    else if (navigator.onLine) signInAnonymously(auth).catch(console.error);
  });
}

export async function upgradeToGoogle() {
  const provider = new GoogleAuthProvider();
  if (auth.currentUser?.isAnonymous) {
    // Keep the lab notebook: link the anonymous account to Google.
    return linkWithPopup(auth.currentUser, provider).catch(() => signInWithPopup(auth, provider));
  }
  return signInWithPopup(auth, provider);
}

// --- Remote Config: routing policy is tunable without redeploying -----------
export const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
remoteConfig.defaultConfig = {
  cloud_model: "gemini-3.5-flash-lite",
  report_model: "gemini-3.5-flash-lite",
  // Inputs longer than this go to the cloud when online (on-device context is small).
  on_device_max_chars: 4000,
  // How many recent entries the on-device model sees when answering offline.
  on_device_context_entries: 8,
  // z-score above which a measurement is flagged as an anomaly.
  anomaly_z_threshold: 3,
};

export const config = {
  cloudModel: () => getValue(remoteConfig, "cloud_model").asString(),
  reportModel: () => getValue(remoteConfig, "report_model").asString(),
  onDeviceMaxChars: () => getValue(remoteConfig, "on_device_max_chars").asNumber(),
  onDeviceContextEntries: () => getValue(remoteConfig, "on_device_context_entries").asNumber(),
  anomalyZ: () => getValue(remoteConfig, "anomaly_z_threshold").asNumber(),
};

export async function loadRemoteConfig() {
  if (!navigator.onLine) return;
  try {
    await fetchAndActivate(remoteConfig);
  } catch (e) {
    console.warn("Remote Config unavailable, using defaults", e);
  }
}

// --- Firebase AI Logic (Gemini Developer API backend) -----------------------
export const ai = getAI(app, { backend: new GoogleAIBackend() });
