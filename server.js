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
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const REMOVEBG_KEY = process.env.REMOVE_BG_API_KEY;

// ============ AI HELPER — Pollinations first, Gemini fallback ============
async function callAI(messages, retries = 2) {
  // Try Pollinations first (no key needed)
  for (let i = 0; i <= retries; i++) {
    try {
      const seed = Math.floor(Math.random() * 99999);
      const r = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        body: JSON.stringify({ messages, model: 'openai', seed }),
        signal: AbortSignal.timeout(25000)
      });
      if (r.status === 429 && i < retries) { await new Promise(x => setTimeout(x, 3000 * (i + 1))); continue; }
      if (!r.ok) throw new Error('poll_fail_' + r.status);
      const txt = await r.text();
      if (txt && txt.length > 3) return txt;
      throw new Error('empty');
    } catch (e) {
      if (i < retries) { await new Promise(x => setTimeout(x, 2000)); continue; }
    }
  }
  // Fallback: OpenAI or Gemini
  const prompt = messages.map(m => m.content).join('\n');
  if (OPENAI_KEY) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-3.5-turbo', messages })
      });
      const d = await r.json();
      if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
    } catch (e) { console.error('OpenAI fallback failed', e); }
  }

  if (GEMINI_KEY) {
    for (let i = 0; i <= retries; i++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        if (r.status === 429 && i < retries) { await new Promise(x => setTimeout(x, 3000 * (i + 1))); continue; }
        if (!r.ok) throw new Error('gemini_' + r.status);
        const d = await r.json();
        const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) return txt;
      } catch (e) { if (i === retries) break; await new Promise(x => setTimeout(x, 2000)); }
    }
  }
  throw new Error('NO_API_KEY_OR_FAILED');
}

function errJson(res, e) {
  const m = String(e?.message || e || '');
  if (m.includes('NO_KEY')) return res.json({ error: 'no_key', result: '⚠️ API Key नहीं है।', reply: '⚠️ Setup required.' });
  if (m.includes('429') || m.includes('rate') || m.includes('RATE') || m.includes('quota')) 
    return res.json({ error: 'rate_limit', result: '⏳ AI busy है — 30 सेकंड बाद try करें।', reply: '⏳ AI busy है।' });
  return res.json({ error: 'err', result: '❌ ' + m.slice(0, 120), reply: '❌ Error — दोबारा try करें।' });
}

// ============ ROUTES ============
app.post('/ai-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const reply = await callAI([{ role: 'system', content: 'You are a helpful Hindi AI assistant. Always reply in Hindi.' }, { role: 'user', content: message }]);
    res.json({ reply });
  } catch(e) { errJson(res, e); }
});

app.post('/generate-content', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });
  try { res.json({ result: await callAI([{ role: 'user', content: prompt }]) }); }
  catch(e) { errJson(res, e); }
});

app.post('/generate-code', async (req, res) => {
  const { description, language } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  const inst = { html:'Write complete HTML+CSS+JS. Return ONLY raw HTML.', css:'Return ONLY raw CSS.', javascript:'Return ONLY raw JS.', python:'Return ONLY raw Python.', react:'Return ONLY raw JSX.', nodejs:'Return ONLY raw Node.js.', sql:'Return ONLY raw SQL.', java:'Return ONLY raw Java.', cpp:'Return ONLY raw C++.', php:'Return ONLY raw PHP.' };
  const sys = inst[language] || 'Return ONLY the raw code, no markdown.';
  try {
    let code = await callAI([{ role: 'user', content: sys + '\n\nTask: ' + description }]);
    code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
    res.json({ code, language });
  } catch(e) { errJson(res, e); }
});

app.post('/analyze-image', async (req, res) => {
  const { imageBase64, mimeType, instruction } = req.body;
  if (!imageBase64 || !instruction) return res.status(400).json({ error: 'Missing fields' });
  if (!GEMINI_KEY) return errJson(res, new Error('NO_KEY'));
  for (let i = 0; i <= 2; i++) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contents:[{ parts:[{ inline_data:{ mime_type: mimeType||'image/jpeg', data: imageBase64 }},{ text: instruction }]}]}) });
      if (r.status === 429 && i < 2) { await new Promise(x=>setTimeout(x,3000*(i+1))); continue; }
      if (!r.ok) throw new Error('gemini_' + r.status);
      const d = await r.json();
      const result = d?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
      return res.json({ prompt: result, result });
    } catch(e) { if (i === 2) return errJson(res, e); await new Promise(x=>setTimeout(x,2000)); }
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
      const r = await fetch('https://api.remove.bg/v1.0/removebg', { method:'POST', headers:{'X-Api-Key':REMOVEBG_KEY,...fd.getHeaders()}, body:fd });
      if (r.ok) { const buf = await r.arrayBuffer(); res.set('Content-Type','image/png'); return res.send(Buffer.from(buf)); }
    }
    res.status(200).send('client-side-fallback');
  } catch(e) { res.status(200).send('client-side-fallback'); }
  finally { try { if(fs.existsSync(fp)) fs.unlinkSync(fp); } catch(e){} }
});

