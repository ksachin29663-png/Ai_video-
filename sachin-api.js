/**
 * Sachin AI Studio — Universal API Helper v2
 * Works on GitHub Pages (direct Gemini) and Replit server both
 */
(function () {
    var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    var FALLBACK_KEY = 'AIzaSyCMtdlhrJqcg-GyoGsIcEz5T0-1FsEjiBA';
    var _key = null;
    var _keyReady = false;
    var _keyCallbacks = [];

    function onKeyReady(cb) {
        if (_keyReady) cb(_key);
        else _keyCallbacks.push(cb);
    }

    function resolveKey(k) {
        _key = k;
        _keyReady = true;
        _keyCallbacks.forEach(function(cb){ cb(k); });
        _keyCallbacks = [];
    }

    // Fetch key from server, fallback to embedded key
    var _origFetch = window.fetch.bind(window);
    (function initKey() {
        _origFetch('/api/key')
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(d){ resolveKey((d && d.key) ? d.key : FALLBACK_KEY); })
            .catch(function(){ resolveKey(FALLBACK_KEY); });
    })();

    // Direct Gemini call
    function geminiCall(promptText, imageBase64, mimeType) {
        return new Promise(function(resolve, reject) {
            onKeyReady(function(key) {
                if (!key) { reject(new Error('API key missing')); return; }
                var parts = [];
                if (imageBase64) parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
                parts.push({ text: promptText });
                _origFetch(GEMINI_URL + '?key=' + key, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: parts }] })
                })
                .then(function(r) {
                    if (!r.ok) return r.text().then(function(t){ throw new Error(t.slice(0,200)); });
                    return r.json();
                })
                .then(function(data) {
                    var text = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
                    resolve(text);
                })
                .catch(reject);
            });
        });
    }

    function fakeOk(obj) {
        return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    function fakeErr(msg) {
        return new Response(JSON.stringify({ error: msg, result: msg, reply: msg, code: '// Error: ' + msg, prompt: msg }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    var API_PATHS = ['/generate-content', '/ai-chat', '/generate-code', '/analyze-image', '/remove-background', '/generate-video', '/generate-ai-video', '/video-job/', '/video-download/'];

    window.fetch = function(url, opts) {
        if (typeof url !== 'string') return _origFetch(url, opts);
        var isApi = API_PATHS.some(function(p){ return url === p || url.startsWith(p); });
        if (!isApi) return _origFetch(url, opts);

        // Try original server first — if it returns valid JSON, great
        return _origFetch(url, opts).then(function(resp) {
            var ct = resp.headers.get('content-type') || '';
            if (resp.ok && ct.indexOf('application/json') !== -1) return resp;
            // Server returned HTML or non-JSON → use Gemini directly
            return handleWithGemini(url, opts);
        }).catch(function() {
            return handleWithGemini(url, opts);
        });
    };

    function handleWithGemini(url, opts) {
        var body = {};
        if (opts && opts.body) { try { body = JSON.parse(opts.body); } catch(e){} }

        if (url === '/generate-content') {
            return geminiCall(body.prompt || '').then(function(t){ return fakeOk({ result: t }); }).catch(function(e){ return fakeErr(e.message); });
        }
        if (url === '/ai-chat') {
            return geminiCall(body.message || '').then(function(t){ return fakeOk({ reply: t }); }).catch(function(e){ return fakeErr(e.message); });
        }
        if (url === '/generate-code') {
            var langMap = {
                html:'Write a complete beautiful HTML page with embedded CSS and JS. Return ONLY raw HTML code, no markdown fences.',
                css:'Write complete CSS. Return ONLY raw CSS, no markdown.',
                javascript:'Write clean modern JavaScript ES6+. Return ONLY raw JS, no markdown.',
                python:'Write clean Python. Return ONLY raw Python, no markdown.',
                react:'Write a complete React functional component. Return ONLY raw JSX, no markdown.',
                nodejs:'Write Node.js/Express code. Return ONLY raw code, no markdown.',
                sql:'Write complete SQL. Return ONLY raw SQL, no markdown.',
                java:'Write clean Java code. Return ONLY raw Java, no markdown.',
                cpp:'Write clean C++. Return ONLY raw C++, no markdown.',
                php:'Write complete PHP. Return ONLY raw PHP, no markdown.'
            };
            var sys = langMap[body.language] || 'Write clean code. Return ONLY raw code, no markdown.';
            var p = sys + '\n\nUser request: ' + (body.description || '') + '\n\nReturn ONLY the code.';
            return geminiCall(p).then(function(code){
                code = code.replace(/^```[\w]*\n?/gm,'').replace(/^```$/gm,'').trim();
                return fakeOk({ code: code, language: body.language });
            }).catch(function(e){ return fakeErr(e.message); });
        }
        if (url === '/analyze-image') {
            return geminiCall(body.instruction || 'Describe this image', body.imageBase64, body.mimeType)
                .then(function(t){ return fakeOk({ prompt: t }); })
                .catch(function(e){ return fakeErr(e.message); });
        }
        // Video/BG — server only
        if (url === '/remove-background' || url.startsWith('/generate-video') || url.startsWith('/generate-ai-video')) {
            return Promise.resolve(fakeErr('यह feature server पर available है। Replit link पर visit करें।'));
        }
        return _origFetch(url, opts);
    }

    window.SachinAPI = { geminiCall: geminiCall };
})();
