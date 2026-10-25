import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observedTax,stageObservation} from '../src/metrics.mjs';

const owned=new Set(['coinfall']);
test('tax receipts resolve the actual governing market for trades, caravans and food support',()=>{
 const events=[
  {type:'market-traded',subject:'coinfall',detail:{currency:'GOLD',tax:8}},
  {type:'caravan-delivered',subject:'caravan-17',detail:{from:'freehold',to:'coinfall',currency:'DQS',tax:12}},
  {type:'food-support-spent',subject:'coinfall-coinfall-gold',detail:{settlement:'coinfall',currency:'GOLD',tax:3}},
 ];
 assert.deepEqual(events.map(event=>observedTax(event,owned)),[
  {settlement:'coinfall',currency:'GOLD',copper:8},
  {settlement:'coinfall',currency:'DQS',copper:12},
  {settlement:'coinfall',currency:'GOLD',copper:3},
 ]);
});

test('aggregate summaries and foreign tax receipts do not inflate owned treasury receipts',()=>{
 const events=[
  {type:'market-traded',subject:'coinfall',detail:{currency:'GOLD',tax:8}},
  {type:'market-tick',subject:'coinfall',detail:{currency:'GOLD',tax:8}},
  {type:'market-tick',subject:'coinfall',detail:{tax:{GOLD:8,DQS:0}}},
  {type:'treasury-fund',subject:'coinfall',detail:{currency:'GOLD',tax:1000}},
  {type:'market-traded',subject:'freehold',detail:{currency:'GOLD',tax:9}},
  {type:'caravan-delivered',subject:'coinfall',detail:{from:'coinfall',to:'freehold',currency:'GOLD',tax:10}},
  {type:'food-support-spent',subject:'coinfall',detail:{settlement:'freehold',currency:'GOLD',tax:11}},
 ];
 assert.deepEqual(events.map(event=>observedTax(event,owned)).filter(Boolean),[
  {settlement:'coinfall',currency:'GOLD',copper:8},
 ]);
});

test('malformed, nonpositive or imprecise amounts cannot become tax metrics',()=>{
 for(const tax of [undefined,null,'8',0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(observedTax({type:'market-traded',subject:'coinfall',detail:{currency:'GOLD',tax}},owned),null);
 }
 for(const event of [null,{}, {type:'market-traded',subject:'coinfall'},
  {type:'market-traded',subject:'coinfall',detail:{currency:'ETH',tax:8}},
  {type:'caravan-delivered',subject:'coinfall',detail:{currency:'GOLD',tax:8}},
  {type:'food-support-spent',subject:'coinfall',detail:{currency:'GOLD',tax:8}}]){
  assert.equal(observedTax(event,owned),null);
 }
});

test('a later event-page failure leaves the checkpoint intact and retry includes all earlier taxes once',async()=>{
 const checkpoint={crown:'coinfall',cursor:'10',observations:2,events:7,taxCopper:{GOLD:5,DQS:1}},before=structuredClone(checkpoint),failedCursors=[];
 const first={sequence:'11',index:0,event:{type:'market-traded',subject:'coinfall',detail:{currency:'GOLD',tax:8}}};
 const second={sequence:'61',index:0,event:{type:'caravan-delivered',subject:'caravan-17',detail:{to:'coinfall',currency:'DQS',tax:12}}};
 await assert.rejects(()=>stageObservation(checkpoint,owned,async cursor=>{
  failedCursors.push(cursor);if(cursor==='10')return {next:'60',more:true,events:[first]};throw Error('Connection lost fetching second page');
 }),/Connection lost fetching second page/);
 assert.deepEqual(failedCursors,['10','60']);assert.deepEqual(checkpoint,before);
 const retriedCursors=[],staged=await stageObservation(checkpoint,owned,async cursor=>{
  retriedCursors.push(cursor);return cursor==='10'?{next:'60',more:true,events:[first]}:{next:'100',more:false,events:[second]};
 });
 assert.deepEqual(retriedCursors,['10','60']);assert.deepEqual(checkpoint,before);
 assert.deepEqual(staged.events,[first,second]);assert.deepEqual(staged.checkpoint,{crown:'coinfall',cursor:'100',observations:3,events:9,taxCopper:{GOLD:13,DQS:13}});
 // An unsuccessful durable write can discard staging and retry the old cursor.
 const retried=await stageObservation(checkpoint,owned,async cursor=>cursor==='10'?{next:'60',more:true,events:[first]}:{next:'100',more:false,events:[second]});
 assert.deepEqual(retried,staged);assert.deepEqual(checkpoint,before);
});

test('tax overflow after a complete page read cannot partially advance totals or cursor',async()=>{
 const checkpoint={crown:'coinfall',cursor:'10',observations:2,events:7,taxCopper:{GOLD:Number.MAX_SAFE_INTEGER,DQS:1}},before=structuredClone(checkpoint);
 await assert.rejects(()=>stageObservation(checkpoint,owned,async()=>({next:'60',more:false,events:[{sequence:'11',index:0,event:{type:'market-traded',subject:'coinfall',detail:{currency:'GOLD',tax:1}}}]})),/exact integer range/);
 assert.deepEqual(checkpoint,before);
});
