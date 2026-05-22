(function () {
    'use strict';
    var PAGE_MAP = {
        'index.html': 'Dashboard', '': 'Dashboard', '/': 'Dashboard',
        'text-to-image.html': 'Text-to-Image',
        'bg-changer.html': 'BG Remover & Changer',
        'photo-restore.html': 'Photo Restorer',
        'object-eraser.html': 'Magic Object Eraser',
        'ai-avatar.html': 'AI Avatar',
        'image-expander.html': 'Image Expander',
        'ai-relight.html': 'AI Relighting',
        'ai-sketch.html': 'Sketch & Art',
        'ai-beauty.html': 'Beauty Enhancer',
        'image-to-prompt.html': 'Image-to-Prompt',
        'ai-variations.html': 'AI Variations',
        'ai-upscaler.html': 'AI Upscaler',
        'magic-eraser-pro.html': 'Magic Eraser Pro',
        'ai-avatar-pro.html': 'AI Avatar Pro',
        'ai-code.html': 'AI Code Generator',
        'analytics.html': 'Analytics',
        'ai-chat.html': 'AI Chat',
        'premium.html': 'Premium',
        'bg-remove.html': 'BG Remove',
    };

    function getPageKey() {
        var p = window.location.pathname.split('/').pop() || 'index.html';
        return p || 'index.html';
    }

    function getPageName() {
        var key = getPageKey();
        return PAGE_MAP[key] || key;
    }

    function track() {
        try {
            var key = getPageKey();
            var name = getPageName();
            var stats = JSON.parse(localStorage.getItem('sachin_ai_stats') || '{}');
            if (!stats[key]) stats[key] = { name: name, visits: 0, lastVisit: null };
            stats[key].visits += 1;
            stats[key].lastVisit = new Date().toISOString();
            stats[key].name = name;

            // Track total sessions
            var sessions = parseInt(localStorage.getItem('sachin_ai_sessions') || '0');
            localStorage.setItem('sachin_ai_sessions', sessions + 1);

            // Track daily activity
            var today = new Date().toISOString().split('T')[0];
            var daily = JSON.parse(localStorage.getItem('sachin_ai_daily') || '{}');
            daily[today] = (daily[today] || 0) + 1;
            // Keep only last 14 days
            var keys = Object.keys(daily).sort();
            if (keys.length > 14) { delete daily[keys[0]]; }
            localStorage.setItem('sachin_ai_daily', JSON.stringify(daily));

            localStorage.setItem('sachin_ai_stats', JSON.stringify(stats));
            localStorage.setItem('sachin_ai_last_page', name);
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', track);
    } else {
        track();
    }
})();
