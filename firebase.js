// Firebase backend for Museum Detectives (replaces the old /api server).
// Loaded on demand by live.js; the service worker caches these files so the game still opens offline.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, signInAnonymously, initializeAuth, browserSessionPersistence,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, collection, doc, setDoc, updateDoc, getDoc, query, where, orderBy, limit,
  onSnapshot, getCountFromServer, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, STAFF_EMAIL, STAFF_PASSWORD_SHA256 } from './firebase-config.js';

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE')) {
  throw Error('The leaderboard is not set up yet (missing Firebase config).');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const runs = collection(db, 'runs');

// Score first, then fastest time. Equal sortKey = equal score and time = shared rank.
const SORT_SCALE = 10000000;
export const cohortKeyOf = cohort => String(cohort || '').trim().toLowerCase();
const ms = t => t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6);

async function user() {
  await auth.authStateReady();
  return auth.currentUser || (await signInAnonymously(auth)).user;
}

// Start a run. The start time is set by Google's servers, not the phone clock.
export async function startRun(team, cohort) {
  const u = await user();
  const ref = doc(runs);
  const before = Date.now();
  await setDoc(ref, {
    uid: u.uid, team, cohort, cohortKey: cohortKeyOf(cohort),
    startedAt: serverTimestamp(), completed: false
  });
  const snap = await getDoc(ref);
  const after = Date.now();
  const startedAt = ms(snap.data().startedAt);
  return { id: ref.id, startedAt, clockOffset: startedAt - Math.round((before + after) / 2) };
}

function resultOf(d) {
  return { score: d.score, durationSeconds: d.durationSeconds, completedAt: ms(d.completedAt) };
}

export async function getRun(id) {
  await user();
  const snap = await getDoc(doc(runs, id));
  if (!snap.exists()) throw Error('This hunt was not found. Start a new hunt.');
  const d = snap.data();
  return { startedAt: ms(d.startedAt), result: d.completed ? resultOf(d) : null };
}

// Finish in two safe steps: (1) stop the clock with the server time, (2) record the
// exact duration. Retrying after a dropped connection picks up where it stopped.
export async function finishRun(id, score) {
  await user();
  const ref = doc(runs, id);
  let d = (await getDoc(ref)).data();
  if (d.completed) return resultOf(d);
  if (!d.completedAt) {
    await updateDoc(ref, { score, completedAt: serverTimestamp() });
    d = (await getDoc(ref)).data();
  }
  const durationSeconds = Math.floor((ms(d.completedAt) - ms(d.startedAt)) / 1000);
  await updateDoc(ref, { durationSeconds, sortKey: d.score * SORT_SCALE - durationSeconds, completed: true });
  return resultOf({ ...d, durationSeconds });
}

function ranked(rows) {
  let rank = 0, prev = null;
  return rows.map((r, i) => {
    if (r.sortKey !== prev) { rank = i + 1; prev = r.sortKey; }
    return { ...r, rank };
  });
}

// Live leaderboard. Calls onData({entries, personal}) whenever results change.
export function watchLeaderboard({ cohort, mine }, onData, onError) {
  const key = cohortKeyOf(cohort);
  const q = key
    ? query(runs, where('cohortKey', '==', key), limit(1000))
    : query(runs, orderBy('sortKey', 'desc'), limit(100));
  return onSnapshot(q, async snap => {
    try {
      const all = ranked(snap.docs.map(s => ({ id: s.id, ...s.data() }))
        .filter(r => r.completed)
        .sort((a, b) => b.sortKey - a.sortKey)
        .map(r => ({ id: r.id, team: r.team, cohort: r.cohort, score: r.score, duration_seconds: r.durationSeconds, sortKey: r.sortKey })));
      let personal = mine ? all.find(r => r.id === mine) || null : null;
      if (mine && !personal && !key) {
        const m = await getDoc(doc(runs, mine));
        const d = m.exists() && m.data();
        if (d && d.completed) {
          const ahead = await getCountFromServer(query(runs, where('sortKey', '>', d.sortKey)));
          personal = { rank: ahead.data().count + 1, score: d.score, duration_seconds: d.durationSeconds };
        }
      }
      onData({ entries: all.slice(0, 100), personal });
    } catch (e) { onError(e); }
  }, onError);
}

// ---------- Staff area ----------
// A separate Firebase app instance, so a staff sign-in never replaces a team's
// anonymous sign-in on the same phone. Staff sign-in lasts until the tab closes.
let staff = null;
function staffApp() {
  if (!staff) {
    const a = initializeApp(firebaseConfig, 'staff');
    staff = { auth: initializeAuth(a, { persistence: browserSessionPersistence }), db: getFirestore(a) };
  }
  return staff;
}

export function onStaffChange(cb) {
  return onAuthStateChanged(staffApp().auth, u => cb(!!u && u.email === STAFF_EMAIL));
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Staff only type the password. The hidden staff account is created automatically
// the first time the correct password is used, so there is nothing to set up in Firebase.
export async function staffSignIn(password) {
  if ((await sha256(password)) !== STAFF_PASSWORD_SHA256) throw Error('Incorrect password.');
  const { auth } = staffApp();
  try {
    await signInWithEmailAndPassword(auth, STAFF_EMAIL, password);
  } catch (e) {
    const c = e.code || '';
    if (c.includes('invalid-credential') || c.includes('user-not-found') || c.includes('wrong-password')) {
      try { await createUserWithEmailAndPassword(auth, STAFF_EMAIL, password); return; }
      catch (e2) {
        if ((e2.code || '').includes('email-already-in-use')) throw Error('Incorrect password.');
        throw e2;
      }
    }
    if (c.includes('too-many-requests')) throw Error('Too many attempts. Wait a few minutes and try again.');
    if (c.includes('operation-not-allowed')) throw Error('Staff sign-in is not switched on in Firebase (Email/Password).');
    throw e;
  }
}

export const staffSignOut = () => signOut(staffApp().auth);

// Every hunt, newest first, live.
export function watchAllRuns(onData, onError) {
  const q = query(collection(staffApp().db, 'runs'), orderBy('startedAt', 'desc'), limit(2000));
  return onSnapshot(q, snap => onData(snap.docs.map(s => {
    const d = s.data();
    return {
      id: s.id, team: d.team, cohort: d.cohort, completed: !!d.completed,
      startedAt: d.startedAt ? ms(d.startedAt) : null,
      score: d.score, durationSeconds: d.durationSeconds
    };
  })), onError);
}

export async function deleteRuns(ids) {
  const { db } = staffApp();
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach(id => batch.delete(doc(db, 'runs', id)));
    await batch.commit();
  }
}
