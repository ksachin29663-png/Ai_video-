const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Use gTTS with fallback
let gTTS;
try { gTTS = require('gtts'); } catch(e) { gTTS = null; }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

function noKeyResponse(res, toolName) {
  return res.status(200).json({
    reply: `⚠️ ${toolName} के लिए GEMINI_API_KEY चाहिए। Replit के Secrets में GEMINI_API_KEY add करें। Free key: https://aistudio.google.com/apikey`,
    result: `⚠️ ${toolName} के लिए GEMINI_API_KEY चाहिए। Replit के Secrets में GEMINI_API_KEY add करें। Free key: https://aistudio.google.com/apikey`,
    error: 'no_api_key'
  });
}

// ---- OpenAI TTS Helper ----
async function generateOpenAIVoiceover(text, outputPath) {
  if (!OPENAI_API_KEY) throw new Error('No OpenAI key');
  const shortText = text.slice(0, 4096);
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: shortText, voice: 'nova', response_format: 'mp3', speed: 0.95 })
  });
  if (!response.ok) { const err = await response.text(); throw new Error('OpenAI TTS failed: ' + err.slice(0, 200)); }
  const buf = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buf));
  if (fs.statSync(outputPath).size < 100) throw new Error('OpenAI TTS: empty audio');
}

// ---- Gemini API Helper ----
async function callGemini(prompt) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!response.ok) { const e = await response.text(); throw new Error('Gemini failed: ' + e.slice(0, 200)); }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'कोई जवाब नहीं मिला।';
}

// ---- AI Chat ----
app.post('/ai-chat', async (req, res) => {
  if (!GEMINI_API_KEY) return noKeyResponse(res, 'AI Chat');
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const reply = await callGemini(message);
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Universal Content Generator ----
app.post('/generate-content', async (req, res) => {
  if (!GEMINI_API_KEY) return noKeyResponse(res, 'Content Generator');
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });
  try {
    const result = await callGemini(prompt);
    res.json({ result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Code Generator ----
app.post('/generate-code', async (req, res) => {
  if (!GEMINI_API_KEY) return noKeyResponse(res, 'Code Generator');
  const { description, language } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  const langMap = {
    html: 'Write a complete HTML page with CSS and JS. Return ONLY raw HTML, no markdown.',
    css: 'Write CSS code. Return ONLY raw CSS, no markdown.',
    javascript: 'Write JS (ES6+). Return ONLY raw JS, no markdown.',
    python: 'Write Python. Return ONLY raw Python, no markdown.',
    react: 'Write React functional component. Return ONLY raw JSX, no markdown.',
    nodejs: 'Write Node.js/Express code. Return ONLY raw code, no markdown.',
    sql: 'Write SQL. Return ONLY raw SQL, no markdown.',
    java: 'Write Java. Return ONLY raw Java, no markdown.',
    cpp: 'Write C++. Return ONLY raw C++, no markdown.',
    php: 'Write PHP. Return ONLY raw PHP, no markdown.',
  };
  const sysPrompt = langMap[language] || 'Write clean code. Return ONLY raw code, no markdown.';
  try {
    let code = await callGemini(`${sysPrompt}\n\nRequest: ${description}\n\nReturn ONLY the code.`);
    code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
    res.json({ code, language });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Image Analysis (Gemini Vision) ----
app.post('/analyze-image', async (req, res) => {
  if (!GEMINI_API_KEY) return noKeyResponse(res, 'Image Analysis');
  const { imageBase64, mimeType, instruction } = req.body;
  if (!imageBase64 || !instruction) return res.status(400).json({ error: 'Missing imageBase64 or instruction' });
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
        { text: instruction }
      ]}]})
    });
    if (!response.ok) { const e = await response.text(); return res.status(500).json({ error: e }); }
    const data = await response.json();
    const prompt = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    res.json({ prompt, result: prompt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Background Removal ----
app.post('/remove-background', upload.single('image_file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const filePath = req.file.path;
  try {
    if (REMOVE_BG_API_KEY) {
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('image_file', fs.createReadStream(filePath));
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': REMOVE_BG_API_KEY, ...formData.getHeaders() },
        body: formData
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', 'image/png');
        res.send(Buffer.from(buffer));
        return;
      }
    }
    res.status(200).send('client-side-fallback');
  } catch (err) {
    res.status(200).send('client-side-fallback');
  } finally {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e) {}
  }
});

// ---- Video Script Writer ----
app.post('/generate-video-script', async (req, res) => {
  const { topic, style, duration } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });

  if (GEMINI_API_KEY) {
    try {
      const sceneDur = Math.max(3, Math.min(parseInt(duration) || 7, 8));
      const totalSec = sceneDur * 3;
      const wordCount = Math.floor(totalSec * 2.2);
      const styleNames = { cinematic: 'Cinematic', anime: 'Anime', '3d': '3D CGI', realistic: 'Realistic', watercolor: 'Watercolor' };
      const styleName = styleNames[style] || 'Cinematic';
      const prompt = `Topic: "${topic}"\nStyle: ${styleName}\nDuration: ~${totalSec} sec\nWords: ~${wordCount}\n\nWrite a complete Hindi voiceover script. Return ONLY Hindi text in Devanagari, no headings, no English.`;
      const script = await callGemini(prompt);
      return res.json({ script });
    } catch(err) { /* fall through to error */ }
  }

  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `Write a ~30 word Hindi Devanagari voiceover script for: ${topic}. Return ONLY the Hindi text.` }],
          max_tokens: 200
        })
      });
      if (response.ok) {
        const data = await response.json();
        const script = data?.choices?.[0]?.message?.content?.trim();
        if (script) return res.json({ script });
      }
    } catch(e) {}
  }

  res.status(200).json({ error: 'API key required', script: `⚠️ Video Script के लिए GEMINI_API_KEY चाहिए। Replit Secrets में add करें।` });
});