app.post('/generate-video-script', async (req, res) => {
  const { topic, style, duration } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });
  const sc = Math.max(3, Math.min(parseInt(duration)||7, 8));
  const wc = Math.floor(sc*3*2.2);
  const prompt = `Topic: "${topic}"\nStyle: ${style||'Cinematic'}\nWords: ~${wc}\n\nWrite a complete Hindi voiceover script in Devanagari. Return ONLY the Hindi text, no headings, no English.`;
  try { res.json({ script: await callAI([{ role: 'user', content: prompt }]) }); }
  catch(e) { errJson(res, e); }
});

const videoJobs = {};
setInterval(() => { const t=Date.now()-30*60*1000; for(const id in videoJobs){ if(videoJobs[id].createdAt<t){ const j=videoJobs[id]; if(j.outputPath&&fs.existsSync(j.outputPath)) try{fs.unlinkSync(j.outputPath);}catch(e){} delete videoJobs[id]; } } }, 10*60*1000);
app.get('/video-job/:id', (req,res) => { const j=videoJobs[req.params.id]; if(!j) return res.status(404).json({error:'Not found'}); res.json({status:j.status,step:j.step,progress:j.progress,error:j.error||null,downloadUrl:j.status==='done'?`/video-download/${req.params.id}`:null}); });
app.get('/video-download/:id', (req,res) => { const j=videoJobs[req.params.id]; if(!j||j.status!=='done'||!fs.existsSync(j.outputPath)) return res.status(404).json({error:'Not ready'}); res.setHeader('Content-Type','video/mp4'); res.setHeader('Content-Disposition','attachment; filename="video.mp4"'); res.sendFile(j.outputPath,{root:'/'},(e)=>{ if(!e) setTimeout(()=>{try{fs.unlinkSync(j.outputPath);}catch(e){} delete videoJobs[req.params.id];},10000); }); });

