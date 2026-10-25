/** Explicit foreground execution only. Never installs a recurring service. */
import {readFile,mkdir,lstat,realpath,open,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {KingdomClient} from './client.mjs';
import {ProcurementRun,validateMandate} from './procurement.mjs';

const [flag,manifestFile,directory,seconds='5']=process.argv.slice(2),cadence=Number(seconds);
if(flag!=='--execute'||!manifestFile||!directory||!Number.isInteger(cadence)||cadence<1||cadence>30)throw Error('Usage: procure.mjs --execute <approved-manifest.json> <private-state-directory> [1..30 poll seconds]');
const manifest=validateMandate(JSON.parse(await readFile(manifestFile,'utf8')));
process.umask(0o077);
const folder=resolve(directory),repo=await realpath(fileURLToPath(new URL('..',import.meta.url)));
await mkdir(folder,{recursive:true,mode:0o700});const actual=await realpath(folder),info=await lstat(folder);
if(actual===repo||actual.startsWith(repo+'/')||!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077))throw Error('Use an owner-only real state directory outside the repository');
const lockFolder=join(tmpdir(),`dq-kingdom-writers-${process.getuid?.()??'user'}`);
await mkdir(lockFolder,{mode:0o700,recursive:true});const lockInfo=await lstat(lockFolder);
if(!lockInfo.isDirectory()||lockInfo.isSymbolicLink()||(lockInfo.mode&0o077)||(process.getuid&&lockInfo.uid!==process.getuid()))throw Error('Writer lock directory is not private');
const lockPaths=[join(lockFolder,`${manifest.realm}-${manifest.crown}.lock`),join(folder,'procure.lock')],locks=[];
let stopping=false,checkpoint=null;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
try{
 for(const path of lockPaths){const file=await open(path,'wx',0o600);locks.push({path,file});await file.writeFile(JSON.stringify({pid:process.pid,realm:manifest.realm,crown:manifest.crown,manifest:manifest.id,startedAt:new Date().toISOString()}));await file.sync();}
 const statePath=join(folder,'procurement.json');
 try{const existing=await lstat(statePath);if(!existing.isFile()||existing.isSymbolicLink()||(existing.mode&0o077))throw Error('Existing procurement state is not private');checkpoint=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const save=async value=>{
  const pending=statePath+'.'+randomUUID(),file=await open(pending,'wx',0o600);
  try{await file.writeFile(JSON.stringify(value,null,2));await file.sync();}finally{await file.close();}
  await rename(pending,statePath);const directoryFile=await open(folder,'r');try{await directoryFile.sync();}finally{await directoryFile.close();}
  checkpoint=structuredClone(value);
 };
 const run=new ProcurementRun({manifest,client:new KingdomClient({sessionFile:process.env.DQ_SESSION_FILE}),load:async()=>checkpoint&&structuredClone(checkpoint),save});
 while(true){
  try{
   const state=await run.tick({stop:stopping});
   console.log(JSON.stringify({at:new Date().toISOString(),mandate:manifest.id,crown:manifest.crown,phase:state.phase,time:state.lastTime,revision:state.lastRevision,postAttempts:state.postAttempts,treasury:state.lastObservation?.treasury,operations:state.operations.map(o=>({kind:o.kind,id:o.request.id,status:o.status,order:o.orderId,observed:o.observed})),reason:state.reason}));
   if(['complete','stopped','halted'].includes(state.phase)){if(state.phase==='halted')process.exitCode=2;break;}
  }catch(e){console.error(JSON.stringify({at:new Date().toISOString(),error:e.message,status:e.status,code:e.code}));}
  // A disconnected service cannot extend this foreground run indefinitely.
  // Pending intents remain durable for deliberate reconciliation/restart.
  const cutoff=Math.min(Date.parse(manifest.wallUntil),(checkpoint?.startedAtWall??Date.now())+manifest.maxWallSeconds*1000)+300000;
  if(Date.now()>cutoff){console.error('Cleanup/recovery grace elapsed; preserve state and reconcile before another mandate');process.exitCode=2;break;}
  const until=Date.now()+(stopping?500:cadence*1000);while(Date.now()<until)await new Promise(r=>setTimeout(r,Math.min(1000,until-Date.now())));
 }
}finally{
 for(const {path,file}of locks.reverse()){await file.close();await unlink(path);}
}
