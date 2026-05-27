/**
 * Sachin AI Studio — Universal Client-Side API Helper v3
 * Works on GitHub Pages AND Replit — NO API KEY NEEDED
 *
 * Priority:
 *  1. Replit server  (best quality, handles all tools)
 *  2. Pollinations.ai direct  (FREE, no key, works on GitHub Pages)
 *  3. Gemini direct  (fallback if key available)
 */
(function () {
    'use strict';

    var POLLINATIONS_URL = 'https://text.pollinations.ai/';
    var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    var _geminiKey = null;
    var _serverAvailable = null;   // null=unknown, true=up, false=down
    var _initDone = false;
    var _initCallbacks = [];

    var _origFetch = window.fetch.bind(window);

    // Check if server is up and optionally get Gemini key
    function init() {
        if (_initDone) return Promise.resolve();
        return _origFetch('/api/status')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                _serverAvailable = !!(d && d.status === 'ok');
            })
            .catch(function () { _serverAvailable = false; })
            .then(function () {
                // Try to get Gemini key for image analysis fallback
                return _origFetch('/api/key')
                    .then(function (r) { return r.ok ? r.json() : null; })
                    .then(function (d) { if (d && d.key) _geminiKey = d.key; })
                    .catch(function () {});
            })
            .then(function () { _initDone = true; });
    }

    // ── Pollinations.ai direct call (no key needed) ───────────────────────────
    function pollinationsCall(prompt) {
        return _origFetch(POLLINATIONS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [{ role: 'user', content: prompt }],
                seed: Math.floor(Math.random() * 999999)
            })
        }).then(function (r) {
            if (!r.ok) throw new Error('Pollinations HTTP ' + r.status);
            return r.text();
        }).then(function (t) {
            t = t.trim();
            if (!t) throw new Error('Pollinations empty');
            return t;
        });
    }

    // ── Gemini direct call ────────────────────────────────────────────────────
    function geminiCall(prompt, imgBase64, mimeType) {
        if (!_geminiKey) return Promise.reject(new Error('No Gemini key'));
        var parts = [];
        if (imgBase64) parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imgBase64 } });
        parts.push({ text: prompt });
        return _origFetch(GEMINI_URL + '?key=' + _geminiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: parts }] })
        }).then(function (r) {
            if (!r.ok) throw new Error('Gemini HTTP ' + r.status);
            return r.json();
        }).then(function (d) {
            return (d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text) || '';
        });
    }

    // ── Response helpers ──────────────────────────────────────────────────────
    function jsonResp(obj) {
        return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── Route API calls when server is down ───────────────────────────────────
    function handleLocally(url, opts) {
        var body = {};
        if (opts && opts.body) { try { body = JSON.parse(opts.body); } catch (e) {} }

        // /generate-content
        if (url === '/generate-content') {
            return pollinationsCall(body.prompt || '')
                .then(function (t) { return jsonResp({ result: t }); })
                .catch(function () {
                    return geminiCall(body.prompt || '')
                        .then(function (t) { return jsonResp({ result: t }); })
                        .catch(function (e) { return jsonResp({ result: '', error: e.message }); });
                });
        }

        // /ai-chat
        if (url === '/ai-chat') {
            return pollinationsCall(body.message || '')
                .then(function (t) { return jsonResp({ reply: t }); })
                .catch(function () {
                    return geminiCall(body.message || '')
                        .then(function (t) { return jsonResp({ reply: t }); })
                        .catch(function (e) { return jsonResp({ reply: '', error: e.message }); });
                });
        }

        // /generate-code
        if (url === '/generate-code') {
            var langMap = {
                html: 'Write a complete beautiful HTML page with embedded CSS and JS. Return ONLY raw HTML, no markdown.',
                css: 'Write complete CSS. Return ONLY raw CSS, no markdown.',
                javascript: 'Write clean modern JavaScript ES6+. Return ONLY raw JS, no markdown.',
                python: 'Write clean Python. Return ONLY raw Python, no markdown.',
                react: 'Write a complete React functional component. Return ONLY raw JSX, no markdown.',
                nodejs: 'Write Node.js/Express code. Return ONLY raw code, no markdown.',
                sql: 'Write complete SQL. Return ONLY raw SQL, no markdown.',
                java: 'Write clean Java code. Return ONLY raw Java, no markdown.',
                cpp: 'Write clean C++. Return ONLY raw C++, no markdown.',
                php: 'Write complete PHP. Return ONLY raw PHP, no markdown.'
            };
            var sys = langMap[body.language] || 'Write clean code. Return ONLY raw code, no markdown.';
            var p = sys + '\n\nUser request: ' + (body.description || '') + '\n\nReturn ONLY the code.';
            return pollinationsCall(p)
                .then(function (code) {
                    code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
                    return jsonResp({ code: code, language: body.language });
                })
                .catch(function () {
                    return geminiCall(p)
                        .then(function (code) {
                            code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
                            return jsonResp({ code: code, language: body.language });
                        })
                        .catch(function (e) { return jsonResp({ code: '', error: e.message }); });
                });
        }

        // /analyze-image (vision — Gemini only)
        if (url === '/analyze-image') {
            return geminiCall(body.instruction || 'Describe this image', body.imageBase64, body.mimeType)
                .then(function (t) { return jsonResp({ prompt: t }); })
                .catch(function (e) { return jsonResp({ prompt: '', error: 'Image analysis के लिए Gemini key चाहिए: ' + e.message }); });
        }

        // Video/BG — server only features
        return Promise.resolve(jsonResp({ error: 'यह feature Replit server पर ही available है।', result: '', reply: '', code: '' }));
    }

    // ── Monkey-patch window.fetch ─────────────────────────────────────────────
    var API_PATHS = ['/generate-content', '/ai-chat', '/generate-code', '/analyze-image', '/remove-background', '/generate-video', '/generate-ai-video', '/video-job/', '/video-download/'];

    window.fetch = function (url, opts) {
        if (typeof url !== 'string') return _origFetch(url, opts);

        var isApi = API_PATHS.some(function (p) { return url === p || url.startsWith(p); });
        if (!isApi) return _origFetch(url, opts);

        // Initialize once
        return init().then(function () {
            if (_serverAvailable) {
                // Server is up — use it, but intercept non-JSON responses
                return _origFetch(url, opts).then(function (resp) {
                    var ct = resp.headers.get('content-type') || '';
                    if (resp.ok && ct.indexOf('application/json') !== -1) return resp;
                    // Server returned HTML/error — fallback to local
                    return handleLocally(url, opts);
                }).catch(function () {
                    return handleLocally(url, opts);
                });
            } else {
                // Server not available (GitHub Pages) — handle locally
                return handleLocally(url, opts);
            }
        });
    };

    // Expose for debugging
    window.SachinAI = {
        test: function () {
            return pollinationsCall('Say "AI is working!" in Hindi')
                .then(function (t) { console.log('✅ Pollinations:', t); return t; })
                .catch(function (e) { console.error('❌ Pollinations:', e); });
        },
        status: function () {
            return { serverAvailable: _serverAvailable, geminiKey: !!_geminiKey };
        }
    };

})();
