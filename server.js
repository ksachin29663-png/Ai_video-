const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');
const { generateAI, analyzeImageAI, tryOpenAI, tryLlama } = require('./ai-core');

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || null;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

if (!fs.existsSync('uploads')) { fs.mkdirSync('uploads'); }
const upload = multer({ dest: 'uploads/' });

// ─────────────────────────────────────────────────────────────────────────────
// AI ENDPOINTS — powered by Multi-Provider Core (Pollinations → Gemini → HF)
// ─────────────────────────────────────────────────────────────────────────────

// Universal content generator
app.post('/generate-content', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    try {
        const result = await generateAI(prompt, GEMINI_KEY);
        res.json({ result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Chat (Universal with fallback)
app.post('/ai-chat', async (req, res) => {
    const { message, provider } = req.body; // User can choose provider: 'openai', 'llama', or 'auto'
    if (!message) return res.status(400).json({ error: 'Message required' });
    
    try {
        let reply;
        if (provider === 'openai') {
            reply = await tryOpenAI(message);
        } else if (provider === 'llama') {
            reply = await tryLlama(message);
        } else {
            // Default to the existing multi-provider fallback logic
            reply = await generateAI(message, GEMINI_KEY);
        }
        res.json({ reply });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Code Generator
app.post('/generate-code', async (req, res) => {
    const { description, language } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });

    const langInstructions = {
        html: 'Write a complete, beautiful, modern HTML page with embedded CSS and JavaScript. Return ONLY the raw HTML code, no markdown fences.',
        css: 'Write complete, beautiful CSS code with modern techniques. Return ONLY the raw CSS code, no markdown fences.',
        javascript: 'Write clean, modern JavaScript (ES6+) code. Return ONLY the raw JS code, no markdown fences.',
        python: 'Write clean, well-commented Python code. Return ONLY the raw Python code, no markdown fences.',
        react: 'Write a complete React functional component with hooks. Return ONLY the raw JSX/React code, no markdown fences.',
        nodejs: 'Write a complete Node.js/Express server or script. Return ONLY the raw code, no markdown fences.',
        sql: 'Write complete, well-structured SQL queries/schema. Return ONLY the raw SQL code, no markdown fences.',
        java: 'Write clean Java code with proper class structure. Return ONLY the raw Java code, no markdown fences.',
        cpp: 'Write clean C++ code. Return ONLY the raw C++ code, no markdown fences.',
        php: 'Write complete PHP code. Return ONLY the raw PHP code, no markdown fences.',
    };

    const sysPrompt = langInstructions[language] || 'Write clean code. Return ONLY the raw code, no markdown fences.';
    const fullPrompt = `${sysPrompt}\n\nUser request: ${description}\n\nReturn ONLY the code — no explanation, no markdown fences.`;

    try {
        let code = await generateAI(fullPrompt, GEMINI_KEY);
        code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
        res.json({ code, language });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Image Analysis (Vision — Gemini only, no fallback possible)
app.post('/analyze-image', async (req, res) => {
    const { imageBase64, mimeType, instruction } = req.body;
    if (!imageBase64 || !instruction) return res.status(400).json({ error: 'Missing imageBase64 or instruction' });
    try {
        const prompt = await analyzeImageAI(imageBase64, mimeType, instruction, GEMINI_KEY);
        res.json({ prompt });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND REMOVAL
// ─────────────────────────────────────────────────────────────────────────────
app.post('/remove-background', upload.single('image_file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded');
    const filePath = req.file.path;
    try {
        const formData = new (require('form-data'))();
        formData.append('image_file', fs.createReadStream(filePath));
        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY || '' },
            body: formData
        });
        if (!response.ok) throw new Error('Remove.bg failed');
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', 'image/png');
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).send('BG removal failed — client-side fallback will handle it');
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE VIDEO (image + TTS)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/generate-video', upload.array('files'), (req, res) => {
    const files = req.files;
    const userCommand = req.body.command || 'तितली उड़ रही है';
    if (!files || files.length === 0) return res.status(400).send('फाइल नहीं मिली।');
    const inputPath = files[0].path;
    const audioPath = path.join(__dirname, `voice_${Date.now()}.mp3`);
    const outputVideoPath = path.join(__dirname, `output_${Date.now()}.mp4`);
    const gtts = new gTTS(userCommand, 'hi');
    gtts.save(audioPath, (err) => {
        if (err) return res.status(500).send('Voice failed.');
        const ffmpegCmd = `ffmpeg -y -loop 1 -i "${inputPath}" -i "${audioPath}" -vf "scale=1280:720,zoompan=z='min(zoom+0.0015,1.2)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720" -map 0:v:0 -map 1:a:0 -c:v libx264 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p "${outputVideoPath}"`;
        exec(ffmpegCmd, (error) => {
            if (error) return res.status(500).send('Render failed.');
            res.sendFile(outputVideoPath, () => {
                [inputPath, audioPath, outputVideoPath].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });
            });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// AI VIDEO JOB QUEUE
// ─────────────────────────────────────────────────────────────────────────────
const videoJobs = {};

setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const id in videoJobs) {
        if (videoJobs[id].createdAt < cutoff) {
            const j = videoJobs[id];
            if (j.outputPath && fs.existsSync(j.outputPath)) { try { fs.unlinkSync(j.outputPath); } catch(e){} }
            delete videoJobs[id];
        }
    }
}, 10 * 60 * 1000);

app.get('/video-job/:id', (req, res) => {
    const job = videoJobs[req.params.id];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ status: job.status, step: job.step, progress: job.progress, error: job.error || null, downloadUrl: job.status === 'done' ? `/video-download/${req.params.id}` : null });
});

app.get('/video-download/:id', (req, res) => {
    const job = videoJobs[req.params.id];
    if (!job || job.status !== 'done') return res.status(404).json({ error: 'Video not ready' });
    if (!fs.existsSync(job.outputPath)) return res.status(404).json({ error: 'File missing' });
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="sachin-ai-video.mp4"');
    res.sendFile(job.outputPath, { root: '/' }, (err) => {
        if (!err) {
            setTimeout(() => {
                try { if (fs.existsSync(job.outputPath)) fs.unlinkSync(job.outputPath); } catch(e){}
                delete videoJobs[req.params.id];
            }, 10000);
        }
    });
});

app.post('/generate-ai-video', upload.array('photos', 3), (req, res) => {
    const { prompt, script, style, duration } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    videoJobs[jobId] = { status: 'processing', step: 'शुरू हो रहा है...', progress: 0, createdAt: Date.now(), outputPath: null, error: null };
    res.json({ jobId });
    runVideoJob(jobId, req.files || [], { prompt, script, style, duration });
});

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO WORKER
// ─────────────────────────────────────────────────────────────────────────────
async function runVideoJob(jobId, uploadedPhotos, { prompt, script, style, duration }) {
    const job = videoJobs[jobId];
    function setStep(step, progress) { if (!job) return; job.step = step; job.progress = progress; console.log(`[Job ${jobId.slice(-6)}] ${step}`); }
    function fail(msg) { if (!job) return; job.status = 'error'; job.step = msg; job.error = msg; console.error(`[Job ${jobId.slice(-6)}] FAILED: ${msg}`); }

    const rawScript = (script || prompt).slice(0, 1500).replace(/['"\\`$]/g, ' ');
    const rawPrompt = prompt.slice(0, 500);
    const vidStyle = style || 'cinematic';
    const sceneDuration = Math.max(3, Math.min(parseInt(duration) || 7, 8));

    const tmpDir = path.join(__dirname, 'uploads');
    const ts = Date.now();
    const audioPath  = path.join(tmpDir, `voice_${ts}.mp3`);
    const outputPath = path.join(tmpDir, `video_${ts}.mp4`);
    const concatFile = path.join(tmpDir, `concat_${ts}.txt`);
    const silentPath = path.join(tmpDir, `silent_${ts}.mp4`);
    const allTempFiles = [audioPath, concatFile, silentPath];
    const sceneFiles = [];
    const clipPaths  = [];

    function cleanup() {
        [...allTempFiles, ...sceneFiles, ...clipPaths].forEach(f => { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });
        uploadedPhotos.forEach(p => { try { if (p.path && fs.existsSync(p.path)) fs.unlinkSync(p.path); } catch(e){} });
    }

    const styleMap = {
        cinematic:  'cinematic photography, dramatic lighting, 8K ultra HD, film grain',
        anime:      'anime art style, vibrant colors, studio ghibli inspired, detailed',
        '3d':       '3D render, Pixar style, colorful, studio lighting, high quality CGI',
        realistic:  'photorealistic, DSLR photography, natural lighting, sharp focus',
        watercolor: 'watercolor painting, artistic, soft brush strokes, dreamy',
    };
    const stylePrompt = styleMap[vidStyle] || styleMap.cinematic;

    async function downloadUrl(url, destPath, timeoutMs = 35000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = await r.arrayBuffer();
            if (buf.byteLength < 5000) throw new Error('Too small');
            fs.writeFileSync(destPath, Buffer.from(buf));
            return buf.byteLength;
        } catch(e) { clearTimeout(timer); throw e; }
    }

    async function fetchImage(imgPrompt, destPath) {
        const seed = Math.floor(Math.random() * 999999);
        const enc = encodeURIComponent(imgPrompt.slice(0, 300));
        try { const b = await downloadUrl(`https://image.pollinations.ai/prompt/${enc}?width=1280&height=720&nologo=true&seed=${seed}&model=flux`, destPath, 40000); console.log(`[Image] Pollinations OK (${b}b)`); return true; } catch(e) { console.log(`[Image] Pollinations fail: ${e.message}`); }
        try { const b = await downloadUrl(`https://image.pollinations.ai/prompt/${enc}?width=1280&height=720&nologo=true&seed=${seed+1}`, destPath, 40000); console.log(`[Image] Pollinations2 OK (${b}b)`); return true; } catch(e) { console.log(`[Image] Pollinations2 fail: ${e.message}`); }
        try { const picId = (seed % 500) + 1; const b = await downloadUrl(`https://picsum.photos/seed/${picId}/1280/720`, destPath, 20000); console.log(`[Image] Picsum OK (${b}b)`); return true; } catch(e) {}
        await new Promise(resolve => { exec(`ffmpeg -y -f lavfi -i "color=c=#0a1628:s=1280x720" -frames:v 1 "${destPath}"`, { timeout: 10000 }, () => resolve()); });
        return true;
    }

    function runFFmpeg(cmd, timeoutMs = 120000) {
        return new Promise((resolve, reject) => {
            exec(cmd, { timeout: timeoutMs }, (err, _stdout, stderr) => {
                if (err) reject(new Error(stderr ? stderr.slice(-300) : err.message));
                else resolve();
            });
        });
    }

    try {
        setStep('🎙️ Hindi voiceover बन रहा है...', 5);
        await new Promise((resolve, reject) => {
            try { const gtts = new gTTS(rawScript, 'hi'); gtts.save(audioPath, (err) => err ? reject(new Error('gTTS: ' + err.message)) : resolve()); }
            catch(e) { reject(new Error('gTTS init: ' + e.message)); }
        });
        if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 100) throw new Error('Voice file empty or missing');

        const scenePrompts = [
            `${rawPrompt}, opening wide establishing shot, ${stylePrompt}`,
            `${rawPrompt}, main subject close-up, dramatic, ${stylePrompt}`,
            `${rawPrompt}, cinematic final wide angle, ${stylePrompt}`,
        ];
        for (let i = 0; i < 3; i++) {
            setStep(`🖼️ Scene ${i+1}/3 image तैयार हो रही है...`, 10 + i * 15);
            const imgPath = path.join(tmpDir, `scene_${ts}_${i}.jpg`);
            if (uploadedPhotos[i]) {
                const srcPath = uploadedPhotos[i].path;
                await runFFmpeg(`ffmpeg -y -i "${srcPath}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1" "${imgPath}"`, 30000);
            } else {
                await fetchImage(scenePrompts[i], imgPath);
            }
            sceneFiles.push(imgPath);
            allTempFiles.push(imgPath);
        }

        const frames = sceneDuration * 25;
        const zooms = [
            `scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720`,
            `scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)-5*on':y='ih/2-(ih/zoom/2)':s=1280x720`,
            `scale=1280:720,zoompan=z='if(lte(zoom,1.0),1.05,max(1.0,zoom-0.001))':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720`,
        ];
        for (let i = 0; i < 3; i++) {
            setStep(`🎬 Scene ${i+1}/3 clip encode हो रही है...`, 50 + i * 10);
            const clipPath = path.join(tmpDir, `clip_${ts}_${i}.mp4`);
            try {
                await runFFmpeg(`ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "${zooms[i]}" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${clipPath}"`, 90000);
            } catch(e) {
                await runFFmpeg(`ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${clipPath}"`, 90000);
            }
            clipPaths.push(clipPath);
            allTempFiles.push(clipPath);
        }

        setStep('🔗 Clips जोड़े जा रहे हैं...', 82);
        fs.writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join('\n'));
        await runFFmpeg(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${silentPath}"`, 60000);

        setStep('🎵 Audio mix हो रहा है...', 90);
        await runFFmpeg(`ffmpeg -y -i "${silentPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest "${outputPath}"`, 60000);

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 10000) throw new Error('Output video missing or too small');

        console.log(`[Job ${jobId.slice(-6)}] ✅ Done! ${fs.statSync(outputPath).size} bytes`);
        job.status = 'done';
        job.step = '✅ Video तैयार है! Download करें।';
        job.progress = 100;
        job.outputPath = outputPath;
        [...allTempFiles.filter(f => f !== outputPath), ...sceneFiles, ...clipPaths].forEach(f => { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });

    } catch (err) {
        cleanup();
        fail('Error: ' + err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/key', (req, res) => {
    if (!GEMINI_KEY) return res.status(503).json({ error: 'Key not configured' });
    res.json({ key: GEMINI_KEY });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', providers: ['pollinations', GEMINI_KEY ? 'gemini' : null, 'huggingface'].filter(Boolean), timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sachin AI Studio ready on http://0.0.0.0:${PORT}`);
    console.log(`🤖 AI Providers: Pollinations.ai + ${GEMINI_KEY ? 'Gemini' : 'no Gemini key'} + HuggingFace`);
});
