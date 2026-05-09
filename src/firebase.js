import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "encurtador-links-alexandre",
  appId: "1:413406127873:web:02ce58ffa1056a732d5d00",
  storageBucket: "encurtador-links-alexandre.firebasestorage.app",
  apiKey: "AIzaSyDkXWRGYADsReTHJTEN6DHLIJzzEtpa38g",
  authDomain: "encurtador-links-alexandre.firebaseapp.com",
  messagingSenderId: "413406127873"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
