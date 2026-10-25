import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProcurementRun,validateMandate} from '../src/procurement.mjs';

const at=Date.parse('2026-10-25T12:00:00.000Z');
const mandate=(patch={})=>({schema:'dq-bounded-procurement-v1',id:'bounded-test-coinfall',realm:'blockreach-live',crown:'coinfall',currency:'GOLD',contentHash:'a'.repeat(64),buildHash:'b'.repeat(64),authorityRevision:1,realmFrom:100,realmUntil:1000,wallUntil:new Date(at+3600000).toISOString(),maxWallSeconds:3600,maxCopper:100,maxCommands:4,maxPostAttempts:8,orders:[{settlement:'coinfall',resource:'food',quantity:5,unitPrice:10}],...patch});
const error=(message,status=409,code)=>Object.assign(Error(message),{status,code});
function fixture(m=mandate()){
 let saved=null,now=at,loss=null,saveFailure=null;
 const requests=[],receipts=new Map(),observedOrders=[];
 const state={realm:m.realm,contentHash:m.contentHash,buildHash:m.buildHash,authorityRevision:1,time:100,revision:10,clock:{speed:1},view:{faction:'coinfall',control:'human',banking:{treasury:{GOLD:100,DQS:0},orders:observedOrders}}};
 const client={
  async me(){return {...state,crowns:[{crown:'coinfall',revision:state.authorityRevision}]};},
  async state(){return structuredClone(state);},async events(_crown,after){assert.ok(after==='tail'||/^\d+$/.test(after));return {next:String(state.revision),events:[],more:false};},
  async receipt(id){if(!receipts.has(id))throw error('Receipt not found');return structuredClone(receipts.get(id));},
  async command(request){
   assert.equal(saved.operations.at(-1).status,'unknown','intent and attempt must be durable before POST');
   assert.deepEqual(saved.operations.at(-1).request,request);
   requests.push(structuredClone(request));
   if(loss==='before'){loss=null;throw error('Service unavailable',503);}
   if(request.expectedRevision!==state.revision)throw error('Stale realm revision',409,'STATE_CHANGED');
   const receiptId=`realm-command-${m.realm}-${request.id}`;
   if(receipts.has(receiptId))return structuredClone(receipts.get(receiptId));
   const intent=request.intent;let event;
   if(intent.type==='buy-order'){
    const id='order-'+(observedOrders.length+1),amount=intent.quantity*intent.unitPrice;
    assert.ok(state.view.banking.treasury[intent.currency]>=amount);
    state.view.banking.treasury[intent.currency]-=amount;
    observedOrders.push({id,king:'coinfall',...intent,remaining:intent.quantity,reserved:0,filled:0,escrow:amount});
    event={type:'buy-order-funded',subject:id,detail:{king:'coinfall',...intent,copper:amount}};
   }else{
    assert.equal(intent.type,'cancel-buy-order');const order=observedOrders.find(o=>o.id===intent.order);
    state.view.banking.treasury.GOLD+=order.escrow;order.escrow=0;order.remaining=0;
    event={type:'buy-order-cancelled',subject:order.id,detail:{reserved:order.reserved}};
   }
   state.revision++;const receipt={accepted:true,id:receiptId,revision:state.revision,events:[event]};receipts.set(receiptId,receipt);
   if(loss==='after'){loss=null;throw error('Lost reply',503);}return structuredClone(receipt);
  }
 };
 const makeRun=()=>new ProcurementRun({manifest:m,client,load:async()=>saved&&structuredClone(saved),save:async value=>{if(saveFailure?.(value)){saveFailure=null;throw Error('Storage write failed');}saved=structuredClone(value);},now:()=>now});
 return {m,state,client,requests,receipts,observedOrders,run:makeRun(),restart:makeRun,get saved(){return saved;},set now(v){now=v;},set loss(v){loss=v;},set saveFailure(v){saveFailure=v;}};
}

