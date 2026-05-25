// ============================================================
// Auth Widget — Floating Login Button for ALL pages
// Inject this script in every HTML page
// ============================================================
(function() {
    const firebaseConfig = {
        apiKey: "AIzaSyCglO0vHutINDOWaIWMsv4N9_54dpbPvIo",
        authDomain: "project-8621d575-e2f7-45a2-963.firebaseapp.com",
        databaseURL: "https://project-8621d575-e2f7-45a2-963-default-rtdb.firebaseio.com",
        projectId: "project-8621d575-e2f7-45a2-963",
        storageBucket: "project-8621d575-e2f7-45a2-963.firebasestorage.app",
        messagingSenderId: "756626829965",
        appId: "1:756626829965:web:8350120f4308ba5c11a8c4"
    };

    // ---- Inject CSS ----
    const style = document.createElement('style');
    style.textContent = `
        #sachin-auth-float {
            position: fixed; bottom: 80px; right: 16px; z-index: 9999;
            display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
        }
        #authFloatBtn {
            display: flex; align-items: center; gap: 8px;
            background: linear-gradient(135deg, #1e1b4b, #312e81);
            border: 1.5px solid rgba(99,102,241,0.5);
            border-radius: 40px; padding: 8px 16px 8px 8px;
            cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            transition: all 0.2s; text-decoration: none; color: #e1e7f0;
            font-family: 'Segoe UI', sans-serif; font-size: 0.85rem; font-weight: 600;
            min-width: 110px;
        }
        #authFloatBtn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(99,102,241,0.4); border-color: rgba(99,102,241,0.9); }
        #authFloatBtn.logged-in { background: linear-gradient(135deg, #064e3b, #065f46); border-color: rgba(16,185,129,0.5); }
        #authFloatBtn.logged-in:hover { box-shadow: 0 6px 28px rgba(16,185,129,0.3); }
        #authAvatar {
            width: 30px; height: 30px; border-radius: 50%;
            background: linear-gradient(135deg,#6366f1,#7c3aed);
            display: flex; align-items: center; justify-content: center;
            font-size: 0.85rem; font-weight: 700; color: #fff; flex-shrink: 0; overflow: hidden;
        }
        #authAvatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        #authName { white-space: nowrap; overflow: hidden; max-width: 90px; text-overflow: ellipsis; }

        /* Block Modal */
        #sachin-block-modal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.9);
            z-index: 99999; display: none; align-items: center; justify-content: center; padding: 20px;
        }
        #sachin-block-modal.show { display: flex; }
        .sblock-box {
            background: #0d1225; border: 1px solid rgba(239,68,68,0.4);
            border-radius: 24px; padding: 28px 24px; max-width: 360px; width: 100%; text-align: center;
            font-family: 'Segoe UI', sans-serif;
        }
        .sblock-icon { font-size: 3rem; margin-bottom: 12px; }
        .sblock-title { font-size: 1.1rem; font-weight: 800; color: #fca5a5; margin-bottom: 8px; }
        .sblock-sub { font-size: 0.85rem; color: #64748b; line-height: 1.6; margin-bottom: 20px; }
        .sblock-countdown { font-size: 1rem; font-weight: 700; color: #f87171; margin-bottom: 20px; }
        .sblock-login-btn {
            width: 100%; padding: 13px; border-radius: 14px; border: none;
            background: linear-gradient(135deg,#6366f1,#7c3aed); color: #fff;
            font-size: 0.95rem; font-weight: 700; cursor: pointer; font-family: inherit;
            margin-bottom: 10px; transition: all 0.2s;
        }
        .sblock-login-btn:hover { box-shadow: 0 0 20px rgba(99,102,241,0.4); }
        .sblock-close {
            width: 100%; padding: 11px; border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.08); background: transparent;
            color: #475569; font-size: 0.85rem; cursor: pointer; font-family: inherit;
        }

        /* Login Required Modal */
        #sachin-login-modal {
            position: fixed; inset: 0; background: rgba(0,0,0,0.88);
            z-index: 99998; display: none; align-items: center; justify-content: center; padding: 20px;
        }
        #sachin-login-modal.show { display: flex; }
        .slogin-box {
            background: #0d1225; border: 1px solid rgba(99,102,241,0.4);
            border-radius: 24px; padding: 28px 24px; max-width: 360px; width: 100%; text-align: center;
            font-family: 'Segoe UI', sans-serif;
        }
        .slogin-icon { font-size: 2.5rem; margin-bottom: 12px; }
        .slogin-title { font-size: 1.1rem; font-weight: 800; color: #e1e7f0; margin-bottom: 8px; }
        .slogin-sub { font-size: 0.85rem; color: #64748b; line-height: 1.6; margin-bottom: 20px; }
        .slogin-btn {
            width: 100%; padding: 13px; border-radius: 14px; border: none;
            background: linear-gradient(135deg,#6366f1,#7c3aed); color: #fff;
            font-size: 0.95rem; font-weight: 700; cursor: pointer; font-family: inherit;
            margin-bottom: 10px; transition: all 0.2s; text-decoration: none; display: block;
        }
        .slogin-btn:hover { box-shadow: 0 0 20px rgba(99,102,241,0.4); }
        .slogin-close {
            width: 100%; padding: 11px; border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.08); background: transparent;
            color: #475569; font-size: 0.85rem; cursor: pointer; font-family: inherit;
        }
    `;
    document.head.appendChild(style);

    // ---- Inject Floating Button (only if not suppressed) ----
    if (!window.SACHIN_HIDE_FLOAT) {
        const floatWrap = document.createElement('div');
        floatWrap.id = 'sachin-auth-float';
        floatWrap.innerHTML = `
            <a id="authFloatBtn" href="auth.html" title="Login / Sign Up">
                <div id="authAvatar">👤</div>
                <span id="authName">Login</span>
            </a>
        `;
        document.body.appendChild(floatWrap);
    }

    // ---- Inject Block Modal ----
    const blockModal = document.createElement('div');
    blockModal.id = 'sachin-block-modal';
    blockModal.innerHTML = `
        <div class="sblock-box">
            <div class="sblock-icon">🚫</div>
            <div class="sblock-title">48 घंटे के लिए Block!</div>
            <div class="sblock-sub">आपने बहुत ज्यादा tools use किए।<br>Login करके Pro Plan लो — Unlimited Access पाओ।</div>
            <div class="sblock-countdown" id="blockCountdown">⏳ Loading...</div>
            <button class="sblock-login-btn" onclick="window.location.href='auth.html?from='+encodeURIComponent(window.location.href)">🔑 Login करें — Pro देखें</button>
            <button class="sblock-close" onclick="document.getElementById('sachin-block-modal').classList.remove('show')">बाद में</button>
        </div>
    `;
    document.body.appendChild(blockModal);

    // ---- Inject Login Required Modal ----
    const loginModal = document.createElement('div');
    loginModal.id = 'sachin-login-modal';
    loginModal.innerHTML = `
        <div class="slogin-box">
            <div class="slogin-icon">🔐</div>
            <div class="slogin-title">Login करना होगा!</div>
            <div class="slogin-sub" id="loginModalSub">आपकी Free limit खत्म हो गई।<br>Login करके ज्यादा use करो — बिल्कुल फ्री!</div>
            <a class="slogin-btn" id="loginModalBtn" href="auth.html">🚀 Login / Sign Up करें</a>
            <button class="slogin-close" onclick="document.getElementById('sachin-login-modal').classList.remove('show')">बाद में</button>
        </div>
    `;
    document.body.appendChild(loginModal);

    // ---- Firebase SDK (dynamic import) ----
    let currentUser = null;
    let userPlan = 'free';
    let authInitialized = false;
    const pendingCallbacks = [];

    function onAuthReady(cb) {
        if (authInitialized) cb(currentUser);
        else pendingCallbacks.push(cb);
    }

    // Load Firebase dynamically
    Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js')
    ]).then(([{ initializeApp }, { getAuth, onAuthStateChanged, signOut }, { getDatabase, ref, get, set, serverTimestamp }]) => {

        const app = initializeApp(firebaseConfig, 'sachin-widget');
        const auth = getAuth(app);
        const db = getDatabase(app);

        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                // Load plan
                try {
                    const snap = await get(ref(db, `users/${user.uid}/plan`));
                    userPlan = snap.exists() ? snap.val() : 'free';
                    // Create user record if new
                    const usnap = await get(ref(db, `users/${user.uid}`));
                    if (!usnap.exists()) {
                        await set(ref(db, `users/${user.uid}`), {
                            name: user.displayName || '',
                            email: user.email || '',
                            plan: 'free',
                            createdAt: Date.now(),
                            activity: {}
                        });
                    }
                } catch(e) {}
            } else {
                userPlan = 'free';
            }

            authInitialized = true;
            pendingCallbacks.forEach(cb => cb(user));
            pendingCallbacks.length = 0;
            updateUI(user);
        });

        function updateUI(user) {
            // Update floating button if present
            const btn = document.getElementById('authFloatBtn');
            if (btn) {
                const avatar = document.getElementById('authAvatar');
                const name = document.getElementById('authName');
                if (user) {
                    const photoUrl = user.photoURL;
                    const displayName = user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'User';
                    if (photoUrl) {
                        avatar.innerHTML = `<img src="${photoUrl}" alt="avatar" onerror="this.parentNode.textContent='${displayName.charAt(0).toUpperCase()}'">`;
                    } else {
                        avatar.textContent = displayName.charAt(0).toUpperCase();
                    }
                    name.textContent = displayName.split(' ')[0].slice(0, 10);
                    btn.classList.add('logged-in');
                    btn.title = displayName + (userPlan === 'pro' ? ' ⭐ PRO' : ' · Free');
                } else {
                    avatar.textContent = '👤';
                    name.textContent = 'Login';
                    btn.classList.remove('logged-in');
                }
            }
            // Update 3-dot menu auth section if present
            if (typeof window.updateMenuAuth === 'function') {
                window.updateMenuAuth(user, userPlan);
            }
        }

        // Expose signOut for menu logout button
        window._sachinSignOut = () => signOut(auth).catch(() => {});

        // ---- Activity Check + Track ----
        const GUEST_LIMITS = { video: 2, image: 5, tool: 10 };
        const LOGGED_LIMITS = { video: 4, image: 15, tool: 30 };
        const BLOCK_LIMITS  = { video: 10, image: 40, tool: 80 };
        const BLOCK_HOURS = 48;

        async function checkActivity(type) {
            if (userPlan === 'pro') return { allowed: true };

            const now = Date.now();
            const guestLimit = GUEST_LIMITS[type] || 5;
            const loggedLimit = LOGGED_LIMITS[type] || 20;
            const blockLimit  = BLOCK_LIMITS[type]  || 60;

            if (!currentUser) {
                // Guest check via localStorage
                const key = `sachin_g_${type}`;
                let d = {};
                try { d = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) {}
                if (now - (d.t || 0) > 86400000) d = { c: 0, t: now };
                if ((d.c || 0) >= guestLimit) {
                    return { allowed: false, needLogin: true, guestLimit };
                }
                d.c = (d.c || 0) + 1;
                localStorage.setItem(key, JSON.stringify(d));
                return { allowed: true, count: d.c, limit: guestLimit };
            }

            // Logged-in check via Firebase DB
            try {
                const actRef = ref(db, `users/${currentUser.uid}/activity/${type}`);
                const snap = await get(actRef);
                let d = snap.exists() ? snap.val() : { c: 0, t: now, blockedUntil: 0 };

                // Check block
                if (d.blockedUntil && now < d.blockedUntil) {
                    const hoursLeft = Math.ceil((d.blockedUntil - now) / 3600000);
                    showBlockModal(d.blockedUntil);
                    return { allowed: false, blocked: true, hoursLeft };
                }

                // Reset window if 24h passed
                if (now - (d.t || 0) > 86400000) d = { c: 0, t: now, blockedUntil: 0 };

                // Check block threshold
                if ((d.c || 0) >= blockLimit) {
                    const blockedUntil = now + BLOCK_HOURS * 3600000;
                    const { update } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
                    await update(actRef, { blockedUntil });
                    showBlockModal(blockedUntil);
                    return { allowed: false, blocked: true, hoursLeft: BLOCK_HOURS };
                }

                // Increment
                const { update } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
                await update(actRef, { c: (d.c || 0) + 1, t: d.t || now });
                return { allowed: true, count: (d.c || 0) + 1, limit: loggedLimit };

            } catch(e) {
                return { allowed: true };
            }
        }

        // ---- Block Modal countdown ----
        let countdownTimer = null;
        function showBlockModal(blockedUntil) {
            document.getElementById('sachin-block-modal').classList.add('show');
            if (countdownTimer) clearInterval(countdownTimer);
            function tick() {
                const left = blockedUntil - Date.now();
                if (left <= 0) {
                    clearInterval(countdownTimer);
                    document.getElementById('blockCountdown').textContent = '✅ Block खत्म हो गया! Refresh करें।';
                    return;
                }
                const h = Math.floor(left / 3600000);
                const m = Math.floor((left % 3600000) / 60000);
                const s = Math.floor((left % 60000) / 1000);
                document.getElementById('blockCountdown').textContent = `⏳ ${h}h ${m}m ${s}s बाकी`;
            }
            tick();
            countdownTimer = setInterval(tick, 1000);
        }

        // ---- Login Required Modal ----
        function showLoginModal(msg) {
            const sub = document.getElementById('loginModalSub');
            if (sub && msg) sub.textContent = msg;
            const btn = document.getElementById('loginModalBtn');
            if (btn) btn.href = 'auth.html?from=' + encodeURIComponent(window.location.href) + '&redirect=1';
            document.getElementById('sachin-login-modal').classList.add('show');
        }

        // ---- Expose globally ----
        window.SachinAuth = {
            onAuthReady,
            checkActivity,
            showLoginModal,
            showBlockModal,
            isLoggedIn: () => !!currentUser,
            getUser: () => currentUser,
            getPlan: () => userPlan,
        };

    }).catch(err => {
        console.warn('Firebase widget load error:', err.message);
        // Still show login button even if Firebase fails
    });

})();
