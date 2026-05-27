(function () {
    'use strict';
    // Ad gate disabled on Replit
    // Just inject the small bottom bar (no blocking overlay)
    var EXEMPT = ['index.html', '', '/', 'analytics.html', 'premium.html'];
    function getPage() { return window.location.pathname.split('/').pop() || 'index.html'; }
    function isExempt() { return EXEMPT.indexOf(getPage()) !== -1; }
    function injectBar() {
        if (isExempt()) return;
        var style = document.createElement('style');
        style.textContent = '#ag-bar{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#0d1117,#161b22);border-top:1px solid #30363d;padding:8px 16px;display:flex;align-items:center;gap:12px;}.ag-bar-text{font-size:11px;color:#8b949e;flex:1;}.ag-bar-text b{color:#58a6ff;}';
        document.head.appendChild(style);
        var bar = document.createElement('div');
        bar.id = 'ag-bar';
        bar.innerHTML = '<div class="ag-bar-text">💻 <b>Cloud Server</b> — Free AI Tools powered by Sachin AI Studio</div>';
        document.body.appendChild(bar);
        document.body.style.paddingBottom = '46px';
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectBar);
    } else {
        injectBar();
    }
})();
