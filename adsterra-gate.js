(function () {
    'use strict';

    var AD_LINK = 'https://equipmentprecursorrecast.com/ncb0yuyf6?key=436563d721065acdf98cb1213a706f3a';
    var GATE_KEY = 'sachin_gate_';
    var GATE_TTL = 4 * 60 * 60 * 1000; // 4 hours per tool

    var EXEMPT = ['index.html', '', '/', 'analytics.html', 'premium.html'];

    function getPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    }

    function isExempt() {
        return EXEMPT.indexOf(getPage()) !== -1;
    }

    function isUnlocked() {
        var key = GATE_KEY + getPage();
        var ts = parseInt(localStorage.getItem(key) || '0');
        return Date.now() - ts < GATE_TTL;
    }

    function setUnlocked() {
        localStorage.setItem(GATE_KEY + getPage(), Date.now());
    }

    function injectStyles() {
        if (document.getElementById('ag-styles')) return;
        var s = document.createElement('style');
        s.id = 'ag-styles';
        s.textContent = [
            '#ag-overlay{position:fixed;inset:0;background:rgba(4,6,12,0.96);backdrop-filter:blur(10px);z-index:999998;display:flex;align-items:center;justify-content:center;padding:16px;}',
            '#ag-box{background:#0d1117;border:1px solid #30363d;border-radius:16px;padding:24px 20px;max-width:420px;width:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#c9d1d9;box-shadow:0 8px 40px rgba(0,0,0,0.6),0 0 0 1px rgba(48,54,61,0.5);}',
            '#ag-box .ag-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #21262d;padding-bottom:12px;margin-bottom:14px;}',
            '#ag-box .ag-title{display:flex;align-items:center;gap:8px;color:#58a6ff;font-size:1rem;font-weight:700;}',
            '#ag-box .ag-live{background:#238636;color:#fff;font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;letter-spacing:0.5px;animation:ag-pulse 1.5s ease infinite;}',
            '@keyframes ag-pulse{0%,100%{opacity:1}50%{opacity:0.6}}',
            '#ag-box .ag-ver{color:#8b949e;font-size:11px;}',
            '#ag-box .ag-code{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px 14px;font-family:"Courier New",Courier,monospace;font-size:12.5px;color:#79c0ff;margin-bottom:14px;line-height:1.7;}',
            '#ag-box .ag-warn{color:#8b949e;font-size:12.5px;text-align:center;margin:0 0 14px 0;line-height:1.5;background:rgba(210,153,34,0.08);border:1px solid rgba(210,153,34,0.2);border-radius:8px;padding:10px 12px;}',
            '#ag-box .ag-warn b{color:#e3b341;}',
            '.ag-unlock{display:block;width:100%;text-align:center;background:linear-gradient(135deg,#238636,#2ea44f);color:#fff !important;padding:13px;border-radius:8px;text-decoration:none !important;font-weight:700;font-size:14px;border:1px solid #2ea44f;box-sizing:border-box;margin-bottom:10px;transition:all 0.2s;letter-spacing:0.3px;}',
            '.ag-unlock:hover{box-shadow:0 0 20px rgba(46,164,79,0.5);transform:translateY(-1px);}',
            '.ag-row{display:flex;gap:8px;}',
            '.ag-btn{flex:1;background:#21262d;color:#c9d1d9;border:1px solid #30363d;padding:8px;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.2s;}',
            '.ag-btn:hover{background:#30363d;border-color:#8b949e;}',
            '.ag-skip{display:block;text-align:center;color:#6e7681;font-size:11px;margin-top:10px;cursor:pointer;transition:color 0.2s;}',
            '.ag-skip:hover{color:#8b949e;}',
            '.ag-bar{position:fixed;bottom:0;left:0;right:0;z-index:999997;background:linear-gradient(90deg,#0d1117,#161b22);border-top:1px solid #30363d;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;}',
            '.ag-bar-text{font-size:11px;color:#8b949e;flex:1;}',
            '.ag-bar-text b{color:#58a6ff;}',
            '.ag-bar-btn{background:linear-gradient(135deg,#238636,#2ea44f);color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 0.2s;}',
            '.ag-bar-btn:hover{box-shadow:0 0 12px rgba(46,164,79,0.4);}',
        ].join('');
        document.head.appendChild(s);
    }

    function removeOverlay() {
        var o = document.getElementById('ag-overlay');
        if (o) { o.style.opacity = '0'; o.style.transition = 'opacity 0.3s'; setTimeout(function(){o.remove();},300); }
    }

    function removeBar() {
        var b = document.getElementById('ag-bar');
        if (b) b.remove();
    }

    function onUnlock() {
        window.open(AD_LINK, '_blank');
        setUnlocked();
        removeOverlay();
        removeBar();
        injectSmallBar();
    }

    function copyScript() {
        var code = 'const initializeSuperfast = () => {\n  console.log("38 Tools Connected 🚀");\n};\nif (userClick === "Unlock") { runCloudServer(); }';
        if (navigator.clipboard) { navigator.clipboard.writeText(code); }
        var btn = document.querySelector('.ag-btn-copy');
        if (btn) { btn.textContent = '✅ Copied!'; setTimeout(function(){ btn.textContent = '📋 Copy Script'; }, 2000); }
    }

    function checkStatus() {
        var btn = document.querySelector('.ag-btn-status');
        if (!btn) return;
        btn.textContent = '🔄 Checking...';
        setTimeout(function() { btn.textContent = '🔴 Server Locked'; }, 800);
        setTimeout(function() { btn.textContent = '⚙️ Check Status'; }, 2500);
    }

    function showGate() {
        injectStyles();
        if (document.getElementById('ag-overlay')) return;

        var page = getPage().replace('.html','').replace(/-/g,' ').toUpperCase();

        var overlay = document.createElement('div');
        overlay.id = 'ag-overlay';
        overlay.innerHTML =
            '<div id="ag-box">' +
                '<div class="ag-head">' +
                    '<div class="ag-title">💻 Superfast AI Studio <span class="ag-live">LIVE</span></div>' +
                    '<span class="ag-ver">v2.0 Beta</span>' +
                '</div>' +
                '<div class="ag-code">' +
                    '<span style="color:#8b949e;">// Welcome! Mobile Coding Active 🚀</span><br>' +
                    '<span style="color:#ff7b72;">const</span> <span style="color:#d2a8ff;">initTool</span> = () => {<br>' +
                    '&nbsp;&nbsp;console.log(<span style="color:#a5d6ff;">"' + page + ' Ready ⚡"</span>);<br>' +
                    '&nbsp;&nbsp;<span style="color:#79c0ff;">return</span> <span style="color:#a5d6ff;">cloudServer.unlock();</span><br>' +
                    '};<br>' +
                    '<span style="color:#58a6ff;">if</span> (userClick === <span style="color:#a5d6ff;">"Unlock"</span>) { initTool(); }' +
                '</div>' +
                '<p class="ag-warn">⚠️ <b>High server load detected.</b> Cloud server locked है।<br>Tool use करने के लिए नीचे <b>"Unlock"</b> button दबाएं — बिल्कुल Free!</p>' +
                '<a class="ag-unlock" href="' + AD_LINK + '" target="_blank" onclick="window.__agUnlock()" rel="noopener">⚡ Unlock Cloud Server & Run Tool</a>' +
                '<div class="ag-row">' +
                    '<button class="ag-btn ag-btn-copy" onclick="window.__agCopy()">📋 Copy Script</button>' +
                    '<button class="ag-btn ag-btn-status" onclick="window.__agStatus()">⚙️ Check Status</button>' +
                '</div>' +
                '<span class="ag-skip" onclick="window.__agSkip()">Skip (limited access)</span>' +
            '</div>';

        document.body.appendChild(overlay);

        window.__agUnlock = onUnlock;
        window.__agCopy = copyScript;
        window.__agStatus = checkStatus;
        window.__agSkip = function() {
            removeOverlay();
            // Give them 30 min if they skip
            localStorage.setItem(GATE_KEY + getPage(), Date.now() - GATE_TTL + 30 * 60 * 1000);
            injectSmallBar();
        };
    }

    function injectSmallBar() {
        removeBar();
        injectStyles();
        var bar = document.createElement('div');
        bar.id = 'ag-bar';
        bar.className = 'ag-bar';
        bar.innerHTML =
            '<div class="ag-bar-text">💻 <b>Cloud Server</b> — Free AI Tools powered by Sachin AI Studio</div>' +
            '<button class="ag-bar-btn" onclick="window.__agShowGate()">⚡ Boost Speed</button>';
        document.body.appendChild(bar);
        document.body.style.paddingBottom = Math.max(parseInt(document.body.style.paddingBottom||0), 46) + 'px';
        window.__agShowGate = showGate;
    }

    function init() {
        if (isExempt()) return;
        if (isUnlocked()) {
            // Show small bar only
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', injectSmallBar);
            } else {
                injectSmallBar();
            }
            return;
        }

        // Show gate on page load
        function show() {
            injectStyles();
            showGate();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', show);
        } else {
            show();
        }
    }

    init();
})();
