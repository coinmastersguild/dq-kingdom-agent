import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {KingdomClient} from '../src/client.mjs';
test('ordinary session, scoped cursor and authority loss without retry',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dq-king-client-'));let calls=0;
 try{const sessionFile=join(dir,'session');await writeFile(sessionFile,'a'.repeat(64),{mode:0o600});
 const client=new KingdomClient({sessionFile,fetcher:async(url,options)=>{calls++;assert.match(url,/crown=coinfall&after=17$/);assert.equal(options.headers.authorization,'Bearer '+'a'.repeat(64));return Response.json({error:'Crown lost',code:'CROWN_REQUIRED'},{status:403});}});
 await assert.rejects(()=>client.events('coinfall','17'),e=>e.status===403&&e.code==='CROWN_REQUIRED');assert.equal(calls,1);
 assert.throws(()=>client.command({intent:{type:'control'}}),/Explicit crown/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
