const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

if (!fs.existsSync('uploads')) { fs.mkdirSync('uploads'); }
const upload = multer({ dest: 'uploads/' });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ---- Gemini Image-to-Prompt Endpoint ----
app.post('/analyze-image', async (req, res) => {
    const { imageBase64, mimeType, instruction } = req.body;
    if (!imageBase64 || !instruction) {
        return res.status(400).json({ error: 'Missing imageBase64 or instruction' });
    }
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{
                parts: [
                    { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
                    { text: instruction }
                ]
            }]
        };
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', errText);
            return res.status(500).json({ error: 'Gemini API failed', detail: errText });
        }
        const data = await response.json();
        const prompt = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';
        res.json({ prompt });
    } catch (err) {
        console.error('Analyze image error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---- Background Removal Endpoint (client-side fallback works without key) ----
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

// ---- Video Generation Endpoint (image upload) ----
app.post('/generate-video', upload.array('files'), (req, res) => {
    const files = req.files;
    const userCommand = req.body.command || "तितली उड़ रही है";
    if (!files || files.length === 0) return res.status(400).send('फाइल नहीं मिली।');
    const inputPath = files[0].path;
    const audioPath = path.join(__dirname, `voice_${Date.now()}.mp3`);
    const outputVideoPath = path.join(__dirname, `output_${Date.now()}.mp4`);
    const gtts = new gTTS(userCommand, 'hi');
    gtts.save(audioPath, (err) => {
        if (err) { console.error("Voice error:", err); return res.status(500).send('Voice failed.'); }
        const ffmpegCmd = `ffmpeg -y -loop 1 -i "${inputPath}" -i "${audioPath}" -vf "scale=1280:720,zoompan=z='min(zoom+0.0015,1.2)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720" -map 0:v:0 -map 1:a:0 -c:v libx264 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p "${outputVideoPath}"`;
        exec(ffmpegCmd, (error) => {
            if (error) { console.error("FFmpeg error:", error); return res.status(500).send('Render failed.'); }
            res.sendFile(outputVideoPath, () => {
                [inputPath, audioPath, outputVideoPath].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });
            });
        });
    });
});

