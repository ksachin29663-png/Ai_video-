const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');

const app = express();
const PORT = 5000;

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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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

// ---- AI 3D Video Generation from Text Prompt ----
app.post('/generate-ai-video', async (req, res) => {
    const { prompt, script, style, duration } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    const hindiScript = script || prompt;
    const vidStyle = style || 'cinematic';
    const sceneDuration = Math.max(3, Math.min(parseInt(duration) || 5, 8));
    const numScenes = 3;

    const tmpDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const ts = Date.now();
    const audioPath = path.join(tmpDir, `voice_${ts}.mp3`);
    const outputPath = path.join(tmpDir, `video_${ts}.mp4`);
    const concatFile = path.join(tmpDir, `concat_${ts}.txt`);
    const sceneFiles = [];

    const styleMap = {
        cinematic: 'cinematic photography, dramatic lighting, 8K ultra HD, film grain',
        anime: 'anime art style, vibrant colors, studio ghibli inspired, detailed',
        '3d': '3D render, Pixar style, colorful, studio lighting, high quality CGI',
        realistic: 'photorealistic, DSLR photography, natural lighting, sharp focus',
        watercolor: 'watercolor painting, artistic, soft brush strokes, dreamy',
    };
    const stylePrompt = styleMap[vidStyle] || styleMap.cinematic;

    try {
        // Step 1: Generate Hindi voiceover
        await new Promise((resolve, reject) => {
            const gtts = new gTTS(hindiScript, 'hi');
            gtts.save(audioPath, (err) => err ? reject(err) : resolve());
        });

        // Step 2: Download scene images from Pollinations
        const scenePrompts = [
            `${prompt}, opening scene, wide shot, ${stylePrompt}`,
            `${prompt}, main scene, close up, ${stylePrompt}`,
            `${prompt}, final scene, epic wide angle, ${stylePrompt}`,
        ];

        for (let i = 0; i < numScenes; i++) {
            const seed = Math.floor(Math.random() * 999999);
            const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(scenePrompts[i])}?width=1280&height=720&nologo=true&seed=${seed}`;
            const imgPath = path.join(tmpDir, `scene_${ts}_${i}.jpg`);
            const imgRes = await fetch(imgUrl);
            if (!imgRes.ok) throw new Error('Image fetch failed');
            const imgBuf = await imgRes.arrayBuffer();
            fs.writeFileSync(imgPath, Buffer.from(imgBuf));
            sceneFiles.push(imgPath);
        }

        // Step 3: Build per-scene clips then concat
        const clipPaths = [];
        for (let i = 0; i < numScenes; i++) {
            const clipPath = path.join(tmpDir, `clip_${ts}_${i}.mp4`);
            const zoomDir = i % 2 === 0
                ? `zoompan=z='min(zoom+0.002,1.3)':d=${sceneDuration*25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720`
                : `zoompan=z='min(zoom+0.002,1.3)':d=${sceneDuration*25}:x='iw/2-(iw/zoom/2)+10*on':y='ih/2-(ih/zoom/2)':s=1280x720`;
            await new Promise((resolve, reject) => {
                const cmd = `ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "scale=1280:720,${zoomDir}" -c:v libx264 -pix_fmt yuv420p -r 25 "${clipPath}"`;
                exec(cmd, (err) => err ? reject(err) : resolve());
            });
            clipPaths.push(clipPath);
        }

        // Step 4: Concat clips
        const concatTxt = clipPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(concatFile, concatTxt);
        const silentVideoPath = path.join(tmpDir, `silent_${ts}.mp4`);
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${silentVideoPath}"`, (err) => err ? reject(err) : resolve());
        });

        // Step 5: Mix audio
        await new Promise((resolve, reject) => {
            const cmd = `ffmpeg -y -i "${silentVideoPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`;
            exec(cmd, (err) => err ? reject(err) : resolve());
        });

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="sachin-ai-video.mp4"');
        res.sendFile(outputPath, { root: '/' }, () => {
            const cleanup = [...sceneFiles, ...clipPaths, audioPath, silentVideoPath, outputPath, concatFile];
            cleanup.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });
        });

    } catch (err) {
        console.error('AI Video error:', err);
        const cleanup = [...sceneFiles, audioPath, outputPath, concatFile];
        cleanup.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });
        res.status(500).json({ error: err.message });
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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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

// ---- Serve Static Files ----
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`सचिन एआई फोटो स्टूडियो http://0.0.0.0:${PORT} पर रेडी है 🚀`);
});
