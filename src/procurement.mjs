import {createHash} from 'node:crypto';

const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const id=v=>typeof v==='string'&&/^[-a-zA-Z0-9]{8,64}$/.test(v);
const identifier=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(value,k));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const terminal=new Set(['complete','stopped','halted']);
const authorityError=e=>e?.status===401||e?.status===403||e?.code==='CROWN_CHANGED';
const missingReceipt=e=>e?.status===409&&e?.message==='Receipt not found';

/** A manifest permits only these finite orders. Refunds never replenish its cap. */
export function validateMandate(m){
 const keys=['schema','id','realm','crown','currency','contentHash','buildHash','authorityRevision','realmFrom','realmUntil','wallUntil','maxWallSeconds','maxCopper','maxCommands','maxPostAttempts','orders'];
 if(!exact(m,keys)||m.schema!=='dq-bounded-procurement-v1'||!id(m.id)||!identifier(m.realm)||!['coinfall','freehold'].includes(m.crown)||!['GOLD','DQS'].includes(m.currency)||!hash(m.contentHash)||!hash(m.buildHash))throw Error('Invalid bounded procurement manifest');
 if(!integer(m.authorityRevision,1,Number.MAX_SAFE_INTEGER)||!integer(m.realmFrom,0,Number.MAX_SAFE_INTEGER)||!integer(m.realmUntil,m.realmFrom+1,m.realmFrom+86400)||!integer(m.maxWallSeconds,1,86400)||typeof m.wallUntil!=='string'||!Number.isFinite(Date.parse(m.wallUntil))||new Date(m.wallUntil).toISOString()!==m.wallUntil)throw Error('Explicit authority and bounded realm/wall deadlines required');
 if(!integer(m.maxCopper,1,100000)||!integer(m.maxCommands,2,16)||!integer(m.maxPostAttempts,2,64)||!Array.isArray(m.orders)||m.orders.length<1||m.orders.length>4||m.maxCommands<m.orders.length*2||m.maxPostAttempts<m.orders.length*2)throw Error('Finite copper, command, retry and cleanup limits required');
 let total=0;
 for(const o of m.orders){
  if(!exact(o,['settlement','resource','quantity','unitPrice'])||!identifier(o.settlement)||!identifier(o.resource)||!integer(o.quantity,1,1000000)||!integer(o.unitPrice,1,100000)||!Number.isSafeInteger(o.quantity*o.unitPrice))throw Error('Invalid exact procurement order');
  total+=o.quantity*o.unitPrice;
 }
 if(!Number.isSafeInteger(total)||total>m.maxCopper)throw Error('Orders exceed the total mandate budget');
 return structuredClone(m);
}

export function newProcurementState(manifest,now=Date.now()){
 const m=validateMandate(manifest);
 return {schema:'dq-procurement-run-v1',policyVersion:'dq-bounded-procurement-v1',manifestHash:digest(m),crown:m.crown,startedAtWall:now,phase:'open',lastTime:null,lastRevision:null,postAttempts:0,operations:[],cursor:null,events:[],lastObservation:null};
}

/** One observation/decision at a time. save() MUST durably commit before returning.
 * Unknown POST outcomes retain their exact body until receipt lookup/exact replay.
 * No funding, delegation, price edits, new recurring orders or external exits. */
