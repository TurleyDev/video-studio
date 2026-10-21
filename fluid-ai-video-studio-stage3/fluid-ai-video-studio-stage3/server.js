// Stage 3 optional AI backend. Node 20+; npm install; npm start.
// Never expose REPLICATE_API_TOKEN in browser code or GitHub Pages.
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import 'dotenv/config';
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});
const PORT=Number(process.env.PORT||3000);
const ORIGIN=process.env.ALLOWED_ORIGIN||'http://localhost:5500';
app.use(cors({origin:ORIGIN.split(',').map(s=>s.trim())}));
app.use(express.static('.'));
const token=process.env.REPLICATE_API_TOKEN;
const version=process.env.REPLICATE_MODEL_VERSION;
const imageField=process.env.REPLICATE_IMAGE_FIELD||'image';
async function replicate(path,options={}){
  const response=await fetch('https://api.replicate.com/v1'+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.detail||data.error||`Replicate HTTP ${response.status}`);
  return data;
}
app.get('/api/health',(req,res)=>res.json({online:true,configured:!!(token&&version)}));
app.post('/api/generate',upload.single('image'),async(req,res)=>{
 try{
  if(!token||!version)return res.status(503).json({error:'Configure REPLICATE_API_TOKEN and REPLICATE_MODEL_VERSION in .env'});
  if(!req.file||!['image/png','image/jpeg','image/webp'].includes(req.file.mimetype))return res.status(400).json({error:'Upload a PNG, JPG or WEBP image'});
  const prompt=String(req.body.prompt||'').slice(0,2000);
  const image=`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  // Provider model schemas differ. Set REPLICATE_IMAGE_FIELD to the model's image input name.
  // Add duration/aspect_ratio below only if your chosen model accepts those inputs.
  const input={prompt,[imageField]:image};
  const job=await replicate('/predictions',{method:'POST',body:JSON.stringify({version,input})});
  res.json({id:job.id,status:job.status});
 }catch(e){res.status(502).json({error:e.message})}
});
app.get('/api/jobs/:id',async(req,res)=>{
 try{
  if(!token)return res.status(503).json({error:'AI backend not configured'});
  if(!/^[a-z0-9]+$/i.test(req.params.id))return res.status(400).json({error:'Invalid job ID'});
  const job=await replicate('/predictions/'+req.params.id);
  const output=job.output;
  const video=typeof output==='string'?output:Array.isArray(output)?output.find(x=>typeof x==='string'&&/^https?:/.test(x)):output?.url;
  res.json({id:job.id,status:job.status,error:job.error||null,video_url:video||null});
 }catch(e){res.status(502).json({error:e.message})}
});
app.use((err,req,res,next)=>res.status(err.code==='LIMIT_FILE_SIZE'?413:500).json({error:err.message}));
app.listen(PORT,()=>console.log(`Fluid AI Video Studio backend: http://localhost:${PORT}`));
