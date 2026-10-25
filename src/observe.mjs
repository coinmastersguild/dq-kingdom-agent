/** Bounded, read-only startup run. State directory must remain private. */
import {mkdir,open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {KingdomClient} from './client.mjs';
const [crown,directory,seconds='900',interval='15']=process.argv.slice(2),duration=Number(seconds),cadence=Number(interval);
if(!['coinfall','freehold'].includes(crown)||!directory||!Number.isInteger(duration)||duration<15||duration>3600||!Number.isInteger(cadence)||cadence<5||cadence>60)throw Error('Usage: observe.mjs <coinfall|freehold> <private-state-directory> [15..3600 seconds] [5..60 interval]');
const folder=resolve(directory);if(folder===process.cwd()||folder.startsWith(resolve(process.cwd())+'/'))throw Error('Keep observation state outside the repository');
process.umask(0o077);await mkdir(folder,{recursive:true,mode:0o700});
const lockPath=join(folder,'observe.lock'),lock=await open(lockPath,'wx',0o600);await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
const client=new KingdomClient({sessionFile:process.env.DQ_SESSION_FILE}),statePath=join(folder,'observer.json'),log=await open(join(folder,'observations.ndjson'),'a',0o600);let stopped=false;
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
let persisted={crown,cursor:'0',observations:0,events:0,taxCopper:{GOLD:0,DQS:0}};
try{
 try{persisted=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(persisted.crown!==crown)throw Error('State directory belongs to another crown');
 const deadline=Date.now()+duration*1000;
 while(!stopped&&Date.now()<deadline){
  try{
   const me=await client.me(),item=me.crowns.find(c=>c.crown===crown);if(!item)throw Object.assign(Error('Crown required; observation run stopped'),{status:403});
   const state=await client.state(crown),ownMarkets=new Set(state.view.marketPolicies.map(m=>m.settlement)),received=[];
   for(let page=0;page<20;page++){
    const batch=await client.events(crown,persisted.cursor);received.push(...batch.events);persisted.cursor=batch.next;if(!batch.more)break;
   }
   for(const {event} of received){const {currency,tax}=event.detail??{};if(ownMarkets.has(event.subject)&&['GOLD','DQS'].includes(currency)&&Number.isSafeInteger(tax)&&tax>0)persisted.taxCopper[currency]+=tax;}
   const summary={at:new Date().toISOString(),mode:'observe-only',realm:state.realm,contentHash:state.contentHash,buildHash:state.buildHash,time:state.time,revision:state.revision,authorityRevision:state.authorityRevision,backlogSeconds:state.clock.backlogSeconds,treasury:state.view.banking.treasury,population:state.view.settlements.reduce((n,s)=>n+s.population,0),unmetMeals:state.view.banking.markets.filter(m=>ownMarkets.has(m.id)).reduce((n,m)=>n+m.unmetMeals,0),orders:state.view.banking.orders,foodSupport:state.view.banking.foodSupport,marketPolicies:state.view.marketPolicies,eventCursor:persisted.cursor,taxObservedCopper:persisted.taxCopper,events:received};
   persisted.observations++;persisted.events+=received.length;
   await log.write(JSON.stringify(summary)+'\n');await log.sync();
   const pending=statePath+'.'+randomUUID();await writeFile(pending,JSON.stringify(persisted,null,2),{mode:0o600});await rename(pending,statePath);
   console.log(JSON.stringify({at:summary.at,crown,time:summary.time,population:summary.population,treasury:summary.treasury,unmetMeals:summary.unmetMeals,eventCursor:summary.eventCursor,observations:persisted.observations}));
  }catch(e){console.error(JSON.stringify({at:new Date().toISOString(),error:e.message,status:e.status,code:e.code}));if(e.status===401||e.status===403||e.code==='CROWN_CHANGED')throw e;}
  const until=Math.min(deadline,Date.now()+cadence*1000);while(!stopped&&Date.now()<until)await new Promise(r=>setTimeout(r,Math.min(1000,until-Date.now())));
 }
}finally{await log.close();await lock.close();await unlink(lockPath);}
