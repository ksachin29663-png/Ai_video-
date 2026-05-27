/**
 * Sachin AI Studio — Universal API Helper
 * Works on both Replit (server mode) and GitHub Pages (direct Gemini mode)
 */
(function () {
    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    let _geminiKey = null;
    let _serverAvailable = null;

    // Try to get key from server
    async function initKey() {
        try {
            const r = await fetch('/api/key', { method: 'GET' });
            if (r.ok) {
                const d = await r.json();
                if (d.key) { _geminiKey = d.key; _serverAvailable = true; return; }
            }
        } catch (e) {}
        _serverAvailable = false;
    }

    // Direct Gemini call helper
    async function geminiGenerate(promptText, imageBase64, mimeType) {
        if (!_geminiKey) { throw new Error('API key not available'); }
        const parts = [];
        if (imageBase64) parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
        parts.push({ text: promptText });
        const resp = await fetch(`${GEMINI_URL}?key=${_geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
        });
        if (!resp.ok) { const e = await resp.text(); throw new Error('Gemini error: ' + e.slice(0, 200)); }
        const data = await resp.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // Fake Response helper
    function fakeResponse(obj, status) {
        const body = JSON.stringify(obj);
        return new Response(body, {
            status: status || 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Intercept fetch
    const _orig = window.fetch.bind(window);
    window.fetch = async function (url, opts) {
        if (typeof url !== 'string') return _orig(url, opts);

        // Only intercept our API endpoints
        const apiEndpoints = ['/generate-content', '/ai-chat', '/generate-code', '/analyze-image', '/remove-background', '/generate-video', '/generate-ai-video', '/video-job', '/video-download'];
        const isApi = apiEndpoints.some(p => url === p || url.startsWith(p + '?') || url.startsWith(p + '/'));
        if (!isApi) return _orig(url, opts);

        // If server is available, use it normally
        if (_serverAvailable === null) await initKey();
        if (_serverAvailable) return _orig(url, opts);

        // --- Fallback: Direct Gemini API ---
        try {
            let body = {};
            if (opts && opts.body) {
                try { body = JSON.parse(opts.body); } catch (e) {}
            }

            // /generate-content
            if (url === '/generate-content') {
                const text = await geminiGenerate(body.prompt);
                return fakeResponse({ result: text });
            }

            // /ai-chat
            if (url === '/ai-chat') {
                const text = await geminiGenerate(body.message);
                return fakeResponse({ reply: text });
            }

            // /generate-code
            if (url === '/generate-code') {
                const langMap = {
                    html: 'Write a complete beautiful HTML page with embedded CSS and JS. Return ONLY raw HTML, no markdown.',
                    css: 'Write complete CSS code. Return ONLY raw CSS, no markdown.',
                    javascript: 'Write clean modern JavaScript ES6+. Return ONLY raw JS, no markdown.',
                    python: 'Write clean Python code. Return ONLY raw Python, no markdown.',
                    react: 'Write a complete React functional component. Return ONLY raw JSX, no markdown.',
                    nodejs: 'Write a Node.js/Express script. Return ONLY raw code, no markdown.',
                    sql: 'Write complete SQL. Return ONLY raw SQL, no markdown.',
                    java: 'Write clean Java code. Return ONLY raw Java, no markdown.',
                    cpp: 'Write clean C++ code. Return ONLY raw C++, no markdown.',
                    php: 'Write complete PHP code. Return ONLY raw PHP, no markdown.',
                };
                const sys = langMap[body.language] || 'Write clean code. Return ONLY raw code, no markdown.';
                const prompt = `${sys}\n\nUser request: ${body.description}\n\nReturn ONLY the code.`;
                let code = await geminiGenerate(prompt);
                code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
                return fakeResponse({ code, language: body.language });
            }

            // /analyze-image
            if (url === '/analyze-image') {
                const text = await geminiGenerate(body.instruction, body.imageBase64, body.mimeType);
                return fakeResponse({ prompt: text });
            }

            // Video & BG remove — needs server, show friendly error
            if (url.startsWith('/remove-background')) {
                return fakeResponse({ error: 'Background removal के लिए Replit server चाहिए। Replit पर visit करें।' }, 503);
            }
            if (url.startsWith('/generate-video') || url.startsWith('/generate-ai-video')) {
                return fakeResponse({ error: 'Video generation के लिए Replit server चाहिए। Replit पर visit करें।' }, 503);
            }

        } catch (err) {
            return fakeResponse({ error: err.message, result: '', reply: '', code: '', prompt: '' }, 500);
        }

        return _orig(url, opts);
    };

    // Auto-init on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initKey);
    } else {
        initKey();
    }

    window.SachinAPI = { initKey, geminiGenerate };
})();
