import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const email = `test-${Date.now()}@example.com`;
    console.log("Registering", email);
    const result = await createUserWithEmailAndPassword(auth, email, 'password123');
    await updateProfile(result.user, { displayName: 'Test User' });
    
    const newUser = {
      userId: 'STU-123456',
      firebaseUid: result.user.uid,
      fullName: 'Test User',
      email: email,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      loginCount: 1,
      provider: 'email',
      role: 'Student'
    };
    
    await setDoc(doc(db, 'users', result.user.uid), newUser);
    console.log("Successfully registered and stored in Firestore");
  } catch (e) {
    console.error("Error:", e.code, e.message);
  }
}

test();
