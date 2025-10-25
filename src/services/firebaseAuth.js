/**
 * Firebase Configuration
 * Set up your Firebase project and add your credentials here
 * 
 * Steps to set up:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Enable Google Authentication in Authentication > Sign-in method
 * 4. Go to Project Settings > General
 * 5. Scroll down to "Your apps" and add a Web app
 * 6. Copy the firebaseConfig object and paste below
 * 7. Create a .env file in the project root and add your Firebase keys
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';

// Firebase configuration
// In production, use environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC-placeholder-get-from-firebase-console",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// Initialize Firebase
let app;
let auth;
let googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  
  // Configure Google provider
  googleProvider.addScope('profile');
  googleProvider.addScope('email');
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

/**
 * Sign in with Google using popup
 * @returns {Promise<Object>} User object with profile data
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Extract user information
    const userData = {
      id: user.uid,
      email: user.email,
      name: user.displayName,
      photo: user.photoURL,
      emailVerified: user.emailVerified,
      provider: 'google'
    };
    
    console.log('✅ Successfully signed in:', userData.name);
    return userData;
  } catch (error) {
    console.error('❌ Google sign-in error:', error);
    
    // Handle specific error codes
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site.');
    } else {
      throw new Error('Failed to sign in with Google');
    }
  }
}

/**
 * Sign in with Google using redirect (better for mobile)
 */
export async function signInWithGoogleRedirect() {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('❌ Google redirect sign-in error:', error);
    throw error;
  }
}

/**
 * Handle redirect result after Google sign-in redirect
 * @returns {Promise<Object|null>} User object or null
 */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const user = result.user;
      return {
        id: user.uid,
        email: user.email,
        name: user.displayName,
        photo: user.photoURL,
        emailVerified: user.emailVerified,
        provider: 'google'
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Redirect result error:', error);
    return null;
  }
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function logOut() {
  try {
    await signOut(auth);
    console.log('✅ Successfully signed out');
  } catch (error) {
    console.error('❌ Sign-out error:', error);
    throw new Error('Failed to sign out');
  }
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      const userData = {
        id: user.uid,
        email: user.email,
        name: user.displayName,
        photo: user.photoURL,
        emailVerified: user.emailVerified,
        provider: 'google'
      };
      callback(userData);
    } else {
      callback(null);
    }
  });
}

/**
 * Get the current user
 * @returns {Object|null} Current user or null if not signed in
 */
export function getCurrentUser() {
  const user = auth.currentUser;
  if (user) {
    return {
      id: user.uid,
      email: user.email,
      name: user.displayName,
      photo: user.photoURL,
      emailVerified: user.emailVerified,
      provider: 'google'
    };
  }
  return null;
}

// Export auth instance for advanced use cases
export { auth, googleProvider };

export default {
  signInWithGoogle,
  signInWithGoogleRedirect,
  handleRedirectResult,
  logOut,
  onAuthChange,
  getCurrentUser,
  auth
};
