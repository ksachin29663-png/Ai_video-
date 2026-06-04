const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let gTTS; try { gTTS = require('gtts'); } catch(e) { gTTS = null; }

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// ==================== आपकी नई और अपडेटेड API Keys ====================
const OPENAI_KEY = "Sk-proj-YtqRTnQr1aVs9zFJDUAzaFLfPg1ZRlaPgQVILq6iNkYbDPNkquT9A92V0etVicWzeega0XC3KNT3BlbkFJiX1bhTS_rR-PthftL_nqPTye_nDa5ku6s4r54bjUhoBPAXdZPJGXPcp95h-R2JPKCBauA3npEA";
const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6KQFZVOxhCg9XWYvsLoc5K7cBl3QSldpLN0qfLBXV9xVA"; // नई चालू जेमिनी API Key
const REMOVEBG_KEY = process.env.REMOVEBG_KEY || ""; 

// ==================== AI HELPER - सुपरफास्ट फ़ालबैक इंजन ====================
async function callAI(messages, retries = 2) {
    // 1. सबसे पहले Pollinations AI 
    for (let i = 0; i < retries; i++) {
        try {
            const seed = Math.floor(Math.random() * 99999);
            const r = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                body: JSON.stringify({ messages, model: 'openai', seed }),
                signal: AbortSignal.timeout(15000)
            });
            if (r.status === 429 && i < 2) { await new Promise(x => setTimeout(x, 2000)); continue; }
            if (!r.ok) throw new Error('poll_fail_' + r.status);
            const txt = await r.text();
            if (txt && txt.length > 1) return txt;
            throw new Error('empty');
        } catch (e) {
            if (i < retries) { await new Promise(x => setTimeout(x, 1500)); continue; }
        }
    }

    // 2. बैकअप 1: Groq Cloud (सुपरफास्ट लार्ज लैंग्वेज मॉडल)
    if (GROQ_KEY) {
        try {
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama3-8b-8192',
                    messages: messages
                })
            });
            const d = await r.json();
            if (d.choices && d.choices[0]?.message?.content) return d.choices[0].message.content;
        } catch (e) {
            console.error('Groq backup failed, moving to OpenAI...', e.message);
        }
    }

    // 3. बैकअप 2: OpenAI 
    const prompt = messages.map(m => m.content).join("\n");
    if (OPENAI_KEY) {
        try {
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_KEY}`
                },
                body: JSON.stringify({ model: 'gpt-3.5-turbo', messages })
            });
            const d = await r.json();
            if (d.choices && d.choices[0]?.message?.content) return d.choices[0].message.content;
        } catch (e) {
            console.error('OpenAI backup failed, moving to Gemini...', e.message);
        }
    }

    // 4. बैकअप 3: Google Gemini (आपकी नई वर्किंग की)
    if (GEMINI_KEY) {
        for (let i = 0; i < retries; i++) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                if (r.status === 429 && i < 2) { await new Promise(x => setTimeout(x, 2000)); continue; }
                if (!r.ok) throw new Error('gemini_fail_' + r.status);
                const d = await r.json();
                const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
                if (txt) return txt;
            } catch (e) {
                if (i === retries - 1) break;
                await new Promise(x => setTimeout(x, 2000));
            }
        }
    }

    throw new Error('NO_API_KEY_OR_FAILED');
}

function errJson(res, e) {
    const m = String(e.message || e);
    if (m.includes('no_key')) return res.status(400).json({ error: 'no_key', result: '⚠️ API Key नहीं है!', reply: '⚠️ Setup required.' });
    if (m.includes('429') || m.includes('rate') || m.includes('RATE') || m.includes('quota')) {
        return res.status(400).json({ error: 'rate_limit', result: '⏳ AI busy है - 30 सेकंड बाद ट्राई करें।', reply: '⏳ AI busy है।' });
    }
    return res.status(400).json({ error: 'err', result: '❌ ' + m.slice(0, 120), reply: '❌ Error - दोबारा ट्राई करें।' });
}

// ==================== ROUTES (एप्लीकेशन एंडपॉइंट्स) ====================

app.post('/api-chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    try {
        const reply = await callAI([
            { role: 'system', content: 'You are a helpful Hindi AI assistant. Always reply in Hindi.' },
            { role: 'user', content: message }
        ]);
        res.json({ reply });
    } catch (e) { errJson(res, e); }
});

app.post('/generate-content', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    try {
        res.json({ result: await callAI([{ role: 'user', content: prompt }]) });
    } catch (e) { errJson(res, e); }
});

app.post('/generate-code', async (req, res) => {
    const { description, language } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });
    
    const inst = {
        html: "Write complete HTML+CSS+JS. Return ONLY raw HTML.",
        css: "Return ONLY raw CSS.",
        javascript: "Return ONLY raw JS."
    };
    const sys = inst[language] || 'Return ONLY the raw code, no markdown.';
    
    try {
        let code = await callAI([
            { role: 'user', content: sys + '\n\nTask: ' + description }
        ]);
        code = code.replace(/^```[a-z]*\n/gm, '').replace(/```$/gm, '').trim();
        res.json({ code, language });
    } catch (e) { errJson(res, e); }
});

app.post('/analyze-image', async (req, res) => {
    const { imageBase64, instruction } = req.body;
    if (!imageBase64 || !instruction) return res.status(400).json({ error: 'Missing fields' });
    if (!GEMINI_KEY) return errJson(res, new Error('NO_KEY'));

    // इमेज एनालिसिस के लिए अब आपकी यह नई जेमिनी की का उपयोग होगा
    for (let i = 0; i < 3; i++) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: instruction },
                            { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 } }
                        ]
                    }]
                })
            });
            if (r.status === 429 && i < 2) { await new Promise(x => setTimeout(x, 3000 * (i + 1))); continue; }
            if (!r.ok) throw new Error('gemini_vision_' + r.status);
            const d = await r.json();
            const result = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
            return res.json({ prompt: instruction, result });
        } catch (e) {
            if (i === 2) return errJson(res, e);
            await new Promise(x => setTimeout(x, 2000));
        }
    }
});

app.post('/remove-background', upload.single('image_file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file');
    const fp = req.file.path;
    try {
        if (REMOVEBG_KEY) {
            const FormData = require('form-data');
            const fd = new FormData();
            fd.append('image_file', fs.createReadStream(fp));
            const r = await fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: { 'X-Api-Key': REMOVEBG_KEY, ...fd.getHeaders() },
                body: fd
            });
            if (r.ok) {
                const buf = await r.arrayBuffer();
                res.set('Content-Type', 'image/png');
                return res.send(Buffer.from(buf));
            }
        }
        res.status(200).send('client-side-fallback');
    } catch (e) {
        res.status(200).send('client-side-fallback');
    } finally {
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) {}
    }
});

app.post('/generate-video-script', async (req, res) => {
    const { topic, style, duration } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic required' });
    const sc = Math.max(3, Math.min(parseInt(duration) || 7, 8));
    const wc = Math.floor(sc * 3 * 2.2);
    const prompt = `Topic: ${topic}\nStyle: ${style || 'Cinematic'}\nWords: ${wc}\n\nWrite a complete Hindi voiceover script.`;
    try {
        res.json({ script: await callAI([{ role: 'user', content: prompt }]) });
    } catch (e) { errJson(res, e); }
});

const videoJobs = {};
setInterval(() => {
    const t = Date.now() - 30 * 60 * 1000;
    for (const id in videoJobs) { if (videoJobs[id].createdAt < t) delete videoJobs[id]; }
}, 60000);

app.get('/video-job/:id', (req, res) => {
    const j = videoJobs[req.params.id];
    if (!j) return res.status(404).json({ error: 'Not found' });
    res.json(j);
});

app.get('/video-download/:id', (req, res) => {
    const j = videoJobs[req.params.id];
    if (!j || j.status !== 'done') return res.status(404).send('Not ready');
    res.download(j.outputPath);
});

app.post('/generate-ai-video', upload.array('photos', 3), (req, res) => {
    const { prompt, script, style, duration } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    const jobId = 'job_' + Date.now().toString() + Math.random().toString(36).slice(2, 8);
    videoJobs[jobId] = { status: 'processing', step: 'शुरू हो रहा है...', progress: 0, createdAt: Date.now(), outputPath: null, error: null };
    res.json({ jobId });
    runVideoJob(jobId, req.files || [], { prompt, script, style, duration });
});

async function runVideoJob(jobId, photos, { prompt, script, style, duration }) {
    const j = videoJobs[jobId];
    const set = (s, p) => { j.step = s; j.progress = p; };
    const fail = (m) => { j.status = 'error'; j.error = m; };
    const sc = Math.max(3, Math.min(parseInt(duration) || 7, 8));
    const tmpPath = path.join(__dirname, 'uploads');
    const ts = Date.now().toString();
    
    const ap = path.join(tmpPath, `v_${ts}.mp3`);
    const op = path.join(tmpPath, `out_${ts}.mp4`);
    const cf = path.join(tmpPath, `c_${ts}.txt`);
    const xp = path.join(tmpPath, `x_${ts}.mp4`);
    
    let sf = [];
    const dl = async (url, dest) => {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 35000);
        try {
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(t);
            if (r.ok) { fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); return true; }
        } catch(e) { clearTimeout(t); }
        return false;
    };

    const getImgAsync = async (pr, dest) => {
        const s = Math.floor(Math.random() * 999999);
        const e = encodeURIComponent(pr.slice(0, 300));
        try {
            let ok = await dl(`https://image.pollinations.ai/prompt/${e}?width=1280&height=720&nologo=true&seed=${s}&model=flux`, dest);
            if (!ok) ok = await dl(`https://image.pollinations.ai/prompt/${e}?width=1280&height=720&nologo=true&seed=${s}`, dest);
            if (!ok) await dl(`https://picsum.photos/seed/${s}/1280/720`, dest);
        } catch(e) {
            try { exec(`ffmpeg -y -f lavfi -i color=c=#0a1628:s=1280x720 -frames:v 1 "${dest}"`, {timeout:10000}); } catch(err){}
        }
    };

    try {
        set('🎙️ Voiceover बन रहा है...', 5);
        try {
            if (OPENAI_KEY) {
                const r = await fetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'tts-1', input: (script || prompt).slice(0, 300), voice: 'alloy' })
                });
                if (!r.ok) throw new Error('OpenAI TTS failed');
                fs.writeFileSync(ap, Buffer.from(await r.arrayBuffer()));
            } else throw new Error('No Key');
        } catch (e) {
            if (gTTS) {
                await new Promise((res, rej) => {
                    const g = new gTTS((script || prompt).slice(0, 500), 'hi');
                    g.save(ap, (err) => err ? rej(err) : res());
                });
            } else throw new Error('No TTS available');
        }

        if (!fs.existsSync(ap) || fs.statSync(ap).size < 100) throw new Error('Voice file empty');
        const styleP = '(cinematic photography, dramatic lighting, 8k, vibrant studio ghibli anime art style)';
        
        for (let i = 0; i < 3; i++) {
            set(`🖼️ Scene ${i+1} तैयार हो रहा है...`, 10 + i * 15);
            const ip = path.join(tmpPath, `sc_${ts}_${i}.jpg`);
            if (photos[i]) {
                await new Promise(r => exec(`ffmpeg -y -i "${photos[i].path}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" "${ip}"`, r));
            } else {
                await getImgAsync(`${prompt}, scene ${i+1}, ${(style || styleP)}`, ip);
            }
            sf.push(ip);
        }

        const fr = sc * 25;
        let cp = [];
        for (let i = 0; i < 3; i++) {
            set(`🎬 Clip ${i+1} रेंडर हो रहा है...`, 55 + i * 10);
            const cl = path.join(tmpPath, `cl_${ts}_${i}.mp4`);
            await new Promise(r => exec(`ffmpeg -y -loop 1 -t ${fr/3} -i "${sf[i]}" -vf "scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${fr/3}" -c:v libx264 -preset ultrafast "${cl}"`, r));
            cp.push(cl);
        }

        set('🎞️ वीडियो क्लिप्स जोड़ी जा रही हैं...', 85);
        fs.writeFileSync(cf, cp.map(p => `file '${p}'`).join('\n'));
        await new Promise((r, rej) => exec(`ffmpeg -y -f concat -safe 0 -i "${cf}" -c copy "${xp}"`, (e) => e ? rej(e) : r()));

        set('🎵 ऑडियो मिक्स किया जा रहा है...', 95);
        await new Promise((r, rej) => exec(`ffmpeg -y -i "${xp}" -i "${ap}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest "${op}"`, (e) => e ? rej(e) : r()));

        j.status = 'done';
        j.step = '✅ तैयार है!';
        j.progress = 100;
        j.outputPath = op;

        sf.concat(cp).concat([cf, xp, ap]).forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {} });
        photos.forEach(p => { try { if (fs.existsSync(p.path)) fs.unlinkSync(p.path); } catch (e) {} });

    } catch (err) {
        fail('Error: ' + err.message);
        sf.concat(cp).concat([cf, xp, ap, op]).forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {} });
        photos.forEach(p => { try { if (fs.existsSync(p.path)) fs.unlinkSync(p.path); } catch (e) {} });
    }
}

app.get('/health', (req, res) => {
    res.json({ status: "ok", gemini: !!GEMINI_KEY, openai: !!OPENAI_KEY, groq: !!GROQ_KEY });
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
    const p = req.path.replace(/^\//, '');
    const fp = path.join(__dirname, p.includes('.') ? p : 'index.html');
    res.sendFile(fp);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Full-Powered Server running on port ${PORT}`);
    console.log(`📡 Connected APIs: Pollinations, Groq Cloud, OpenAI, and Gemini.`);
});
                   
