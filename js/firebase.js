import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged as _onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAI0Py32oo0sIRJLlaO3mrUpM4elluXXkc",
  authDomain: "newproject-ba4be.firebaseapp.com",
  databaseURL: "https://newproject-ba4be-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "newproject-ba4be",
  storageBucket: "newproject-ba4be.firebasestorage.app",
  messagingSenderId: "655067082683",
  appId: "1:655067082683:web:0b2d63e780e84fbcd41e9e",
  measurementId: "G-P9DJ9SD2HE",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// --- Auth Helper Functions ---

/**
 * Set auth persistence based on "Remember Me" preference.
 * LOCAL  = persists after browser close (remember me ON)
 * SESSION = cleared when tab/browser closes (remember me OFF)
 */
export async function setRememberMe(remember) {
  const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
}

/**
 * Sign up with email & password, then set the user's display name.
 */
export async function signUpWithEmail(name, email, password, remember = false) {
  await setRememberMe(remember);
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(result.user, { displayName: name });
  }
  return result.user;
}

/**
 * Sign in with email & password.
 */
export async function signInWithEmail(email, password, remember = false) {
  await setRememberMe(remember);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Sign in with Google popup.
 */
export async function signInWithGoogle(remember = false) {
  await setRememberMe(remember);
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign out the current user.
 */
export async function signOutUser() {
  await signOut(auth);
}

/**
 * Send a password-reset email.
 */
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Subscribe to auth state changes.
 */
export function onAuthStateChanged(callback) {
  return _onAuthStateChanged(auth, callback);
}

export { auth };