app.post('/generate-ai-video', upload.array('photos',3), (req,res) => {
  const {prompt,script,style,duration}=req.body;
  if(!prompt) return res.status(400).json({error:'Prompt required'});
  const jobId=`job_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  videoJobs[jobId]={status:'processing',step:'शुरू हो रहा है...',progress:0,createdAt:Date.now(),outputPath:null,error:null};
  res.json({jobId});
  runVideoJob(jobId,req.files||[],{prompt,script,style,duration});
});

async function runVideoJob(jobId,photos,{prompt,script,style,duration}) {
  const j=videoJobs[jobId];
  const set=(s,p)=>{if(j){j.step=s;j.progress=p;}};
  const fail=(m)=>{if(j){j.status='error';j.step=m;j.error=m;}};
  const sc=Math.max(3,Math.min(parseInt(duration)||7,8));
  const tmp=path.join(__dirname,'uploads'); const ts=Date.now();
  const ap=path.join(tmp,`v_${ts}.mp3`), op=path.join(tmp,`out_${ts}.mp4`), cf=path.join(tmp,`c_${ts}.txt`), sp=path.join(tmp,`s_${ts}.mp4`);
  const sf=[],cp=[],tmp2=[ap,cf,sp];
  const ffmpeg=(cmd,t=120000)=>new Promise((res,rej)=>exec(cmd,{timeout:t},(e,_,se)=>e?rej(new Error(se?se.slice(-200):e.message)):res()));
  const dl=async(url,dest,ms=35000)=>{ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); try{ const r=await fetch(url,{signal:c.signal}); clearTimeout(t); if(!r.ok)throw new Error('HTTP '+r.status); const b=await r.arrayBuffer(); if(b.byteLength<5000)throw new Error('Too small'); fs.writeFileSync(dest,Buffer.from(b)); return b.byteLength; }catch(e){clearTimeout(t);throw e;} };
  const getImg=async(pr,dest)=>{ const s=Math.floor(Math.random()*999999); const e=encodeURIComponent(pr.slice(0,300));
    try{await dl(`https://image.pollinations.ai/prompt/${e}?width=1280&height=720&nologo=true&seed=${s}&model=flux`,dest,40000);return;}catch(e){}
    try{await dl(`https://image.pollinations.ai/prompt/${e}?width=1280&height=720&nologo=true&seed=${s+1}`,dest,40000);return;}catch(e){}
    try{await dl(`https://picsum.photos/seed/${s%500}/1280/720`,dest,20000);return;}catch(e){}
    exec(`ffmpeg -y -f lavfi -i "color=c=#0a1628:s=1280x720" -frames:v 1 "${dest}"`,{timeout:10000},()=>{}); };
  try {
    set('🎙️ Voiceover बन रहा है...',5);
    try{
      if(!OPENAI_KEY) throw new Error('no key');
      const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{'Authorization':'Bearer '+OPENAI_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'tts-1',input:(script||prompt).slice(0,4096),voice:'nova',response_format:'mp3'})});
      if(!r.ok) throw new Error('OpenAI fail');
      fs.writeFileSync(ap,Buffer.from(await r.arrayBuffer()));
    }catch(e){
      if(!gTTS) throw new Error('No TTS available');
      await new Promise((res,rej)=>{ const g=new gTTS((script||prompt).slice(0,500),'hi'); g.save(ap,e=>e?rej(e):res()); });
    }
    if(!fs.existsSync(ap)||fs.statSync(ap).size<100) throw new Error('Voice empty');
    const styleP={cinematic:'cinematic photography, dramatic lighting, 8K',anime:'anime art style, vibrant studio ghibli','3d':'3D Pixar CGI render',realistic:'photorealistic DSLR photography',watercolor:'watercolor painting artistic'}[style||'cinematic']||'cinematic photography';
    for(let i=0;i<3;i++){
      set(`🖼️ Scene ${i+1}/3...`,10+i*15);
      const ip=path.join(tmp,`sc_${ts}_${i}.jpg`);
      if(photos[i]){ await ffmpeg(`ffmpeg -y -i "${photos[i].path}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1" "${ip}"`,30000); }
      else { await getImg(`${prompt}, scene ${i+1}, ${styleP}`,ip); }
      sf.push(ip); tmp2.push(ip);
    }
    const fr=sc*25;
    for(let i=0;i<3;i++){
      set(`🎬 Clip ${i+1}/3 encode...`,50+i*10);
      const cl=path.join(tmp,`cl_${ts}_${i}.mp4`);
      try{ await ffmpeg(`ffmpeg -y -loop 1 -t ${sc} -i "${sf[i]}" -vf "scale=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${fr}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${cl}"`,90000); }
      catch(e){ await ffmpeg(`ffmpeg -y -loop 1 -t ${sc} -i "${sf[i]}" -vf "scale=1280:720" -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p -r 25 "${cl}"`,90000); }
      cp.push(cl); tmp2.push(cl);
    }
    set('🔗 Clips जोड़ रहे हैं...',82);
    fs.writeFileSync(cf,cp.map(p=>`file '${p}'`).join('\n'));
    await ffmpeg(`ffmpeg -y -f concat -safe 0 -i "${cf}" -c copy "${sp}"`,60000);
    set('🎵 Audio mix...',90);
    await ffmpeg(`ffmpeg -y -i "${sp}" -i "${ap}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest "${op}"`,60000);
    if(!fs.existsSync(op)||fs.statSync(op).size<10000) throw new Error('Video too small');
    j.status='done'; j.step='✅ तैयार है!'; j.progress=100; j.outputPath=op;
    tmp2.filter(f=>f!==op).forEach(f=>{try{if(f&&fs.existsSync(f))fs.unlinkSync(f);}catch(e){}});
    photos.forEach(p=>{try{if(p.path&&fs.existsSync(p.path))fs.unlinkSync(p.path);}catch(e){}});
  } catch(err) {
    [...tmp2,...sf,...cp].forEach(f=>{try{if(f&&fs.existsSync(f))fs.unlinkSync(f);}catch(e){}});
    photos.forEach(p=>{try{if(p.path&&fs.existsSync(p.path))fs.unlinkSync(p.path);}catch(e){}});
    fail('❌ Error: '+err.message);
  }
}

app.get('/health', (req,res)=>res.json({status:'ok',gemini:!!GEMINI_KEY,openai:!!OPENAI_KEY,removebg:!!REMOVEBG_KEY}));
app.use(express.static(path.join(__dirname)));
app.get('*',(req,res)=>{ const p=req.path.replace(/^\//,'')||'index.html'; const fp=path.join(__dirname,p.includes('.')?p:p+'.html'); if(fs.existsSync(fp)) res.sendFile(fp); else res.sendFile(path.join(__dirname,'index.html')); });

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`✅ Server: http://0.0.0.0:${PORT}`);
  console.log(`   AI: Pollinations (primary) + Gemini ${GEMINI_KEY?'✅':'❌'} (fallback)`);
});
