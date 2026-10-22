import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedCustomUser: Partial<User> | null = null;
let tokenExpiresAt: number = 0;

export interface StoredSession {
  accessToken: string;
  user: Partial<User>;
  savedAt: number;
  expiresAt: number;
}

// Global 401 / session expired callbacks
const sessionExpiredListeners = new Set<() => void>();

export const onSessionExpired = (listener: () => void) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

export const notifySessionExpired = () => {
  clearSession();
  sessionExpiredListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('Error in session expired listener:', e);
    }
  });
};

// Clear any stale access tokens from localStorage per the Google Workspace integration skill
try {
  localStorage.removeItem('gqueues_auth_session');
} catch {}

export const isTokenExpired = (): boolean => {
  if (!cachedAccessToken) return true;
  // If current time is beyond expiresAt (or within 2 minutes of expiring)
  return Date.now() > (tokenExpiresAt - 2 * 60 * 1000);
};

export const getStoredSession = (): StoredSession | null => {
  if (cachedAccessToken && cachedCustomUser) {
    return {
      accessToken: cachedAccessToken,
      user: cachedCustomUser,
      savedAt: Date.now(),
      expiresAt: tokenExpiresAt,
    };
  }
  return null;
};

export const saveSession = (
  user: Partial<User>,
  accessToken: string,
  expiresInSeconds: number = 3500
) => {
  cachedAccessToken = accessToken;
  cachedCustomUser = user;
  const now = Date.now();
  tokenExpiresAt = now + expiresInSeconds * 1000;
  // Clear any persistent storage to prevent expired token re-use
  try {
    localStorage.removeItem('gqueues_auth_session');
  } catch {}
};

export const clearSession = () => {
  cachedAccessToken = null;
  cachedCustomUser = null;
  tokenExpiresAt = 0;
  try {
    localStorage.removeItem('gqueues_auth_session');
  } catch {}
};

// Google Identity Services (GIS) fallback for direct Google OAuth
export const signInWithGIS = (
  clientId: string,
  scopes: string[]
): Promise<{ user: Partial<User>; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    const initClient = () => {
      try {
        const googleObj = (window as any).google;
        if (!googleObj?.accounts?.oauth2) {
          reject(new Error('Google Identity Services library not available'));
          return;
        }

        const tokenClient = googleObj.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: scopes.join(' '),
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                resolve({ user: {} as any, accessToken: '' });
                return;
              }
              reject(
                new Error(
                  `Google OAuth error: ${tokenResponse.error_description || tokenResponse.error}`
                )
              );
              return;
            }

            const token = tokenResponse.access_token;
            if (!token) {
              reject(new Error('No access token received from Google'));
              return;
            }

            const expiresIn = Number(tokenResponse.expires_in) || 3500;

            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              const profile = await res.json();
              const u: Partial<User> = {
                uid: profile.sub || 'workspace-user',
                displayName: profile.name || 'Google Workspace User',
                email: profile.email || '',
                photoURL: profile.picture || '',
              };
              saveSession(u, token, expiresIn);
              resolve({ user: u, accessToken: token });
            } catch {
              const u: Partial<User> = {
                uid: 'workspace-user',
                displayName: 'Google Workspace User',
                email: '',
              };
              saveSession(u, token, expiresIn);
              resolve({ user: u, accessToken: token });
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err) {
        reject(err);
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      initClient();
    } else {
      const existingScript = document.getElementById('google-gsi-client');
      if (existingScript) {
        existingScript.onload = () => initClient();
      } else {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => initClient();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
      }
    }
  });
};

/**
 * Ensures Google Identity Services (GIS) client script is injected and available
 */
export const ensureGISLoaded = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve(true);
      return;
    }
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      setTimeout(() => resolve(!!(window as any).google?.accounts?.oauth2), 3000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    setTimeout(() => resolve(!!(window as any).google?.accounts?.oauth2), 4000);
  });
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If we already have an in-memory valid token, notify immediately
  if (cachedAccessToken && !isTokenExpired()) {
    const u = (auth.currentUser || cachedCustomUser) as User;
    if (u && onAuthSuccess) {
      onAuthSuccess(u, cachedAccessToken);
    }
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken && !isTokenExpired()) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        clearSession();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearSession();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User | Partial<User>;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;

    // Try standard Firebase popup first
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        saveSession(result.user, credential.accessToken);
        return { user: result.user, accessToken: credential.accessToken };
      }
    } catch (firebaseErr: any) {
      const errCode = firebaseErr?.code || '';
      const errMsg = firebaseErr?.message || '';

      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request'
      ) {
        return null;
      }

      if (errCode === 'auth/popup-blocked') {
        throw new Error(
          'Sign-in popup was blocked by your browser. Please allow popups for this site, or click "Open in Direct Window" below.'
        );
      }

      // If unauthorized-domain, operation-not-allowed, or domain configuration issues occur:
      // fallback to Google Identity Services token client using OAuth client ID
      if (
        errCode === 'auth/unauthorized-domain' ||
        errCode === 'auth/operation-not-allowed' ||
        errCode === 'auth/configuration-not-found' ||
        errMsg.includes('unauthorized-domain')
      ) {
        console.warn('Firebase Auth unauthorized domain, falling back to Google Identity Services...');
        try {
          const gisResult = await signInWithGIS(firebaseConfig.oAuthClientId, SCOPES);
          if (!gisResult.accessToken) {
            return null;
          }
          return gisResult;
        } catch (gisErr: any) {
          console.warn('GIS fallback encountered error:', gisErr);
          if (gisErr?.message?.includes('popup') || gisErr?.message?.includes('blocked')) {
            throw new Error(
              'Sign-in popup was blocked by your browser. Please allow popups for this site, or open in a direct tab.'
            );
          }
          throw gisErr;
        }
      }

      throw firebaseErr;
    }

    return null;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    console.error('Google Sign-In failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  clearSession();
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error
  }
};
