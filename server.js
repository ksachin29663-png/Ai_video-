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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

// ---- Gemini with retry ----
async function callGemini(prompt, retries = 3) {
  if (!GEMINI_API_KEY) throw new Error('NO_KEY');
  for (let i = 0; i <= retries; i++) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (res.status === 429) {
        if (i < retries) { await new Promise(r => setTimeout(r, 2000 * (i + 1))); continue; }
        throw new Error('RATE_LIMIT');
      }
      if (!res.ok) { const e = await res.text(); throw new Error('API_ERROR:' + res.status); }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('EMPTY');
      return text;
    } catch(e) {
      if (i === retries) throw e;
      if (e.message === 'RATE_LIMIT' || e.message === 'NO_KEY' || e.message === 'EMPTY') throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

function errResp(res, err) {
  const msg = err.message || '';
  if (msg === 'NO_KEY') return res.json({ error: 'no_key', result: '⚠️ GEMINI_API_KEY नहीं है। Replit Secrets में add करें।', reply: '⚠️ GEMINI_API_KEY नहीं है।' });
  if (msg === 'RATE_LIMIT') return res.json({ error: 'rate_limit', result: '⏳ बहुत requests आ गई हैं। 30 सेकंड बाद try करें।', reply: '⏳ बहुत requests आ गई हैं। 30 सेकंड बाद try करें।' });
  return res.json({ error: 'api_error', result: '❌ Error: ' + msg.slice(0,100), reply: '❌ Error हुआ, दोबारा try करें।' });
}

// ---- Routes ----
app.post('/ai-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try { res.json({ reply: await callGemini(message) }); } catch(e) { errResp(res, e); }
});

app.post('/generate-content', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });
  try { res.json({ result: await callGemini(prompt) }); } catch(e) { errResp(res, e); }
});

app.post('/generate-code', async (req, res) => {
  const { description, language } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  const langMap = { html:'Write complete HTML with CSS+JS. ONLY raw HTML, no markdown.', css:'Write CSS. ONLY raw CSS.', javascript:'Write JS ES6+. ONLY raw JS.', python:'Write Python. ONLY raw Python.', react:'Write React component. ONLY raw JSX.', nodejs:'Write Node.js code. ONLY raw code.', sql:'Write SQL. ONLY raw SQL.', java:'Write Java. ONLY raw Java.', cpp:'Write C++. ONLY raw C++.', php:'Write PHP. ONLY raw PHP.' };
  const sys = langMap[language] || 'Write clean code. ONLY raw code, no markdown.';
  try {
    let code = await callGemini(`${sys}\n\nRequest: ${description}\n\nReturn ONLY the code, no explanation.`);
    code = code.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
    res.json({ code, language });
  } catch(e) { errResp(res, e); }
});

app.post('/analyze-image', async (req, res) => {
  const { imageBase64, mimeType, instruction } = req.body;
  if (!imageBase64 || !instruction) return res.status(400).json({ error: 'Missing fields' });
  if (!GEMINI_API_KEY) return errResp(res, new Error('NO_KEY'));
  try {
    for (let i = 0; i <= 2; i++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contents:[{ parts:[{ inline_data:{ mime_type: mimeType||'image/jpeg', data: imageBase64 }},{ text: instruction }]}]}) });
      if (r.status === 429 && i < 2) { await new Promise(x=>setTimeout(x,2000*(i+1))); continue; }
      if (!r.ok) throw new Error('API_ERROR:' + r.status);
      const d = await r.json();
      const prompt = d?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
      return res.json({ prompt, result: prompt });
    }
  } catch(e) { errResp(res, e); }
});

app.post('/remove-background', upload.single('image_file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file');
  const fp = req.file.path;
  try {
    if (REMOVE_BG_API_KEY) {
      const FormData = require('form-data');
      const fd = new FormData();
      fd.append('image_file', fs.createReadStream(fp));
      const r = await fetch('https://api.remove.bg/v1.0/removebg', { method:'POST', headers:{'X-Api-Key':REMOVE_BG_API_KEY,...fd.getHeaders()}, body:fd });
      if (r.ok) { const buf=await r.arrayBuffer(); res.set('Content-Type','image/png'); return res.send(Buffer.from(buf)); }
    }
    res.status(200).send('client-side-fallback');
  } catch(e) { res.status(200).send('client-side-fallback'); }
  finally { try { if(fs.existsSync(fp)) fs.unlinkSync(fp); } catch(e){} }
});

app.post('/generate-video-script', async (req, res) => {
  const { topic, style, duration } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic required' });
  const styleNames = { cinematic:'Cinematic', anime:'Anime', '3d':'3D CGI', realistic:'Realistic', watercolor:'Watercolor' };
  const sn = styleNames[style] || 'Cinematic';
  const sc = Math.max(3,Math.min(parseInt(duration)||7,8));
  const wc = Math.floor(sc*3*2.2);
  const prompt = `Topic: "${topic}"\nStyle: ${sn}\nWords: ~${wc}\n\nWrite a complete Hindi voiceover script in Devanagari. Return ONLY the Hindi text, no headings, no English.`;
  try { res.json({ script: await callGemini(prompt) }); } catch(e) { errResp(res, e); }
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
      if(!OPENAI_API_KEY) throw new Error('no key');
      const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{'Authorization':'Bearer '+OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'tts-1',input:(script||prompt).slice(0,4096),voice:'nova',response_format:'mp3'})});
      if(!r.ok) throw new Error('OpenAI fail');
      fs.writeFileSync(ap,Buffer.from(await r.arrayBuffer()));
    }catch(e){
      if(!gTTS) throw new Error('No TTS');
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

app.get('/health', (req,res)=>res.json({status:'ok',gemini:!!GEMINI_API_KEY,openai:!!OPENAI_API_KEY,removebg:!!REMOVE_BG_API_KEY}));
app.use(express.static(path.join(__dirname)));
app.get('*',(req,res)=>{
  const p=req.path.replace(/^\//,'')||'index.html';
  const fp=path.join(__dirname,p.includes('.')?p:p+'.html');
  if(fs.existsSync(fp)) res.sendFile(fp);
  else res.sendFile(path.join(__dirname,'index.html'));
});

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`✅ Sachin AI Studio: http://0.0.0.0:${PORT}`);
  console.log(`   Gemini: ${GEMINI_API_KEY?'✅':'❌ MISSING'} | OpenAI: ${OPENAI_API_KEY?'✅':'⚠️ optional'}`);
});