export class ProcurementRun{
 constructor({manifest,client,load,save,now=Date.now}){this.manifest=validateMandate(manifest);this.client=client;this.load=load;this.save=save;this.now=now;}
 async tick({stop=false}={}){
  const m=this.manifest;let run=await this.load();
  if(!run){run=newProcurementState(m,this.now());await this.save(run);}
  if(run.schema!=='dq-procurement-run-v1'||run.manifestHash!==digest(m)||run.crown!==m.crown)throw Error('Run directory is pinned to a different manifest');
  if(terminal.has(run.phase))return run;
  const persist=async()=>{await this.save(structuredClone(run));};
  const halt=async(reason)=>{run.phase='halted';run.reason=reason;await persist();return run;};
  let me,state;
  try{me=await this.client.me();state=await this.client.state(m.crown);}catch(e){if(authorityError(e))return halt('Account or crown authority lost');throw e;}
  const item=me.crowns?.find(c=>c.crown===m.crown);
  if(!item||item.revision!==m.authorityRevision||state.authorityRevision!==m.authorityRevision)return halt('Crown authority changed');
  if([me,state].some(s=>s.realm!==m.realm||s.contentHash!==m.contentHash||s.buildHash!==m.buildHash)||state.view?.faction!==m.crown||state.clock?.speed!==1)return halt('Realm/content/build/clock identity changed');
  if(state.view.control!=='human')return halt('External crown control required; delegation is not permitted');
  if(!integer(state.time,0,Number.MAX_SAFE_INTEGER)||!integer(state.revision,0,Number.MAX_SAFE_INTEGER)||(run.lastTime!==null&&state.time<run.lastTime)||(run.lastRevision!==null&&state.revision<run.lastRevision))return halt('Realm clock or revision regressed');
  run.lastTime=state.time;run.lastRevision=state.revision;
  run.initialObservation??=structuredClone(state);
  run.lastObservation={time:state.time,revision:state.revision,authorityRevision:state.authorityRevision,treasury:state.view.banking.treasury,orders:state.view.banking.orders};
  // Tail bootstrap skips historical unrelated work. Restarts resume the durable
  // decimal cursor. Order receipts/state, not raw caravan events, prove filling.
  let batch;try{batch=await this.client.events(m.crown,run.cursor??'tail');}catch(e){if(authorityError(e))return halt('Account or crown authority lost during event read');throw e;}
  if(!/^\d+$/.test(batch.next)||(run.cursor!==null&&BigInt(batch.next)<BigInt(run.cursor))||!Array.isArray(batch.events))return halt('Invalid event cursor');
  const ownIds=new Set(run.operations.map(o=>o.orderId).filter(Boolean));
  run.cursor=batch.next;run.events.push(...batch.events.filter(({event:e})=>e&&['buy-order-funded','buy-order-cancelled'].includes(e.type)&&(ownIds.has(e.subject)||e.detail?.king===m.crown)));await persist();
  if(stop||state.time>=m.realmUntil||this.now()>=Date.parse(m.wallUntil)||this.now()-run.startedAtWall>=m.maxWallSeconds*1000)run.phase='cleaning';
  if(state.time<m.realmFrom){await persist();return run;}
  const pending=run.operations.find(o=>o.status==='prepared'||o.status==='unknown');
  if(pending){
   if(pending.attempts){
    try{const receipt=await this.client.receipt(pending.receiptId);return this.accept(run,pending,receipt,persist,halt);}
    catch(e){if(authorityError(e))return halt('Account or crown authority lost during recovery');if(!missingReceipt(e))throw e;}
   }
   // Receipt reads may cross a wall deadline. Cleanup may cancel uncommitted
   // orders, but a purchase must never be initiated/replayed after expiry.
   if(stop||this.now()>=Date.parse(m.wallUntil)||this.now()-run.startedAtWall>=m.maxWallSeconds*1000)run.phase='cleaning';
   if(run.phase==='cleaning'&&pending.kind==='buy'){
    if(pending.attempts)return halt('Unknown purchase outcome at expiry; reconcile its receipt without a new purchase');
    pending.status='cancelled-before-send';await persist();return run;
   }
   if(run.postAttempts>=m.maxPostAttempts)return halt('POST retry cap reached; reconcile any unknown outcome before a new mandate');
   if(pending.kind==='buy'&&m.maxPostAttempts-run.postAttempts<=1)return halt('Purchase retries would consume the final cleanup attempt; reconcile before another mandate');
   if(pending.status==='prepared'&&pending.attempts===0)pending.request.expectedRevision=state.revision;
   pending.attempts++;run.postAttempts++;pending.status='unknown';await persist();
   try{return this.accept(run,pending,await this.client.command(pending.request),persist,halt);}
   catch(e){
    if(authorityError(e))return halt('Account or crown authority lost during command');
    if(e?.code==='STATE_CHANGED'){
     // This specific server code proves rejection. A new revision is safe only
     // after it; a timeout/503 never permits changing the persisted request.
     pending.request.expectedRevision=state.revision;pending.status='prepared';pending.attempts=0;pending.rejections=(pending.rejections??0)+1;
     if(run.phase==='cleaning'&&pending.kind==='buy')pending.status='cancelled-before-send';
     await persist();return run;
    }
    run.lastError={status:e?.status??null,code:e?.code??null,outcome:'unknown'};await persist();return run;
   }
  }
  const buys=run.operations.filter(o=>o.kind==='buy'&&o.status==='accepted');
  const orders=state.view.banking.orders;
  for(const op of buys){
   const order=orders.find(o=>o.id===op.orderId);
   if(!order)return halt('Accepted order absent from scoped observation; reconcile without opening another');
   op.observed={remaining:order.remaining,reserved:order.reserved,filled:order.filled,escrow:order.escrow};
  }
  const nextIndex=run.operations.filter(o=>o.kind==='buy').length;
  if(run.phase==='open'&&nextIndex<m.orders.length){
   if(buys.some(o=>o.observed.remaining!==0||o.observed.reserved!==0||o.observed.filled!==m.orders[o.index].quantity)){await persist();return run;}
   const order=m.orders[nextIndex],cost=order.quantity*order.unitPrice;
   if(state.view.banking.treasury[m.currency]<cost)return halt('Insufficient existing treasury; this runner cannot replenish it');
   return this.prepare(run,{kind:'buy',index:nextIndex,intent:{type:'buy-order',...order,currency:m.currency}},state,persist,halt);
  }
  if(run.phase==='cleaning'){
   for(const op of buys){
    if(op.observed.remaining>0&&!run.operations.some(o=>o.kind==='cancel'&&o.index===op.index))return this.prepare(run,{kind:'cancel',index:op.index,intent:{type:'cancel-buy-order',order:op.orderId}},state,persist,halt);
   }
   run.phase='stopped';run.reason='Mandate ended; existing reserved contracts continue';
   run.outstandingReserved=buys.reduce((n,o)=>n+(o.observed?.reserved??0),0);await persist();return run;
  }
  if(buys.length===m.orders.length&&buys.every(o=>o.observed.remaining===0&&o.observed.reserved===0&&o.observed.filled===m.orders[o.index].quantity)){run.phase='complete';run.reason='Procurement filled; this alone does not prove a caravan journey';}
  await persist();return run;
 }
 async prepare(run,operation,state,persist,halt){
  const m=this.manifest;
  if(run.operations.length>=m.maxCommands)return halt('Logical command cap reached');
  const id=`${m.id}-${operation.kind}-${operation.index+1}`;
  run.operations.push({...operation,status:'prepared',attempts:0,observation:structuredClone(state),receiptId:`realm-command-${m.realm}-${id}`,request:{id,crown:m.crown,authorityRevision:m.authorityRevision,expectedRevision:state.revision,intent:operation.intent}});
  await persist();return run;
 }
 async accept(run,op,receipt,persist,halt){
  op.receipt=receipt;
  const event=receipt?.events?.find(e=>e.type===(op.kind==='buy'?'buy-order-funded':'buy-order-cancelled'));
  const expected=this.manifest.orders[op.index],detail=event?.detail;
  const valid=receipt?.accepted===true&&receipt.id===op.receiptId&&event&&
   (op.kind==='cancel'?event.subject===op.intent.order:
    detail?.king===this.manifest.crown&&detail.settlement===expected.settlement&&detail.resource===expected.resource&&detail.currency===this.manifest.currency&&detail.quantity===expected.quantity&&detail.unitPrice===expected.unitPrice&&detail.copper===expected.quantity*expected.unitPrice&&typeof event.subject==='string');
  if(!valid){op.status='receipt-unverified';return halt('Unexpected receipt; preserve it and reconcile before further commands');}
  op.status='accepted';if(op.kind==='buy')op.orderId=event.subject;delete run.lastError;
  await persist();return run;
 }
}
