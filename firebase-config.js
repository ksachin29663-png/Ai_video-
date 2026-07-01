import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYIOpjA-7nBiV6FCivGlbr4oMX-CYAufg",
  authDomain: "appmarket24.firebaseapp.com",
  projectId: "appmarket24",
  storageBucket: "appmarket24.firebasestorage.app",
  messagingSenderId: "699175743000",
  appId: "1:699175743000:web:d63161e0b68a9c5e9edd6d",
  measurementId: "G-0EXYBEKL3S"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

export { database, storage };
  
