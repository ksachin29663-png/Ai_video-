// ============================================================
// Firebase Auth Manager — Sachin AI Photo Studio
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getDatabase,
    ref,
    get,
    set,
    update,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyCglO0vHutINDOWaIWMsv4N9_54dpbPvIo",
    authDomain: "project-8621d575-e2f7-45a2-963.firebaseapp.com",
    databaseURL: "https://project-8621d575-e2f7-45a2-963-default-rtdb.firebaseio.com",
    projectId: "project-8621d575-e2f7-45a2-963",
    storageBucket: "project-8621d575-e2f7-45a2-963.firebasestorage.app",
    messagingSenderId: "756626829965",
    appId: "1:756626829965:web:8350120f4308ba5c11a8c4",
    measurementId: "G-LQGMWFHVEW"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

// ---- Activity Limits ----
const LIMITS = {
    video:   { free: 4,   block: 10,  key: 'video' },
    image:   { free: 10,  block: 30,  key: 'image' },
    tool:    { free: 20,  block: 60,  key: 'tool'  },
};
const BLOCK_HOURS = 48;
const GUEST_LIMITS = { video: 2, image: 5, tool: 10 };

// ---- Current user state ----
let currentUser = null;
let userPlan = 'free'; // 'free' | 'pro'
let authReady = false;
const authReadyCallbacks = [];

function onAuthReady(cb) {
    if (authReady) cb(currentUser);
    else authReadyCallbacks.push(cb);
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        await loadUserData(user);
    }
    authReady = true;
    authReadyCallbacks.forEach(cb => cb(user));
    authReadyCallbacks.length = 0;
    updateAuthUI();
});

// ---- Load user data from Realtime DB ----
async function loadUserData(user) {
    try {
        const snap = await get(ref(db, `users/${user.uid}`));
        if (snap.exists()) {
            const data = snap.val();
            userPlan = data.plan || 'free';
        } else {
            // First-time user
            await set(ref(db, `users/${user.uid}`), {
                name: user.displayName || '',
                email: user.email || '',
                phone: user.phoneNumber || '',
                plan: 'free',
                createdAt: serverTimestamp(),
                activity: {}
            });
            userPlan = 'free';
        }
    } catch(e) {
        console.warn('DB load error:', e.message);
    }
}

// ---- Activity Tracking ----
async function checkAndTrackActivity(type) {
    // Pro users — no limits
    if (currentUser && userPlan === 'pro') return { allowed: true };

    const limit = LIMITS[type] || LIMITS.tool;
    const now = Date.now();

    if (currentUser) {
        // Logged-in free user — use Firebase DB
        try {
            const actRef = ref(db, `users/${currentUser.uid}/activity/${type}`);
            const snap = await get(actRef);
            let data = snap.exists() ? snap.val() : { count: 0, windowStart: now, blockedUntil: 0 };

            // Check block
            if (data.blockedUntil && now < data.blockedUntil) {
                const hoursLeft = Math.ceil((data.blockedUntil - now) / 3600000);
                return { allowed: false, blocked: true, hoursLeft, needLogin: false };
            }

            // Reset window if 24h passed
            if (now - (data.windowStart || 0) > 86400000) {
                data = { count: 0, windowStart: now, blockedUntil: 0 };
            }

            // Check limit
            if (data.count >= limit.block) {
                const blockedUntil = now + BLOCK_HOURS * 3600000;
                await update(actRef, { blockedUntil });
                return { allowed: false, blocked: true, hoursLeft: BLOCK_HOURS, needLogin: false };
            }

            // Increment
            await update(actRef, { count: (data.count || 0) + 1, windowStart: data.windowStart || now });
            return { allowed: true, count: data.count + 1, limit: limit.block };

        } catch(e) {
            return { allowed: true }; // allow on DB error
        }
    } else {
        // Guest — localStorage
        const guestLimit = GUEST_LIMITS[type] || 5;
        const key = `sachin_guest_${type}`;
        let gData = {};
        try { gData = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) {}

        if (now - (gData.windowStart || 0) > 86400000) {
            gData = { count: 0, windowStart: now };
        }
        if ((gData.count || 0) >= guestLimit) {
            return { allowed: false, blocked: false, needLogin: true, guestLimit };
        }
        gData.count = (gData.count || 0) + 1;
        localStorage.setItem(key, JSON.stringify(gData));
        return { allowed: true, count: gData.count, limit: guestLimit };
    }
}

// ---- Google Sign-In ----
async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        return { success: true, user: result.user };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

// ---- Email Sign Up ----
async function signUpWithEmail(email, password, name) {
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        await set(ref(db, `users/${cred.user.uid}/name`), name || '');
        return { success: true, user: cred.user };
    } catch(e) {
        let msg = e.message;
        if (e.code === 'auth/email-already-in-use') msg = 'यह Email पहले से registered है।';
        if (e.code === 'auth/weak-password') msg = 'Password कम से कम 6 characters का होना चाहिए।';
        if (e.code === 'auth/invalid-email') msg = 'Valid Email address डालें।';
        return { success: false, error: msg };
    }
}

// ---- Email Sign In ----
async function signInWithEmail(email, password) {
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: cred.user };
    } catch(e) {
        let msg = e.message;
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = 'Email या Password गलत है।';
        if (e.code === 'auth/too-many-requests') msg = 'बहुत ज्यादा attempts। थोड़ी देर बाद try करें।';
        return { success: false, error: msg };
    }
}

// ---- Sign Out ----
async function doSignOut() {
    await signOut(auth);
    currentUser = null;
    userPlan = 'free';
    updateAuthUI();
}

// ---- Update Auth UI (floating button on all pages) ----
function updateAuthUI() {
    const btn = document.getElementById('authFloatBtn');
    const avatar = document.getElementById('authAvatar');
    const name = document.getElementById('authName');
    if (!btn) return;

    if (currentUser) {
        const photoUrl = currentUser.photoURL;
        const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
        if (avatar) {
            if (photoUrl) {
                avatar.innerHTML = `<img src="${photoUrl}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`;
            } else {
                avatar.textContent = displayName.charAt(0).toUpperCase();
            }
        }
        if (name) name.textContent = displayName.split(' ')[0];
        btn.classList.add('logged-in');
        btn.title = displayName + (userPlan === 'pro' ? ' (PRO)' : ' (Free)');
    } else {
        if (avatar) avatar.textContent = '👤';
        if (name) name.textContent = 'Login';
        btn.classList.remove('logged-in');
        btn.title = 'Login / Sign Up';
    }
}

// ---- Exports ----
window.SachinAuth = {
    onAuthReady,
    checkAndTrackActivity,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    doSignOut,
    getUser: () => currentUser,
    getPlan: () => userPlan,
    isLoggedIn: () => !!currentUser,
    updateAuthUI,
    BLOCK_HOURS,
    GUEST_LIMITS,
    LIMITS,
};