// ---- AI 3D Video Generation from Text Prompt (Robust) ----
app.post('/generate-ai-video', async (req, res) => {
    // Set long timeout for this heavy endpoint (5 minutes)
    req.setTimeout(300000);
    res.setTimeout(300000);

    const { prompt, script, style, duration } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    // Limit text to 1500 chars, clean special chars that break shell commands
    const rawScript = (script || prompt).slice(0, 1500).replace(/['"\\`$]/g, ' ');
    const rawPrompt = prompt.slice(0, 500);
    const vidStyle = style || 'cinematic';
    const sceneDuration = Math.max(3, Math.min(parseInt(duration) || 5, 8));

    const tmpDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(tmpDir)) { try { fs.mkdirSync(tmpDir, { recursive: true }); } catch(e){} }

    const ts = Date.now();
    const audioPath  = path.join(tmpDir, `voice_${ts}.mp3`);
    const outputPath = path.join(tmpDir, `video_${ts}.mp4`);
    const concatFile = path.join(tmpDir, `concat_${ts}.txt`);
    const silentPath = path.join(tmpDir, `silent_${ts}.mp4`);
    const allTempFiles = [audioPath, outputPath, concatFile, silentPath];

    const styleMap = {
        cinematic:  'cinematic photography, dramatic lighting, 8K ultra HD, film grain',
        anime:      'anime art style, vibrant colors, studio ghibli inspired, detailed',
        '3d':       '3D render, Pixar style, colorful, studio lighting, high quality CGI',
        realistic:  'photorealistic, DSLR photography, natural lighting, sharp focus',
        watercolor: 'watercolor painting, artistic, soft brush strokes, dreamy',
    };
    const stylePrompt = styleMap[vidStyle] || styleMap.cinematic;

    // Helper: fetch image from Pollinations with retry
    async function fetchImage(imgPrompt, destPath, attempt = 0) {
        const seed = Math.floor(Math.random() * 999999);
        const url  = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt.slice(0, 400))}?width=1280&height=720&nologo=true&seed=${seed}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90000); // 90s per image
        try {
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = await r.arrayBuffer();
            if (buf.byteLength < 5000) throw new Error('Image too small (possible error page)');
            fs.writeFileSync(destPath, Buffer.from(buf));
            return true;
        } catch(e) {
            clearTimeout(timer);
            if (attempt < 2) {
                console.log(`Image retry ${attempt+1}: ${e.message}`);
                await new Promise(r => setTimeout(r, 3000));
                return fetchImage(imgPrompt, destPath, attempt + 1);
            }
            throw new Error(`Image download failed after 3 attempts: ${e.message}`);
        }
    }

    // Helper: run FFmpeg command with timeout
    function runFFmpeg(cmd, timeoutMs = 120000) {
        return new Promise((resolve, reject) => {
            const proc = exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
                if (err) {
                    console.error('FFmpeg error:', stderr || err.message);
                    reject(new Error(stderr ? stderr.slice(-300) : err.message));
                } else resolve();
            });
        });
    }

    // Helper: cleanup all temp files
    function cleanup(extra = []) {
        [...allTempFiles, ...extra].forEach(f => {
            try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch(e) {}
        });
    }

    const sceneFiles = [];
    const clipPaths  = [];

    try {
        // STEP 1: Hindi voiceover via gTTS
        console.log('[Video] Step 1: Generating Hindi voiceover...');
        await new Promise((resolve, reject) => {
            try {
                const gtts = new gTTS(rawScript, 'hi');
                gtts.save(audioPath, (err) => {
                    if (err) reject(new Error('Voice generation failed: ' + err.message));
                    else resolve();
                });
            } catch(e) { reject(new Error('gTTS init failed: ' + e.message)); }
        });
        if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 100) {
            throw new Error('Voice file is empty or missing');
        }

        // STEP 2: Generate 3 scene images from Pollinations
        console.log('[Video] Step 2: Downloading scene images...');
        const scenePrompts = [
            `${rawPrompt}, opening wide establishing shot, ${stylePrompt}`,
            `${rawPrompt}, main subject close-up, dramatic, ${stylePrompt}`,
            `${rawPrompt}, cinematic final wide angle sunset, ${stylePrompt}`,
        ];
        for (let i = 0; i < 3; i++) {
            const imgPath = path.join(tmpDir, `scene_${ts}_${i}.jpg`);
            await fetchImage(scenePrompts[i], imgPath);
            sceneFiles.push(imgPath);
            allTempFiles.push(imgPath);
            console.log(`[Video] Scene ${i+1}/3 downloaded`);
        }

        // STEP 3: Build per-scene video clips (simple scale + slow zoom)
        console.log('[Video] Step 3: Encoding scene clips...');
        const frames = sceneDuration * 25;
        const zooms = [
            `scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720`,
            `scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)-5*on':y='ih/2-(ih/zoom/2)':s=1280x720`,
            `scale=1280:720,zoompan=z='if(lte(zoom,1.0),1.05,max(1.0,zoom-0.001))':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720`,
        ];
        for (let i = 0; i < 3; i++) {
            const clipPath = path.join(tmpDir, `clip_${ts}_${i}.mp4`);
            // Try with zoom effect first, fall back to simple scale
            let cmd = `ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "${zooms[i]}" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${clipPath}"`;
            try {
                await runFFmpeg(cmd, 90000);
            } catch(e) {
                console.log(`[Video] Zoom failed for scene ${i+1}, using simple scale fallback`);
                cmd = `ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${clipPath}"`;
                await runFFmpeg(cmd, 90000);
            }
            clipPaths.push(clipPath);
            allTempFiles.push(clipPath);
            console.log(`[Video] Clip ${i+1}/3 encoded`);
        }

        // STEP 4: Concatenate clips
        console.log('[Video] Step 4: Concatenating clips...');
        fs.writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join('\n'));
        await runFFmpeg(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${silentPath}"`, 60000);

        // STEP 5: Mix in audio (loop audio if shorter than video, trim if longer)
        console.log('[Video] Step 5: Mixing audio...');
        await runFFmpeg(
            `ffmpeg -y -i "${silentPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest "${outputPath}"`,
            60000
        );

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 10000) {
            throw new Error('Output video file is missing or too small');
        }

        console.log('[Video] Done! Sending video...');
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="sachin-ai-video.mp4"');
        res.sendFile(outputPath, { root: '/' }, () => { cleanup([]); });

    } catch (err) {
        console.error('[Video] FAILED:', err.message);
        cleanup([...sceneFiles, ...clipPaths]);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Video generation failed: ' + err.message });
        }
    }
});

