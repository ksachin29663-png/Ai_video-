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

const GEMINI_API_KEY = "AIzaSyBPWiuNiYNrPxPlcbIT_6ZfHNrwV5jQlWM";

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

// ---- Video Generation Endpoint ----
app.post('/generate-video', upload.array('files'), (req, res) => {
    const files = req.files;
    const userCommand = req.body.command || "तितली उड़ रही है";

    if (!files || files.length === 0) {
        return res.status(400).send('फाइल नहीं मिली।');
    }

    const inputPath = files[0].path;
    const audioPath = path.join(__dirname, 'voice.mp3');
    const outputVideoPath = path.join(__dirname, 'final_output.mp4');

    console.log(`कस्टमर की स्क्रिप्ट: ${userCommand}`);
    console.log("1. हिंदी वॉइस-ओवर फाइल बन रही है...");

    const gtts = new gTTS(userCommand, 'hi');
    gtts.save(audioPath, (err) => {
        if (err) {
            console.error("वॉइस जनरेशन फेल:", err);
            return res.status(500).send('वॉइस फेल।');
        }

        console.log("2. FFmpeg वीडियो बना रहा है...");
        const ffmpegCmd = `ffmpeg -y -loop 1 -i "${inputPath}" -i "${audioPath}" -vf "scale=1280:720,zoompan=z='min(zoom+0.0015,1.2)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720" -map 0:v:0 -map 1:a:0 -c:v libx264 -c:a aac -b:a 192k -shortest -pix_fmt yuv420p "${outputVideoPath}"`;

        exec(ffmpegCmd, (error) => {
            if (error) {
                console.error("FFmpeg एरर:", error);
                return res.status(500).send('रेंडर फेल।');
            }
            console.log("वीडियो रेडी!");
            res.sendFile(outputVideoPath, () => {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
            });
        });
    });
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

// ---- Serve Static Files ----
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`सचिन एआई फोटो स्टूडियो http://0.0.0.0:${PORT} पर रेडी है 🚀`);
});
