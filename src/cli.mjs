import {readFile} from 'node:fs/promises';
import {KingdomClient} from './client.mjs';
const [verb,arg,cursor]=process.argv.slice(2),client=new KingdomClient({sessionFile:process.env.DQ_SESSION_FILE});
try{
 let result;
 if(verb==='me')result=await client.me();
 else if(verb==='state')result=await client.state(arg);
 else if(verb==='events')result=await client.events(arg,cursor);
 else if(verb==='receipt')result=await client.receipt(arg);
 else if(verb==='command')result=await client.command(JSON.parse(await readFile(arg,'utf8')));
 else throw Error('Usage: me | state <crown> | events <crown> [cursor] | receipt <id> | command <JSON-file>');
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(JSON.stringify({error:e.message,status:e.status,code:e.code}));process.exitCode=1;}
