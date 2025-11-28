// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

// TODO: For production, move these credentials to environment variables to keep them secure.
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJwQETJqYhpl2VenU4VF17OKpv_HJ4JyA",
  authDomain: "wayne-ai-b38a8.firebaseapp.com",
  projectId: "wayne-ai-b38a8",
  storageBucket: "wayne-ai-b38a8.firebasestorage.app",
  messagingSenderId: "230406417045",
  appId: "1:230406417045:web:7d26e71d935121431d499c",
  measurementId: "G-6K6V446H3H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Re-export auth functions to be used across the app
export {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
};