// ---- Video Job System ----
const videoJobs = {};
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const id in videoJobs) {
    if (videoJobs[id].createdAt < cutoff) {
      const j = videoJobs[id];
      if (j.outputPath && fs.existsSync(j.outputPath)) { try { fs.unlinkSync(j.outputPath); } catch(e) {} }
      delete videoJobs[id];
    }
  }
}, 10 * 60 * 1000);

app.get('/video-job/:id', (req, res) => {
  const job = videoJobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, step: job.step, progress: job.progress, error: job.error || null,
    downloadUrl: job.status === 'done' ? `/video-download/${req.params.id}` : null });
});

app.get('/video-download/:id', (req, res) => {
  const job = videoJobs[req.params.id];
  if (!job || job.status !== 'done') return res.status(404).json({ error: 'Video not ready' });
  if (!fs.existsSync(job.outputPath)) return res.status(404).json({ error: 'File missing' });
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="sachin-ai-video.mp4"');
  res.sendFile(job.outputPath, { root: '/' }, (err) => {
    if (!err) setTimeout(() => { try { fs.unlinkSync(job.outputPath); } catch(e) {} delete videoJobs[req.params.id]; }, 10000);
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

app.post('/generate-video', upload.array('files'), (req, res) => {
  const files = req.files;
  const userCommand = req.body.command || "तितली उड़ रही है";
  if (!files || files.length === 0) return res.status(400).send('फाइल नहीं मिली।');
  const inputPath = files[0].path;
  const audioPath = path.join(__dirname, `voice_${Date.now()}.mp3`);
  const outputVideoPath = path.join(__dirname, `output_${Date.now()}.mp4`);
  if (!gTTS) return res.status(500).send('gTTS not available');
  const gtts = new gTTS(userCommand, 'hi');
  gtts.save(audioPath, (err) => {
    if (err) return res.status(500).send('Voice failed.');
    const ffmpegCmd = `ffmpeg -y -loop 1 -i "${inputPath}" -i "${audioPath}" -vf "scale=1280:720" -map 0:v:0 -map 1:a:0 -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p "${outputVideoPath}"`;
    exec(ffmpegCmd, (error) => {
      if (error) return res.status(500).send('Render failed.');
      res.sendFile(outputVideoPath, () => {
        [inputPath, audioPath, outputVideoPath].forEach(f => { try { if(fs.existsSync(f)) fs.unlinkSync(f); } catch(e){} });
      });
    });
  });
});

// ---- Background Video Worker ----
async function runVideoJob(jobId, uploadedPhotos, { prompt, script, style, duration }) {
  const job = videoJobs[jobId];
  function setStep(step, progress) { if (job) { job.step = step; job.progress = progress; } }
  function fail(msg) { if (job) { job.status = 'error'; job.step = msg; job.error = msg; } }

  const rawScript = (script || prompt).slice(0, 1500).replace(/['"\\`$]/g, ' ');
  const rawPrompt = prompt.slice(0, 500);
  const vidStyle = style || 'cinematic';
  const sceneDuration = Math.max(3, Math.min(parseInt(duration) || 7, 8));
  const tmpDir = path.join(__dirname, 'uploads');
  const ts = Date.now();
  const audioPath = path.join(tmpDir, `voice_${ts}.mp3`);
  const outputPath = path.join(tmpDir, `video_${ts}.mp4`);
  const concatFile = path.join(tmpDir, `concat_${ts}.txt`);
  const silentPath = path.join(tmpDir, `silent_${ts}.mp4`);
  const allTempFiles = [audioPath, concatFile, silentPath];
  const sceneFiles = [];
  const clipPaths = [];

  function cleanup() {
    [...allTempFiles, ...sceneFiles, ...clipPaths].forEach(f => { try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch(e) {} });
    uploadedPhotos.forEach(p => { try { if (p.path && fs.existsSync(p.path)) fs.unlinkSync(p.path); } catch(e) {} });
  }

  const styleMap = { cinematic: 'cinematic photography, dramatic lighting, 8K', anime: 'anime art style, vibrant', '3d': '3D Pixar style CGI', realistic: 'photorealistic DSLR', watercolor: 'watercolor painting artistic' };
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
    try { await downloadUrl(`https://image.pollinations.ai/prompt/${enc}?width=1280&height=720&nologo=true&seed=${seed}&model=flux`, destPath, 40000); return true; } catch(e) {}
    try { await downloadUrl(`https://image.pollinations.ai/prompt/${enc}?width=1280&height=720&nologo=true&seed=${seed+1}`, destPath, 40000); return true; } catch(e) {}
    try { await downloadUrl(`https://picsum.photos/seed/${seed % 500}/1280/720`, destPath, 20000); return true; } catch(e) {}
    exec(`ffmpeg -y -f lavfi -i "color=c=#0a1628:s=1280x720" -frames:v 1 "${destPath}"`, { timeout: 10000 }, () => {});
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
    try { await generateOpenAIVoiceover(rawScript, audioPath); } catch(e) {
      if (!gTTS) throw new Error('No TTS available');
      await new Promise((resolve, reject) => {
        const gtts = new gTTS(rawScript.slice(0, 500), 'hi');
        gtts.save(audioPath, (err) => err ? reject(err) : resolve());
      });
    }
    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 100) throw new Error('Voice file empty');

    const scenePrompts = [
      `${rawPrompt}, opening wide shot, ${stylePrompt}`,
      `${rawPrompt}, main subject close-up, ${stylePrompt}`,
      `${rawPrompt}, cinematic final shot, ${stylePrompt}`,
    ];
    for (let i = 0; i < 3; i++) {
      setStep(`🖼️ Scene ${i+1}/3 image बन रही है...`, 10 + i * 15);
      const imgPath = path.join(tmpDir, `scene_${ts}_${i}.jpg`);
      if (uploadedPhotos[i]) {
        await runFFmpeg(`ffmpeg -y -i "${uploadedPhotos[i].path}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1" "${imgPath}"`, 30000);
      } else {
        await fetchImage(scenePrompts[i], imgPath);
      }
      sceneFiles.push(imgPath); allTempFiles.push(imgPath);
    }

    const frames = sceneDuration * 25;
    for (let i = 0; i < 3; i++) {
      setStep(`🎬 Scene ${i+1}/3 encode हो रही है...`, 50 + i * 10);
      const clipPath = path.join(tmpDir, `clip_${ts}_${i}.mp4`);
      try {
        await runFFmpeg(`ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${clipPath}"`, 90000);
      } catch(e) {
        await runFFmpeg(`ffmpeg -y -loop 1 -t ${sceneDuration} -i "${sceneFiles[i]}" -vf "scale=1280:720" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${clipPath}"`, 90000);
      }
      clipPaths.push(clipPath); allTempFiles.push(clipPath);
    }

    setStep('🔗 Clips जोड़े जा रहे हैं...', 82);
    fs.writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join('\n'));
    await runFFmpeg(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${silentPath}"`, 60000);

    setStep('🎵 Audio mix हो रहा है...', 90);
    await runFFmpeg(`ffmpeg -y -i "${silentPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest "${outputPath}"`, 60000);

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 10000) throw new Error('Video too small or missing');
    job.status = 'done'; job.step = '✅ Video तैयार है!'; job.progress = 100; job.outputPath = outputPath;
    [...allTempFiles.filter(f => f !== outputPath), ...sceneFiles, ...clipPaths].forEach(f => { try { if(f && fs.existsSync(f)) fs.unlinkSync(f); } catch(e) {} });
  } catch(err) { cleanup(); fail('Error: ' + err.message); }
}

// ---- Health Check ----
app.get('/health', (req, res) => res.json({ status: 'ok', gemini: !!GEMINI_API_KEY, openai: !!OPENAI_API_KEY, removebg: !!REMOVE_BG_API_KEY }));

// ---- Serve Static Files ----
app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  const page = req.path.replace(/^\//, '') || 'index.html';
  const filePath = path.join(__dirname, page.endsWith('.html') || page.includes('.') ? page : page + '.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Sachin AI Studio चालू है: http://0.0.0.0:${PORT}`);
  console.log(`   Gemini API: ${GEMINI_API_KEY ? '✅ Connected' : '❌ Missing (add GEMINI_API_KEY in Secrets)'}`);
  console.log(`   OpenAI API: ${OPENAI_API_KEY ? '✅ Connected' : '⚠️  Optional'}`);
});
