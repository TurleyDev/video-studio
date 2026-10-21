import express from 'express';
import multer from 'multer';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express();
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000);
const token=process.env.REPLICATE_API_TOKEN;
const allowed=(process.env.ALLOWED_ORIGIN||'http://localhost:3000').split(',').map(s=>s.trim());
const model='wan-video/wan-2.2-i2v-a14b';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1}});
const jobs=new Map();
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
  res.json({id:prediction.id,status:prediction.status,error:prediction.error||null,video_url:video||null});
 }catch(e){res.status(502).json({error:e.message})}
});
app.use((err,req,res,next)=>res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({error:err.message}));
app.listen(port,()=>console.log(`Fluid AI Video Studio Stage 4: http://localhost:${port}`));
