import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

let firebaseApp: FirebaseApp | null = null;
if (isFirebaseClientConfigured) {
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const googleAuthProvider: GoogleAuthProvider | null = firebaseApp
  ? new GoogleAuthProvider()
  : null;
