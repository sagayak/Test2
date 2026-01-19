import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyCrEtn3VZcPCAtZCh4UkKyQJjA_xXuHL88",
  authDomain: "csanbadm.firebaseapp.com",
  projectId: "csanbadm",
  storageBucket: "csanbadm.firebasestorage.app",
  messagingSenderId: "375900050576",
  appId: "1:375900050576:web:3ae979a1898675decdf415",
  measurementId: "G-Q00Y2G0CZQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);