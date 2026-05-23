(function () {
    'use strict';

    var FREE_USES = 5;
    var UNLOCK_USES = 10;
    var STORAGE_KEY = 'sachin_uses';
    var SHARE_KEY = 'sachin_shared';
    var SITE_URL = 'https://ksachin29663-png.github.io/Ai_video-/';
    var SITE_NAME = 'सचिन एआई फोटो स्टूडियो';
    var SHARE_TEXT = '🤩 यह AI Website देखो! 36+ Free AI Tools एक जगह पर!\n🔗 ' + SITE_URL + '\n#AI #FreeTools #SachinAI';

    // Pages that are NOT tools (don't count/block)
    var EXEMPT_PAGES = ['index.html', '', '/', 'analytics.html', 'premium.html'];

    function getPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    function isExempt() {
        var p = getPage();
        return EXEMPT_PAGES.indexOf(p) !== -1;
    }

    function getUses() {
        return parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    }

    function setUses(n) {
        localStorage.setItem(STORAGE_KEY, n);
    }

    function getSharedCount() {
        return parseInt(localStorage.getItem(SHARE_KEY) || '0');
    }

    function setSharedCount(n) {
        localStorage.setItem(SHARE_KEY, n);
    }

    function getAllowedUses() {
        var shared = getSharedCount();
        return FREE_USES + (shared * UNLOCK_USES);
    }

    function isLocked() {
        if (isExempt()) return false;
        return getUses() >= getAllowedUses();
    }

    function incrementUse() {
        if (isExempt()) return;
        setUses(getUses() + 1);
    }

    // ---- UI Styles ----
    function injectStyles() {
        if (document.getElementById('su-styles')) return;
        var style = document.createElement('style');
        style.id = 'su-styles';
        style.textContent = [
            '#su-overlay{position:fixed;inset:0;background:rgba(8,12,22,0.92);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;}',
            '#su-box{background:linear-gradient(135deg,#0d1225,#1a0a2e);border:1px solid rgba(124,58,237,0.4);border-radius:24px;padding:32px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 0 60px rgba(124,58,237,0.3);}',
            '#su-box .su-emoji{font-size:3.5rem;margin-bottom:12px;display:block;animation:su-bounce 1s ease infinite alternate;}',
            '@keyframes su-bounce{from{transform:translateY(0)}to{transform:translateY(-8px)}}',
            '#su-box h2{font-size:1.3rem;font-weight:900;color:#fff;margin-bottom:8px;line-height:1.3;}',
            '#su-box p{font-size:0.85rem;color:#94a3b8;margin-bottom:20px;line-height:1.6;}',
            '#su-box .su-counter{background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:12px;padding:12px;margin-bottom:20px;font-size:0.82rem;color:#a78bfa;}',
            '#su-box .su-counter b{color:#fff;font-size:1.1rem;}',
            '.su-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;border-radius:14px;border:none;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;transition:all 0.2s;text-decoration:none;}',
            '.su-wa{background:linear-gradient(135deg,#25d366,#128c3e);color:#fff;}',
            '.su-wa:hover{box-shadow:0 0 20px rgba(37,211,102,0.5);transform:translateY(-2px);}',
            '.su-ig{background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;}',
            '.su-ig:hover{box-shadow:0 0 20px rgba(220,39,67,0.5);transform:translateY(-2px);}',
            '.su-copy{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15)!important;color:#e1e7f0;}',
            '.su-copy:hover{background:rgba(255,255,255,0.12);}',
            '.su-skip{background:transparent;border:none;color:#475569;font-size:0.75rem;cursor:pointer;font-family:inherit;margin-top:6px;padding:6px;width:100%;}',
            '.su-skip:hover{color:#94a3b8;}',
            '#su-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#7c3aed;color:#fff;padding:12px 24px;border-radius:12px;font-size:0.85rem;font-weight:700;z-index:999999;opacity:0;transition:opacity 0.3s;pointer-events:none;white-space:nowrap;}',
            '#su-bar{position:fixed;bottom:0;left:0;right:0;background:linear-gradient(135deg,#0d1225,#1a0a2e);border-top:1px solid rgba(124,58,237,0.3);padding:10px 16px;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:10px;}',
            '#su-bar .su-bar-text{font-size:0.75rem;color:#94a3b8;flex:1;}',
            '#su-bar .su-bar-text b{color:#a78bfa;}',
            '#su-bar .su-bar-btn{padding:8px 16px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none;border-radius:10px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;}',
            '.su-prog{height:4px;background:rgba(255,255,255,0.06);border-radius:4px;margin:10px 0;overflow:hidden;}',
            '.su-prog-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#00ffcc);border-radius:4px;transition:width 0.5s ease;}'
        ].join('');
        document.head.appendChild(style);
    }

    function showToast(msg) {
        var t = document.getElementById('su-toast');
        if (!t) { t = document.createElement('div'); t.id = 'su-toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.style.opacity = '1';
        setTimeout(function () { t.style.opacity = '0'; }, 2500);
    }

    function removeOverlay() {
        var o = document.getElementById('su-overlay');
        if (o) o.remove();
    }

    function onShareDone() {
        setSharedCount(getSharedCount() + 1);
        removeOverlay();
        showToast('🎉 शेयर के लिए धन्यवाद! ' + UNLOCK_USES + ' uses unlock हो गए!');
        updateBar();
        // Let the tool proceed
        setTimeout(function () {
            var ev = new CustomEvent('share-unlocked');
            document.dispatchEvent(ev);
        }, 300);
    }

    function shareWhatsApp() {
        var url = 'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT);
        window.open(url, '_blank');
        setTimeout(onShareDone, 1500);
    }

    function shareInstagram() {
        // Instagram doesn't support direct share URL, copy to clipboard instead
        copyLink();
        showToast('📋 Link copy हो गई! Instagram पर paste करें');
        setTimeout(onShareDone, 1500);
    }

    function copyLink() {
        var text = SHARE_TEXT;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
                showToast('✅ Link copy हो गई!');
                setTimeout(onShareDone, 1500);
            });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            showToast('✅ Link copy हो गई!');
            setTimeout(onShareDone, 1500);
        }
    }

    function nativeShare() {
        if (navigator.share) {
            navigator.share({ title: SITE_NAME, text: SHARE_TEXT, url: SITE_URL })
                .then(onShareDone)
                .catch(function () {});
        } else {
            copyLink();
        }
    }

    function showSharePopup() {
        injectStyles();
        removeOverlay();

        var uses = getUses();
        var allowed = getAllowedUses();
        var pct = Math.min(100, Math.round((uses / (allowed + UNLOCK_USES)) * 100));

        var overlay = document.createElement('div');
        overlay.id = 'su-overlay';
        overlay.innerHTML =
            '<div id="su-box">' +
            '<span class="su-emoji">🔒</span>' +
            '<h2>Free Uses खत्म हो गए!</h2>' +
            '<p>आपने <b>' + uses + ' tools use कर लिए।</b><br>सिर्फ <b>शेयर करो</b> और <b>' + UNLOCK_USES + ' और uses</b> unlock पाओ — बिल्कुल मुफ्त!</p>' +
            '<div class="su-counter">🎯 अभी तक: <b>' + uses + '</b> tools used &nbsp;|&nbsp; Next unlock: <b>+' + UNLOCK_USES + ' uses</b></div>' +
            '<div class="su-prog"><div class="su-prog-fill" style="width:' + pct + '%"></div></div>' +
            '<button class="su-btn su-wa" onclick="window.__suWA()">📱 WhatsApp पर Share करें</button>' +
            '<button class="su-btn su-ig" onclick="window.__suIG()">📸 Instagram के लिए Copy करें</button>' +
            '<button class="su-btn su-copy" onclick="window.__suCopy()">🔗 Link Copy करें</button>' +
            (navigator.share ? '<button class="su-btn su-copy" onclick="window.__suNative()" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;">📤 और तरीकों से Share करें</button>' : '') +
            '<button class="su-skip" onclick="window.__suSkip()">बाद में करूंगा (सिर्फ 1 use मिलेगा)</button>' +
            '</div>';

        document.body.appendChild(overlay);

        window.__suWA = shareWhatsApp;
        window.__suIG = shareInstagram;
        window.__suCopy = copyLink;
        window.__suNative = nativeShare;
        window.__suSkip = function () {
            // Give 1 grace use
            setUses(getUses() - 1);
            removeOverlay();
            updateBar();
        };
    }

    function updateBar() {
        if (isExempt()) return;
        var bar = document.getElementById('su-bar');
        var uses = getUses();
        var allowed = getAllowedUses();
        var remaining = Math.max(0, allowed - uses);
        var pct = Math.min(100, Math.round((uses / allowed) * 100));

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'su-bar';
            document.body.appendChild(bar);
        }

        bar.innerHTML =
            '<div class="su-bar-text">' +
            '<div class="su-prog" style="margin:0 0 4px 0;"><div class="su-prog-fill" style="width:' + pct + '%"></div></div>' +
            '🆓 <b>' + remaining + ' free uses</b> बचे हैं' +
            '</div>' +
            '<button class="su-bar-btn" onclick="window.__suShowPopup()">🎁 Share करके Unlock करें</button>';

        window.__suShowPopup = showSharePopup;

        // Add bottom padding to body so bar doesn't cover content
        document.body.style.paddingBottom = '56px';
    }

    // ---- Main check on page load ----
    function init() {
        if (isExempt()) return;

        incrementUse();

        if (isLocked()) {
            // Wait for DOM to be ready before showing popup
            function show() {
                injectStyles();
                showSharePopup();
                updateBar();
            }
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', show);
            } else {
                show();
            }
        } else {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', updateBar);
            } else {
                updateBar();
            }
        }
    }

    init();
})();
