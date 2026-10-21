import express from 'express';
import multer from 'multer';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const app=express();
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000);
const token=process.env.REPLICATE_API_TOKEN;
const allowed=(process.env.ALLOWED_ORIGIN||'http://localhost:3000').split(',').map(s=>s.trim());
const model='wan-video/wan-2.2-i2v-a14b';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1}});
const jobs=new Map();
const clips=new Map();
const renderJobs=new Map();
const clipDir=path.join(os.tmpdir(),'fluid-video-stage5');
await fs.mkdir(clipDir,{recursive:true});
const clipUpload=multer({storage:multer.diskStorage({destination:clipDir,filename:(_,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:150*1024*1024,files:1}});
const maxClips=20;
function runFFmpeg(args){return new Promise((resolve,reject)=>{const proc=spawn(process.env.FFMPEG_PATH||'ffmpeg',args,{windowsHide:true});let err='';proc.stderr.on('data',d=>err=(err+d.toString()).slice(-3000));proc.on('error',reject);proc.on('close',code=>code===0?resolve():reject(Error('FFmpeg failed: '+err.slice(-800))))})}

const requests=new Map();
const maxJobs=Number(process.env.MAX_JOBS_PER_HOUR||5);
const adminKey=process.env.STUDIO_ACCESS_KEY||'';
app.disable('x-powered-by');
app.use(cors({origin(origin,cb){if(!origin||allowed.includes(origin))cb(null,true);else cb(new Error('Origin not allowed'));}}));
app.use(express.static(root));
app.get('/api/health',(_,res)=>res.json({online:true,configured:!!token,model,requires_access_key:!!adminKey}));
function auth(req,res,next){if(!adminKey)return next();const received=req.get('x-studio-key')||'';const a=Buffer.from(received),b=Buffer.from(adminKey);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Invalid studio access key'});next()}
function rate(req,res,next){const ip=req.ip;const now=Date.now();const recent=(requests.get(ip)||[]).filter(t=>now-t<3600000);if(recent.length>=maxJobs)return res.status(429).json({error:`Hourly generation limit reached (${maxJobs}).`});recent.push(now);requests.set(ip,recent);next()}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:typeof data.error==='string'?data.error:`Replicate HTTP ${response.status}`);return data}
app.post('/api/generate',auth,rate,upload.single('image'),async(req,res)=>{
 try{
  if(!token)return res.status(503).json({error:'Add REPLICATE_API_TOKEN to .env before generating.'});
  if(!req.file||!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype))return res.status(400).json({error:'Upload a JPG, PNG or WebP image.'});
  const prompt=String(req.body.prompt||'').trim().slice(0,1500);
  if(!prompt)return res.status(400).json({error:'Describe how the image should move.'});
  // Upload the image as a hosted file; avoid giant data URLs in prediction payloads.
  const form=new FormData();
  form.append('content',new Blob([req.file.buffer],{type:req.file.mimetype}),req.file.originalname.replace(/[^\w.\-]/g,'_').slice(0,100)||'image.png');
  const uploaded=await api('https://api.replicate.com/v1/files',{method:'POST',body:form});
  const imageUrl=uploaded.urls?.get||uploaded.urls?.download||uploaded.url;
  if(!imageUrl||!/^https:\/\//.test(imageUrl))throw Error('File upload succeeded but no usable image URL was returned.');
  // Wan 2.2 A14B supports image, prompt, resolution and frame settings.
  // 81 frames / 16 fps is ~5 seconds. 10/25/60-second studio settings do not apply to this model.
  const input={image:imageUrl,prompt,num_frames:81,frames_per_second:16,resolution:'480p'};
  const prediction=await api('https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-a14b/predictions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input})});
  if(!prediction.id)throw Error('Model did not return a prediction ID.');
  jobs.set(prediction.id,{created:Date.now()});
  res.json({id:prediction.id,status:prediction.status,model,expected_seconds:5});
 }catch(e){console.error('Generation failed:',e.message);res.status(502).json({error:e.message})}
});
app.get('/api/jobs/:id',auth,async(req,res)=>{
 try{
  if(!token)return res.status(503).json({error:'API token not configured'});
  if(!/^[a-z0-9]+$/i.test(req.params.id)||!jobs.has(req.params.id))return res.status(404).json({error:'Job not found on this server'});
  const prediction=await api(`https://api.replicate.com/v1/predictions/${req.params.id}`);
  const out=prediction.output;
  const video=typeof out==='string'?out:Array.isArray(out)?out.find(x=>typeof x==='string'&&x.startsWith('https://')):out?.url;
  if(prediction.status==='succeeded'&&video){const entry=jobs.get(prediction.id);entry.videoUrl=video;}res.json({id:prediction.id,status:prediction.status,error:prediction.error||null,video_url:video||null});
 }catch(e){res.status(502).json({error:e.message})}
});

// Stage 5 editor: clips are uploaded to the local server, never read from arbitrary remote URLs.
app.post('/api/clips',auth,clipUpload.single('clip'),async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'Choose a video file.'});
 if(!['video/mp4','video/webm','video/quicktime'].includes(req.file.mimetype)){await fs.rm(req.file.path,{force:true});return res.status(400).json({error:'MP4, WebM or MOV only.'});}
 const id=crypto.randomUUID();clips.set(id,{path:req.file.path,created:Date.now()});res.json({id,name:req.file.originalname});
});
app.post('/api/clips/from-job',auth,express.json({limit:'10kb'}),async(req,res)=>{
 try{const job=jobs.get(String(req.body?.id||''));if(!job?.videoUrl)return res.status(404).json({error:'Completed AI job not found. Generate a clip first.'});
 const u=new URL(job.videoUrl);if(u.protocol!=='https:'||!/(^|\.)replicate\.delivery$|(^|\.)replicate\.com$/.test(u.hostname))return res.status(400).json({error:'Unexpected provider video host.'});
 const response=await fetch(u,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Could not download generated video');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>150*1024*1024)throw Error('Clip exceeds 150 MB');const id=crypto.randomUUID();const file=path.join(clipDir,id+'.mp4');await fs.writeFile(file,bytes);clips.set(id,{path:file,created:Date.now()});res.json({id,name:'AI generated clip'});
 }catch(e){res.status(502).json({error:e.message})}
});
app.post('/api/render',auth,express.json({limit:'50kb'}),async(req,res)=>{
 const items=req.body?.clips;const ratio=req.body?.ratio;
 if(!Array.isArray(items)||items.length<1||items.length>maxClips)return res.status(400).json({error:'Select 1–20 clips.'});
 if(!['16:9','9:16','1:1'].includes(ratio))return res.status(400).json({error:'Invalid aspect ratio.'});
 for(const item of items){if(!clips.has(item.id)||!Number.isFinite(item.start)||!Number.isFinite(item.end)||item.start<0||item.end<=item.start||item.end-item.start>120)return res.status(400).json({error:'Invalid clip or trim times.'});}
 const id=crypto.randomUUID();renderJobs.set(id,{status:'processing',created:Date.now()});res.json({id,status:'processing'});
 (async()=>{const job=renderJobs.get(id);const dir=path.join(clipDir,'render-'+id);try{await fs.mkdir(dir);const [w,h]=ratio==='9:16'?[720,1280]:ratio==='1:1'?[720,720]:[1280,720];const parts=[];
 for(let i=0;i<items.length;i++){const item=items[i],file=path.join(dir,`part-${i}.mp4`);parts.push(file);await runFFmpeg(['-hide_banner','-loglevel','error','-y','-ss',String(item.start),'-i',clips.get(item.id).path,'-t',String(item.end-item.start),'-vf',`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,'-an','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p',file]);}
 const concat=path.join(dir,'list.txt');await fs.writeFile(concat,parts.map(f=>`file '${f.replace(/'/g,"'\''")}'`).join('\n'));const output=path.join(dir,'fluid-video.mp4');await runFFmpeg(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',output]);job.status='succeeded';job.output=output;
 }catch(e){job.status='failed';job.error=e.message;console.error('Render failed',e.message)}})();
});
app.get('/api/render/:id',auth,(req,res)=>{const job=renderJobs.get(req.params.id);if(!job)return res.status(404).json({error:'Render not found'});res.json({status:job.status,error:job.error||null,download:job.status==='succeeded'?`/api/render/${req.params.id}/download`:null})});
app.get('/api/render/:id/download',auth,(req,res)=>{const job=renderJobs.get(req.params.id);if(!job||job.status!=='succeeded')return res.status(404).json({error:'Video not ready'});res.download(job.output,'fluid-video.mp4')});

app.use((err,req,res,next)=>res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({error:err.message}));
app.listen(port,()=>console.log(`Fluid AI Video Studio Stage 5: http://localhost:${port}`));
