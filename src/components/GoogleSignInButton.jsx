import React, { useState, useEffect } from 'react';

// Lightweight Google Sign-in placeholder.
// If Firebase / Google client is configured, you can wire it here. For now
// this component provides a guest sign-in path so the rest of the UI can
// behave as if a user is logged in (saved to localStorage).

export default function GoogleSignInButton() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vibesphere_user')); } catch(e){ return null; }
  });

  useEffect(() => {
    const onAuth = () => {
      try { setUser(JSON.parse(localStorage.getItem('vibesphere_user'))); } catch(e){ setUser(null); }
    };
    window.addEventListener('authChanged', onAuth);
    return () => window.removeEventListener('authChanged', onAuth);
  }, []);

  function signInAsGuest() {
    const guest = { id: 'guest_' + Date.now(), name: 'Guest Reader', provider: 'guest' };
    localStorage.setItem('vibesphere_user', JSON.stringify(guest));
    window.dispatchEvent(new CustomEvent('authChanged'));
    setUser(guest);
  }

  function signOut() {
    localStorage.removeItem('vibesphere_user');
    window.dispatchEvent(new CustomEvent('authChanged'));
    setUser(null);
  }

  // Note: If you later integrate Firebase, replace the guest handlers with
  // the appropriate provider popup logic and call window.dispatchEvent('authChanged')

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-700">Signed in as <strong>{user.name}</strong></div>
        <button onClick={signOut} className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-sm">Sign out</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={signInAsGuest} className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm shadow">Sign in as Guest</button>
    </div>
  );
}
