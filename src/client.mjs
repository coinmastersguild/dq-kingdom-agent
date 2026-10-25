import {readFile,stat} from 'node:fs/promises';
export class KingdomClient {
 constructor({sessionFile,origin='https://degenquest.ai',fetcher=fetch}) {
  if(new URL(origin).protocol!=='https:')throw Error('HTTPS required');
  this.sessionFile=sessionFile;this.origin=origin;this.fetcher=fetcher;
 }
 async request(path,body) {
  if(!/^\/api\/kingdom\/(me|state|events|receipt|commands|treasury\/(fund|withdraw)|crown\/transfer)(\?|$)/.test(path))throw Error('Unknown kingdom route');
  if(!this.sessionFile)throw Error('Set DQ_SESSION_FILE to an owner-only native session file');
  const info=await stat(this.sessionFile);if(info.mode&0o077)throw Error('Session file must be owner-only');
  const session=(await readFile(this.sessionFile,'utf8')).trim();if(!/^[a-f0-9]{64}$/.test(session))throw Error('Expected opaque native session');
  const response=await this.fetcher(this.origin+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+session,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!response.ok){const e=new Error(result.error??'Kingdom request failed');e.status=response.status;e.code=result.code;throw e;}return result;
 }
 me(){return this.request('/api/kingdom/me');}
 state(crown){return this.request('/api/kingdom/state?crown='+encodeURIComponent(crown));}
 events(crown,after='0'){return this.request('/api/kingdom/events?crown='+encodeURIComponent(crown)+'&after='+encodeURIComponent(after));}
 receipt(id){return this.request('/api/kingdom/receipt?id='+encodeURIComponent(id));}
 command(action){
  if(!['coinfall','freehold'].includes(action.crown)||!Number.isSafeInteger(action.authorityRevision)||action.authorityRevision<1||!Number.isSafeInteger(action.expectedRevision)||!/^[-a-zA-Z0-9]{8,96}$/.test(action.id??''))throw Error('Explicit crown, revisions and unique command ID required');
  return this.request('/api/kingdom/commands',action);
 }
}
