/** Run inside the agent's own runtime. Uses its protected signer; never a key file. */
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const [chain,address,output]=process.argv.slice(2),origin='https://degenquest.ai';
if(!['ethereum','solana'].includes(chain)||!address||!output)throw Error('Usage: node src/login.mjs <ethereum|solana> <own-address> <new-session-file>');
const signer=request=>JSON.parse(execFileSync('agent-wallet',['request'],{input:JSON.stringify(request),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
const addresses=signer({operation:'addresses'}).addresses;
if(chain==='ethereum'?!Object.values(addresses).some(a=>typeof a==='string'&&a.toLowerCase()===address.toLowerCase()):addresses.solana!==address)throw Error('Address does not belong to this runtime');
const request=async(path,body)=>{const r=await fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Login HTTP '+r.status);return r;};
const nonce=await (await request('/api/auth/nonce',{address,chain})).json();
const expected=`Welcome to DegenQuest!\n\nSign this message to authenticate your wallet.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nNonce: ${nonce.nonce}`;
if(nonce.message!==expected||typeof nonce.nonce!=='string'||nonce.nonce.length>100)throw Error('Unexpected login message; stop and inspect protocol changes');
const operation_id='dq-kingdom-login-'+randomUUID();let signature;
if(chain==='ethereum')signature=signer({operation:'evm_personal_sign',operation_id,message:nonce.message}).signature;
else{
 const raw=Buffer.from(signer({operation:'solana_sign_message',operation_id,message_base64:Buffer.from(nonce.message).toString('base64')}).signature_base64,'base64');
 if(raw.length!==64)throw Error('Invalid signer result');
 let n=BigInt('0x'+raw.toString('hex')),encoded='';while(n){encoded='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Number(n%58n)]+encoded;n/=58n;}
 let zeros=0;while(raw[zeros]===0)zeros++;signature='1'.repeat(zeros)+encoded;
}
const verified=await request('/api/auth/verify',{...nonce,address,chain,signature});
const session=verified.headers.get('set-cookie')?.match(/(?:^|,\s*)__Host-dq-session=([a-f0-9]{64})(?:;|$)/)?.[1];
if(!session)throw Error('No native session cookie returned');
await writeFile(output,session+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({signedIn:true,chain,address,sessionSaved:true}));
