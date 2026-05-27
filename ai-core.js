/**
 * Sachin AI Studio — Multi-Provider AI Core
 * Provider 1: Pollinations.ai  (FREE, NO KEY, unlimited)
 * Provider 2: Gemini API       (FREE, needs key, 1500/day)
 * Provider 3: HuggingFace      (FREE, no key, anonymous)
 *
 * Tools कभी fail नहीं होंगे — हमेशा fallback मिलेगा।
 */

// ── Provider 1: Pollinations.ai ──────────────────────────────────────────────
async function tryPollinations(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
        const r = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [{ role: 'user', content: prompt }],
                seed: Math.floor(Math.random() * 999999)
            }),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = (await r.text()).trim();
        if (!text || text.length < 3) throw new Error('Empty response');
        return text;
    } catch (e) {
        clearTimeout(timer);
        throw new Error('Pollinations: ' + e.message);
    }
}

// ── Provider 2: Gemini API ────────────────────────────────────────────────────
async function tryGemini(prompt, key) {
    if (!key) throw new Error('Gemini: no key');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: controller.signal
            }
        );
        clearTimeout(timer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) throw new Error('Empty');
        return text.trim();
    } catch (e) {
        clearTimeout(timer);
        throw new Error('Gemini: ' + e.message);
    }
}

// ── Provider 3: HuggingFace Anonymous ────────────────────────────────────────
async function tryHuggingFace(prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
        const r = await fetch(
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: `<s>[INST] ${prompt} [/INST]`, parameters: { max_new_tokens: 800 } }),
                signal: controller.signal
            }
        );
        clearTimeout(timer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const text = Array.isArray(d) ? (d[0]?.generated_text || '') : (d?.generated_text || '');
        const cleaned = text.replace(/.*\[\/INST\]/s, '').trim();
        if (!cleaned || cleaned.length < 5) throw new Error('Empty');
        return cleaned;
    } catch (e) {
        clearTimeout(timer);
        throw new Error('HuggingFace: ' + e.message);
    }
}

// ── Master function — tries all providers in order ───────────────────────────
async function generateAI(prompt, geminiKey) {
    const errors = [];

    // 1. Pollinations (always try first — no key needed)
    try {
        const result = await tryPollinations(prompt);
        console.log('[AI] ✅ Pollinations.ai');
        return result;
    } catch (e) {
        errors.push(e.message);
        console.log('[AI] ⚠️ ' + e.message);
    }

    // 2. Gemini (if key available)
    if (geminiKey) {
        try {
            const result = await tryGemini(prompt, geminiKey);
            console.log('[AI] ✅ Gemini API');
            return result;
        } catch (e) {
            errors.push(e.message);
            console.log('[AI] ⚠️ ' + e.message);
        }
    }

    // 3. HuggingFace anonymous
    try {
        const result = await tryHuggingFace(prompt);
        console.log('[AI] ✅ HuggingFace');
        return result;
    } catch (e) {
        errors.push(e.message);
        console.log('[AI] ⚠️ ' + e.message);
    }

    // All failed
    throw new Error('सभी AI providers अभी busy हैं। 30 सेकंड बाद फिर try करें।\n' + errors.join(' | '));
}

// ── Gemini Vision (image analysis) — only Gemini supports this ───────────────
async function analyzeImageAI(imageBase64, mimeType, instruction, geminiKey) {
    if (!geminiKey) throw new Error('Image analysis के लिए Gemini API key ज़रूरी है।');
    const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
                        { text: instruction }
                    ]
                }]
            })
        }
    );
    if (!r.ok) throw new Error('Gemini vision failed: ' + r.status);
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || 'Image analysis failed.';
}

module.exports = { generateAI, analyzeImageAI, tryPollinations, tryGemini };