test('manifest enforces total reservation budget, cleanup slots and fixed authority/time pins',()=>{
 assert.equal(validateMandate(mandate()).maxCopper,100);
 assert.throws(()=>validateMandate(mandate({maxCopper:49})),/budget/);
 assert.throws(()=>validateMandate(mandate({maxCommands:1})),/limits/);
 assert.throws(()=>validateMandate(mandate({realmUntil:1000000})),/deadlines/);
 assert.throws(()=>validateMandate({...mandate(),fundTreasury:1}),/manifest/);
 assert.throws(()=>validateMandate(mandate({orders:[{settlement:'coinfall',resource:'food',quantity:1,unitPrice:10,type:'royal-deposit'}]})),/order/);
});

test('phases wait for actual complete fill; no second reservation or refill appears',async()=>{
 const f=fixture(mandate({orders:[{settlement:'coinfall',resource:'food',quantity:5,unitPrice:10},{settlement:'freehold',resource:'wood',quantity:2,unitPrice:20}]}));
 await f.run.tick();assert.equal(f.requests.length,0);
 await f.run.tick();assert.equal(f.requests.length,1);assert.equal(f.state.view.banking.treasury.GOLD,50);
 await f.run.tick();assert.equal(f.requests.length,1);assert.equal(f.saved.operations.length,1);
 Object.assign(f.observedOrders[0],{remaining:0,reserved:2,filled:3,escrow:0});await f.run.tick();assert.equal(f.saved.operations.length,1);
 Object.assign(f.observedOrders[0],{remaining:0,reserved:0,filled:5});await f.run.tick();assert.equal(f.saved.operations.length,2);
 await f.run.tick();assert.equal(f.requests.length,2);assert.equal(f.state.view.banking.treasury.GOLD,10);
 Object.assign(f.observedOrders[1],{remaining:0,reserved:0,filled:2,escrow:0});await f.run.tick();assert.equal(f.saved.phase,'complete');assert.match(f.saved.reason,/does not prove a caravan/);
 await f.restart().tick();assert.equal(f.requests.length,2);
});

test('committed command with lost reply resolves by private receipt after restart without another POST',async()=>{
 const f=fixture();await f.run.tick();f.loss='after';await f.run.tick();assert.equal(f.saved.operations[0].status,'unknown');assert.equal(f.requests.length,1);
 const restarted=f.restart();await restarted.tick();assert.equal(f.requests.length,1);assert.equal(f.saved.operations[0].status,'accepted');assert.equal(f.saved.operations[0].orderId,'order-1');assert.equal(f.state.view.banking.treasury.GOLD,50);
});

test('uncommitted unknown outcome replays exact body until explicit stale rejection permits revision refresh',async()=>{
 const f=fixture();await f.run.tick();f.loss='before';await f.run.tick();const first=f.requests[0];f.state.revision++;
 await f.restart().tick();assert.deepEqual(f.requests[1],first);assert.equal(f.saved.operations[0].status,'prepared');
 f.state.revision++;await f.restart().tick();assert.equal(f.requests[2].id,first.id);assert.equal(f.requests[2].expectedRevision,f.state.revision-1);assert.equal(f.saved.operations[0].status,'accepted');assert.equal(f.observedOrders.length,1);
});

test('deadline cleanup refunds only unreserved order remainder and leaves in-flight contracts intact',async()=>{
 const f=fixture();await f.run.tick();await f.run.tick();Object.assign(f.observedOrders[0],{remaining:3,reserved:2,escrow:30});f.state.time=1000;
 await f.run.tick();assert.equal(f.saved.operations[1].kind,'cancel');await f.run.tick();await f.run.tick();
 assert.equal(f.saved.phase,'stopped');assert.equal(f.saved.outstandingReserved,2);assert.equal(f.state.view.banking.treasury.GOLD,80);assert.equal(f.observedOrders[0].reserved,2);
 assert.deepEqual(f.requests.map(r=>r.intent.type),['buy-order','cancel-buy-order']);
});

