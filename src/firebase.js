import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBqIh6DWk8hK0jpoZNhMbKyDEo0C50FzWs",
  authDomain: "anniversary-wordle.firebaseapp.com",
  databaseURL: "https://anniversary-wordle-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anniversary-wordle",
  storageBucket: "anniversary-wordle.firebasestorage.app",
  messagingSenderId: "382965640438",
  appId: "1:382965640438:web:29d16d85d2ae0ec375d0d7"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);