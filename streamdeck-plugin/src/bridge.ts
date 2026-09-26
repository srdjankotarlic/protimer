import type {Command, Frame} from './types.js';

// Deliberately no command queue, retry, persisted token, LAN discovery or timer.
// The Electron host owns clocks, pairing and applied acknowledgements.
export class Bridge {
  private endpoint=''; private token=''; private session=''; private generation=0;
  private timer?:ReturnType<typeof setTimeout>;private staleTimer?:ReturnType<typeof setTimeout>; private receivedAt=0; private lastSequence=-1;
  frame?:Frame;
  onFrame:(frame:Frame)=>Promise<void>|void=()=>{};
  onOffline:()=>void=()=>{};
  get online(){ return !!this.token && !!this.frame && performance.now()-this.receivedAt < 1500; }
  async bootstrap(path:string, query:URLSearchParams) {
    if(path!=='/bootstrap') return false;
    const port=Number(query.get('port')), nonce=query.get('nonce')||'';
    if(!Number.isInteger(port)||port<1024||port>65535||!/^[A-Za-z0-9_-]{24,256}$/.test(nonce)) return false;
    this.disconnect(); const generation=this.generation;
    // The origin is fixed: no user-provided URL, hostname, path or redirect.
    const endpoint=`http://127.0.0.1:${port}`;
    try {
      const response=await fetch(`${endpoint}/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce,pluginVersion:'0.1.0',protocolVersion:1}),signal:AbortSignal.timeout(1200),redirect:'error'});
      if(!response.ok) return false;
      const data=await response.json() as {token:string;sessionId:string;protocolVersion:number};
      if(generation!==this.generation||data.protocolVersion!==1||typeof data.token!=='string'||data.token.length<24||typeof data.sessionId!=='string') return false;
      this.endpoint=endpoint; this.token=data.token;this.session=data.sessionId;
      void this.poll(generation); return true;
    } catch {return false;}
  }
  private async poll(generation:number) {
    if(generation!==this.generation||!this.token)return;
    try {
      const frame=await this.request('/state') as Frame;
      if(generation!==this.generation)return;
      if(frame.stale||frame.sessionId!==this.session||!Number.isSafeInteger(frame.sequence)||frame.sequence<this.lastSequence||!frame.state?.timers?.t1||!frame.state?.timers?.t2) throw Error('Invalid state');
      this.lastSequence=frame.sequence;this.frame=frame;this.receivedAt=performance.now();
      clearTimeout(this.staleTimer);this.staleTimer=setTimeout(()=>{if(generation===this.generation)this.disconnect();},1500);
      await this.onFrame(frame);
    } catch {if(generation===this.generation)this.disconnect();return;}
    if(generation===this.generation)this.timer=setTimeout(()=>void this.poll(generation),250);
  }
  private async request(path:string,body?:unknown){
    if(!this.token)throw Error('OFFLINE');
    const response=await fetch(this.endpoint+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${this.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(1200),redirect:'error'});
    if(!response.ok)throw Error(`Bridge rejected ${response.status}`);
    return response.json();
  }
  async send(path:string,body:unknown){if(!this.online)throw Error('OFFLINE');return this.request(path,body) as Promise<any>;}
  async command(command:Command,deviceId:string){const result=await this.send('/command',{...command,deviceId});if(!result.ok)throw Error(result.code||'Command not applied');return result;}
  disconnect(){++this.generation;clearTimeout(this.timer);clearTimeout(this.staleTimer);this.token='';this.session='';this.frame=undefined;this.lastSequence=-1;this.onOffline();}
}
