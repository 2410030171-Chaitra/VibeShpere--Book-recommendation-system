/* eslint-disable react/prop-types */
import React, { useState, useEffect } from 'react';
import apiService from '../services/api.js';

// Lightweight Google Sign-in placeholder.
// If Firebase / Google client is configured, you can wire it here. For now
// this component provides a guest sign-in path so the rest of the UI can
// behave as if a user is logged in (saved to localStorage).

export default function GoogleSignInButton({ openOnMount = false, onAuth = null, inline = false }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vibesphere_user')); } catch(e){ return null; }
  });

  const [showModal, setShowModal] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupMsg, setSignupMsg] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinMsg, setSigninMsg] = useState('');

  useEffect(() => {
    const onAuth = () => {
      try { setUser(JSON.parse(localStorage.getItem('vibesphere_user'))); } catch(e){ setUser(null); }
    };
    window.addEventListener('authChanged', onAuth);
    return () => window.removeEventListener('authChanged', onAuth);
  }, []);

  // Dev/runtime Firebase diagnostics + helper
  const [hasFirebaseSdk, setHasFirebaseSdk] = useState(false);
  const [runtimeConfigPresent, setRuntimeConfigPresent] = useState(!!(typeof window !== 'undefined' && window.__FIREBASE_CONFIG__));
  const [showDevConfig, setShowDevConfig] = useState(false);
  const [devConfigText, setDevConfigText] = useState('');
  const [cfgMsg, setCfgMsg] = useState('');

  async function checkFirebaseSdk() {
    try {
      const importer = new Function('m', 'return import(m)');
      // try a light import; we don't need to init here
      await importer('firebase/app');
      setHasFirebaseSdk(true);
    } catch (err) {
      setHasFirebaseSdk(false);
    }
    setRuntimeConfigPresent(!!(typeof window !== 'undefined' && window.__FIREBASE_CONFIG__));
  }

  // Call check when modal opens so user sees status
  useEffect(() => {
    if (showModal) checkFirebaseSdk();
  }, [showModal]);

  // If parent asks to open on mount (presentation/dev), open modal once
  useEffect(() => {
    if (openOnMount) {
      // small delay so parent render settles
      // Force-clear any persisted user so the modal shows for everyone
  try { localStorage.removeItem('vibesphere_user'); } catch (e) { /* ignore */ }
      const t = setTimeout(() => setShowModal(true), 120);
      return () => clearTimeout(t);
    }
  }, [openOnMount]);

  // If openOnMount is true, ignore any persisted user when rendering
  const displayedUser = openOnMount ? null : user;

  function signInAsGuest() {
    const guest = { id: 'guest_' + Date.now(), name: 'Guest Reader', provider: 'guest' };
    localStorage.setItem('vibesphere_user', JSON.stringify(guest));
    window.dispatchEvent(new CustomEvent('authChanged'));
    setUser(guest);
  try { if (typeof onAuth === 'function') onAuth(guest); } catch (e) { /* ignore */ }
  }

  function openSignup() {
    setSignupName('');
    setSignupEmail('');
    setSignupMsg('');
    setMode('signup');
    setShowModal(true);
  }

  function closeSignup() {
    setShowModal(false);
  }

  function continueWithGoogle() {
    // Try to use Firebase if available; otherwise show setup instructions.
    (async () => {
      try {
        const fb = await import('../services/firebase.js');
        // Allow runtime config via window.__FIREBASE_CONFIG__ (see src/services/firebase.js)
        const cfg = typeof window !== 'undefined' ? window.__FIREBASE_CONFIG__ : null;
        if (cfg && !fb.isInitialized()) {
          await fb.initFirebase(cfg);
        }
        const user = await fb.signInWithGoogle();
        const created = { id: user.uid || user.uid, name: user.displayName || user.email, email: user.email, provider: 'google' };
        localStorage.setItem('vibesphere_user', JSON.stringify(created));
        window.dispatchEvent(new CustomEvent('authChanged'));
        setUser(created);
        setShowModal(false);
  try { if (typeof onAuth === 'function') onAuth(created); } catch (e) { /* ignore */ }
      } catch (err) {
        // If Firebase isn't available or sign-in fails, show setup instructions
        console.warn('Firebase sign-in failed or not available', err && err.message ? err.message : err);
        alert('Google Sign-In requires Firebase setup. Please:\n\n1. Create a Firebase project at https://console.firebase.google.com\n2. Enable Google Authentication\n3. Add your Firebase config to the app\n\nFor now, please use Email/Password sign-in or contact the administrator.');
        setShowModal(false);
      }
    })();
  }

  async function tryInitWithPastedConfig() {
    setCfgMsg('');
    try {
      const parsed = JSON.parse(devConfigText);
      // store on window so other helpers see it
      window.__FIREBASE_CONFIG__ = parsed;
      // attempt to init the firebase helper directly
      const fb = await import('../services/firebase.js');
      await fb.initFirebase(parsed);
      setCfgMsg('Firebase initialized successfully — you can now Continue with Google');
      setRuntimeConfigPresent(true);
      setHasFirebaseSdk(true);
    } catch (err) {
      setCfgMsg('Failed to initialize Firebase: ' + (err && err.message ? err.message : String(err)));
    }
  }

  function submitEmailSignup(e) {
    e.preventDefault();
    if (!signupEmail || !signupName || !signupPassword) {
      setSignupMsg('Please provide name, email and password');
      return;
    }

    // Try to register via backend; if backend/register fails, fall back to local guest
    (async () => {
      try {
        const resp = await apiService.register({ name: signupName, email: signupEmail, password: signupPassword });
        if (resp && resp.user) {
          // apiService.register stores token in localStorage via setToken
          const created = resp.user;
          localStorage.setItem('vibesphere_user', JSON.stringify(created));
          window.dispatchEvent(new CustomEvent('authChanged'));
          setUser(created);
          setShowModal(false);
    try { if (typeof onAuth === 'function') onAuth(created); } catch (e) { /* ignore */ }
          return;
        }
        throw new Error('Registration failed');
      } catch (err) {
        console.warn('Backend register failed, falling back to guest:', err && err.message ? err.message : err);
        const created = { id: 'user_' + Date.now(), name: signupName, email: signupEmail, provider: 'email-guest' };
        localStorage.setItem('vibesphere_user', JSON.stringify(created));
        window.dispatchEvent(new CustomEvent('authChanged'));
        setUser(created);
        setShowModal(false);
        try { if (typeof onAuth === 'function') onAuth(created); } catch (e) { /* ignore */ }
      }
    })();
  }

  async function submitSignin(e) {
    e.preventDefault();
    setSigninMsg('');
    if (!signinEmail || !signinPassword) {
      setSigninMsg('Please enter email and password');
      return;
    }
    try {
      const resp = await apiService.login({ email: signinEmail, password: signinPassword });
      if (resp && resp.user) {
        const created = resp.user;
        // apiService.login already set token via setToken
        localStorage.setItem('vibesphere_user', JSON.stringify(created));
        window.dispatchEvent(new CustomEvent('authChanged'));
        setUser(created);
        setShowModal(false);
  try { if (typeof onAuth === 'function') onAuth(created); } catch (e) { /* ignore */ }
        return;
      }
      setSigninMsg('Login failed — please check your credentials');
    } catch (err) {
      console.warn('Login error', err);
      setSigninMsg(err && err.message ? err.message : 'Login failed');
    }
  }

  function signOut() {
    localStorage.removeItem('vibesphere_user');
    window.dispatchEvent(new CustomEvent('authChanged'));
    setUser(null);
  }

  // Note: If you later integrate Firebase, replace the guest handlers with
  // the appropriate provider popup logic and call window.dispatchEvent('authChanged')

  if (displayedUser) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-700">Signed in as <strong>{displayedUser.name}</strong></div>
        <button onClick={signOut} className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-sm">Sign out</button>
      </div>
    );
  }
  // When used inline (on the Auth page) render a single prominent Google CTA
  if (inline) {
    return (
      <div className="w-full">
        <button
          onClick={async () => { try { await continueWithGoogle(); } catch (e) { /* continueWithGoogle handles fallback */ } }}
          title="Continue with Google"
          className="w-full inline-flex items-center justify-center gap-3 py-3 px-4 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow focus:outline-none"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.35 11.1h-9.18v2.92h5.3c-.23 1.3-1.44 3.82-5.3 3.82-3.19 0-5.8-2.63-5.8-5.87s2.61-5.87 5.8-5.87c1.82 0 3.04.78 3.74 1.45l2.56-2.47C16.5 3.22 14.26 2 11.17 2 6.17 2 2 6.13 2 11.17s4.17 9.17 9.17 9.17c5.26 0 8.73-3.69 8.73-8.98 0-.6-.07-1.05-.55-1.25z" fill="#4285F4"/></svg>
          <span className="text-sm font-medium text-slate-700">Continue with Google</span>
        </button>
      </div>
    );
  }

  // Default (modal) behavior unchanged
  return (
    <div className="flex items-center gap-2">
      {/* Trigger a lightweight signup modal that offers a "Continue with Google" CTA (guest fallback)
          and a simple email sign-up. This keeps the demo working without API keys.
      */}
  <button onClick={openSignup} title="Sign up or continue with Google" className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm shadow">Sign up / Sign in</button>

      {/* Modal (simple inline implementation) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeSignup} />
          <div className="relative w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
            <div className="flex flex-col items-center mb-4">
              <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center mb-4">
                <img src="/assets/hero-lavender.png" alt="Logo" className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900">VibeSphere</h1>
              <p className="text-sm text-slate-500 mt-1">Discover books that feel just right ✨</p>
            </div>

            {/* Inline Google CTA (keeps your request to show Continue with Google at top) */}
            <div className="mb-4">
              <button onClick={continueWithGoogle} className="w-full flex items-center gap-3 justify-center py-3 px-4 rounded-xl bg-white border border-slate-200 hover:shadow focus:outline-none">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.35 11.1h-9.18v2.92h5.3c-.23 1.3-1.44 3.82-5.3 3.82-3.19 0-5.8-2.63-5.8-5.87s2.61-5.87 5.8-5.87c1.82 0 3.04.78 3.74 1.45l2.56-2.47C16.5 3.22 14.26 2 11.17 2 6.17 2 2 6.13 2 11.17s4.17 9.17 9.17 9.17c5.26 0 8.73-3.69 8.73-8.98 0-.6-.07-1.05-.55-1.25z" fill="#4285F4"/></svg>
                <span className="text-sm font-medium text-slate-700">Continue with Google</span>
              </button>
            </div>

            {/* Tabs (Login / Sign up) */}
            <div className="mb-4">
              <div className="flex items-center bg-slate-100 rounded-full p-1 gap-1">
                <button onClick={() => setMode('signin')} className={`flex-1 py-2 px-4 text-sm rounded-full ${mode === 'signin' ? 'bg-white shadow' : 'text-slate-600'}`}>
                  🔑 Login
                </button>
                <button onClick={() => setMode('signup')} className={`flex-1 py-2 px-4 text-sm rounded-full ${mode === 'signup' ? 'bg-white shadow' : 'text-slate-600'}`}>
                  ✨ Sign up
                </button>
              </div>
            </div>

            {/* Form area */}
            <div>
              {mode === 'signin' ? (
                <form onSubmit={submitSignin} className="flex flex-col gap-4">
                  <label className="text-sm text-slate-600">✉️ Email</label>
                  <input value={signinEmail} onChange={e => setSigninEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-0 focus:border-slate-300" />

                  <label className="text-sm text-slate-600">🔒 Password</label>
                  <input type="password" value={signinPassword} onChange={e => setSigninPassword(e.target.value)} placeholder="••••••••" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-0 focus:border-slate-300" />

                  {signinMsg && <div className="text-sm text-red-500">{signinMsg}</div>}

                  <button type="submit" className="w-full mt-2 rounded-xl py-3 bg-gradient-to-r from-purple-400 to-pink-300 text-white font-semibold flex items-center justify-center gap-2">🚀 Sign In</button>

                  <div className="flex items-center justify-between text-sm text-slate-500 mt-3">
                    <a href="#" className="hover:underline">Forgot password?</a>
                    <div>Need an account? <button type="button" onClick={() => setMode('signup')} className="text-indigo-600 underline">Sign up</button></div>
                  </div>
                </form>
              ) : (
                <form onSubmit={submitEmailSignup} className="flex flex-col gap-4">
                  <label className="text-sm text-slate-600">Name</label>
                  <input value={signupName} onChange={e => setSignupName(e.target.value)} placeholder="Your name" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm" />
                  <label className="text-sm text-slate-600">Email</label>
                  <input value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm" />
                  <label className="text-sm text-slate-600">Password</label>
                  <input type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="Create a password" className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm" />
                  {signupMsg && <div className="text-sm text-red-500">{signupMsg}</div>}
                  <button type="submit" className="w-full mt-2 rounded-xl py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold">Create account</button>
                  <div className="text-sm text-slate-500 mt-3">Have an account? <button type="button" onClick={() => setMode('signin')} className="text-indigo-600 underline">Sign in</button></div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