test('an expired unsent order is cancelled locally; an unknown purchase is never replayed after expiry',async()=>{
 const a=fixture();await a.run.tick();a.state.time=1000;await a.run.tick();await a.run.tick();assert.equal(a.requests.length,0);assert.equal(a.saved.phase,'stopped');
 const b=fixture();await b.run.tick();b.loss='before';await b.run.tick();b.state.time=1000;await b.run.tick();assert.equal(b.requests.length,1);assert.equal(b.saved.phase,'halted');assert.match(b.saved.reason,/Unknown purchase outcome/);
});

test('crown loss stops prepared writes and remains stopped if the crown later returns',async()=>{
 const f=fixture();await f.run.tick();f.state.authorityRevision=2;await f.run.tick();assert.equal(f.saved.phase,'halted');assert.equal(f.requests.length,0);
 f.state.authorityRevision=1;await f.restart().tick();assert.equal(f.requests.length,0);
});

test('clock/build changes, stale manifest reuse and exhausted retries stop safely',async()=>{
 const a=fixture();await a.run.tick();a.state.time=99;await a.run.tick();assert.equal(a.saved.phase,'halted');assert.equal(a.requests.length,0);
 const b=fixture();await b.run.tick();b.state.buildHash='c'.repeat(64);await b.run.tick();assert.equal(b.saved.phase,'halted');assert.equal(b.requests.length,0);
 const c=fixture(mandate({maxPostAttempts:2}));await c.run.tick();c.loss='before';await c.run.tick();await c.run.tick();assert.equal(c.saved.phase,'halted');assert.match(c.saved.reason,/cleanup attempt/);assert.equal(c.requests.length,1);
 const d=fixture();await d.run.tick();const different=new ProcurementRun({manifest:mandate({maxCopper:99}),client:d.client,load:async()=>d.saved,save:async()=>{}});await assert.rejects(()=>different.tick(),/different manifest/);
});

test('realm or wall-time expiry is durable across restart and event-tail bootstrap skips old events',async()=>{
 const f=fixture();let seen=[];f.client.events=async(_crown,after)=>{seen.push(after);return {next:'777',events:[],more:false};};
 await f.run.tick();assert.deepEqual(seen,['tail']);f.now=at+3600001;await f.restart().tick();await f.restart().tick();assert.equal(f.requests.length,0);assert.equal(f.saved.phase,'stopped');assert.equal(seen[1],'777');
});

test('unexpected receipts halt after saving evidence, without a successor command',async()=>{
 const f=fixture();await f.run.tick();f.client.command=async()=>({accepted:true,id:'wrong-receipt',events:[]});await f.run.tick();assert.equal(f.saved.phase,'halted');assert.equal(f.saved.operations[0].status,'receipt-unverified');assert.equal(f.saved.operations[0].receipt.id,'wrong-receipt');
});

test('failed write-ahead persistence prevents a POST',async()=>{
 const f=fixture();await f.run.tick();f.saveFailure=s=>s.operations[0]?.status==='unknown';
 await assert.rejects(()=>f.run.tick(),/Storage write failed/);assert.equal(f.requests.length,0);assert.equal(f.saved.operations[0].attempts,0);
 await f.restart().tick();assert.equal(f.requests.length,1);assert.equal(f.observedOrders.length,1);
});

test('failed receipt persistence recovers committed result without repeating the reservation',async()=>{
 const f=fixture();await f.run.tick();f.saveFailure=s=>s.operations[0]?.status==='accepted';
 await assert.rejects(()=>f.run.tick(),/Storage write failed/);assert.equal(f.requests.length,1);assert.equal(f.saved.operations[0].status,'unknown');
 await f.restart().tick();assert.equal(f.requests.length,1);assert.equal(f.saved.operations[0].status,'accepted');assert.equal(f.state.view.banking.treasury.GOLD,50);
});
