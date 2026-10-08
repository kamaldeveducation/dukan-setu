import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBslwK2X2IafJ_IHLbrijP0Ow4U9EdEoPQ",
  authDomain: "mukesh-kirana-store.firebaseapp.com",
  projectId: "mukesh-kirana-store",
  storageBucket: "mukesh-kirana-store.firebasestorage.app",
  messagingSenderId: "481568981120",
  appId: "1:481568981120:web:b0ca9d33e6cd83be296665",
  measurementId: "G-NJ7HHRMWYC"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;