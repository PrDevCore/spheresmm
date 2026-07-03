import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || "(default)";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId and experimental long polling for proxy compatibility
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Validation function as per skill guidelines
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Firestore connection test completed.");
  } catch (error: any) {
    if (error && (error.code === "permission-denied" || (error.message && error.message.includes("permissions")))) {
      console.log("Firestore connection test: Reachable (Security rules active).");
    } else if (error instanceof Error && error.message.includes("client is offline")) {
      console.warn("Please check your Firebase configuration. The client is offline.");
    } else {
      console.log("Firestore connection test status:", error);
    }
  }
}

// Monitor auth state changes to let the React application handle authentication screens
export function initAuth(onUserReady: (user: ReturnType<typeof getAuth>["currentUser"]) => void) {
  onAuthStateChanged(auth, (user) => {
    onUserReady(user);
  });
}
