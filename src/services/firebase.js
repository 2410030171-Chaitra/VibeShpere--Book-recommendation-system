// Lightweight Firebase scaffold (dynamic import)
//
// Purpose:
// - Provide an optional Firebase sign-in integration without requiring the
//   SDK to be present at build time. The functions here dynamically import
//   the Firebase SDK and expose a minimal set of helpers used by the UI.
// - If the Firebase SDK is not installed, the helpers throw with a clear
//   message so callers can fall back to guest sign-in.
//
// How to use:
// 1) Install the Firebase SDK in your project:
//    npm install firebase
// 2) Provide your Firebase client config at runtime. Two options:
//    - Add a script tag in `index.html` before the app bundle:
//      <script>window.__FIREBASE_CONFIG__ = { apiKey: '...', authDomain: '...', ... };</script>
//    - Or create a file `src/firebaseConfig.js` that exports the config and
//      import it in your app (then call initFirebase(config)).
// 3) The UI will call `initFirebase(config)` and then `signInWithGoogle()`.
//
// Notes:
// - This file uses dynamic imports so the app can build without firebase
//   installed. If you call these helpers and the SDK is missing, you'll get
//   a helpful error telling you to install it.

let _auth = null;

export async function initFirebase(config) {
  if (!config) throw new Error('Firebase config required for initFirebase');
  try {
    // Use a dynamic import via Function to prevent bundlers (Vite/Rollup)
    // from statically analyzing and requiring the `firebase` package at
    // build time when it's not installed. This allows the app to build
    // without firebase present and only load it at runtime if available.
    const importer = new Function('m', 'return import(m)');
    const firebase = await importer('firebase/app');
    const authModule = await importer('firebase/auth');
    const { initializeApp, getApps } = firebase;
    if (!getApps || getApps().length === 0) {
      initializeApp(config);
    }
    _auth = authModule.getAuth();
    return _auth;
  } catch (err) {
    throw new Error('Firebase SDK not installed. Run `npm install firebase` and rebuild.');
  }
}

export async function signInWithGoogle() {
  if (!_auth) throw new Error('Firebase not initialized. Call initFirebase(config) first.');
  const importer = new Function('m', 'return import(m)');
  const { GoogleAuthProvider, signInWithPopup } = await importer('firebase/auth');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(_auth, provider);
  return result.user;
}

export async function signOut() {
  if (!_auth) throw new Error('Firebase not initialized.');
  const importer = new Function('m', 'return import(m)');
  const authMod = await importer('firebase/auth');
  await authMod.signOut(_auth);
}

export async function onAuthStateChanged(callback) {
  if (!_auth) throw new Error('Firebase not initialized.');
  const importer = new Function('m', 'return import(m)');
  const { onAuthStateChanged } = await importer('firebase/auth');
  return onAuthStateChanged(_auth, callback);
}

export function isInitialized() {
  return !!_auth;
}