// ---- AI Code Generator Endpoint ----
app.post('/generate-code', async (req, res) => {
    const { description, language } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });

    const langInstructions = {
        html: 'Write a complete, beautiful, modern HTML page with embedded CSS and JavaScript. Use gradients, animations, and modern design. Return ONLY the raw HTML code, no markdown fences.',
        css: 'Write complete, beautiful CSS code with modern techniques (flexbox, grid, animations, custom properties). Return ONLY the raw CSS code, no markdown fences.',
        javascript: 'Write clean, modern JavaScript (ES6+) code. Include comments. Return ONLY the raw JS code, no markdown fences.',
        python: 'Write clean, well-commented Python code with proper structure. Return ONLY the raw Python code, no markdown fences.',
        react: 'Write a complete React functional component with hooks. Use modern JSX. Return ONLY the raw JSX/React code, no markdown fences.',
        nodejs: 'Write a complete Node.js/Express server or script. Return ONLY the raw code, no markdown fences.',
        sql: 'Write complete, well-structured SQL queries/schema. Return ONLY the raw SQL code, no markdown fences.',
        java: 'Write clean Java code with proper class structure. Return ONLY the raw Java code, no markdown fences.',
        cpp: 'Write clean C++ code. Return ONLY the raw C++ code, no markdown fences.',
        php: 'Write complete PHP code. Return ONLY the raw PHP code, no markdown fences.',
    };

    const sysPrompt = langInstructions[language] || 'Write clean, well-structured code. Return ONLY the raw code, no markdown fences.';
    const fullPrompt = `${sysPrompt}\n\nUser request: ${description}\n\nIMPORTANT: Return ONLY the code itself — no explanation, no markdown code fences, no \`\`\` blocks. Just the raw code.`;

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = { contents: [{ parts: [{ text: fullPrompt }] }] };
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = await response.text();
            return res.status(500).json({ error: 'Gemini API failed', detail: errText });
        }
        const data = await response.json();
        let code = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Strip any accidental markdown fences
        code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
        res.json({ code, language });
    } catch (err) {
        console.error('Code gen error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---- AI Chat Endpoint ----
app.post('/ai-chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = { contents: [{ parts: [{ text: message }] }] };
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) { const e = await response.text(); return res.status(500).json({ error: e }); }
        const data = await response.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'कोई जवाब नहीं मिला।';
        res.json({ reply });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Universal AI Content Generator (Tools 22-36) ----
app.post('/generate-content', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const e = await response.text(); return res.status(500).json({ error: 'AI API failed: ' + e.slice(0,200) }); }
        const data = await response.json();
        const result = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'कोई result नहीं मिला।';
        res.json({ result });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Health Check ----
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Serve Static Files ----
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`सचिन एआई फोटो स्टूडियो http://0.0.0.0:${PORT} पर रेडी है 🚀`);
});
