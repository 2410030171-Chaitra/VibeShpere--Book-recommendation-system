import React, { useState } from 'react';
import { signInWithGoogle } from '../services/firebaseAuth';

/**
 * GoogleSignInButton - Beautiful Google sign-in button component
 * Handles Google OAuth authentication with loading and error states
 */
export default function GoogleSignInButton({ onSuccess, onError, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userData = await signInWithGoogle();
      
      if (onSuccess) {
        onSuccess(userData);
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      const errorMessage = err.message || 'Failed to sign in with Google';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`google-signin-wrapper ${className}`}>
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className={`
          google-signin-button
          w-full flex items-center justify-center gap-3
          px-6 py-3 rounded-xl
          bg-white border-2 border-slate-200
          font-medium text-slate-700
          transition-all duration-200
          hover:bg-slate-50 hover:border-slate-300 hover:shadow-md
          disabled:opacity-50 disabled:cursor-not-allowed
          ${loading ? 'cursor-wait' : 'cursor-pointer'}
        `}
        aria-label="Sign in with Google"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            {/* Google Logo SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <div className="flex items-start gap-2">
            <span className="text-red-500">⚠️</span>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Google Sign-In Button (for nav bars, etc.)
 */
export function CompactGoogleSignInButton({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const userData = await signInWithGoogle();
      if (onSuccess) onSuccess(userData);
    } catch (err) {
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSignIn}
      disabled={loading}
      className="
        compact-google-button
        flex items-center gap-2 px-4 py-2 rounded-lg
        bg-white border border-slate-200
        text-sm font-medium text-slate-700
        hover:bg-slate-50 hover:shadow-sm
        transition-all duration-200
        disabled:opacity-50
      "
      title="Sign in with Google"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      <span>Google</span>
    </button>
  );
}
