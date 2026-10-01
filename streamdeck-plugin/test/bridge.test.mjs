import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {Bridge} from '../.test-build/bridge.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('applied frame updates selection immediately and an older in-flight poll cannot roll it back',async t=>{
  let sequence=1,selected='t1',slowPoll=false,pollStarted;
  const started=new Promise(resolve=>pollStarted=resolve);
  const frame=()=>({sessionId:'ack-session',sequence,state:{selectedTimerId:selected,timers:{t1:{},t2:{}}},layout:{id:'x',slots:[]}});
  const server=http.createServer(async(req,res)=>{
    for await(const _ of req){};res.setHeader('content-type','application/json');
    if(req.url==='/pair')return res.end(JSON.stringify({token:'s'.repeat(48),sessionId:'ack-session',protocolVersion:1}));
    if(req.url==='/state'){const captured=frame();if(slowPoll){slowPoll=false;pollStarted();await wait(350);}return res.end(JSON.stringify(captured));}
    if(req.url==='/command'){selected='t2';sequence=2;return res.end(JSON.stringify({ok:true,frame:frame()}));}
    res.end('{}');
  });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const bridge=new Bridge();t.after(()=>bridge.disconnect());let seen;const ready=new Promise(resolve=>seen=resolve);bridge.onFrame=()=>seen();
  await bridge.bootstrap('/bootstrap',new URLSearchParams({port:String(server.address().port),nonce:'n'.repeat(48)}));await ready;
  slowPoll=true;await started;
  await bridge.command({commandId:'select',type:'selectTimer',timerId:'t2',payload:{timerId:'t2'}},'device');
  assert.equal(bridge.frame.state.selectedTimerId,'t2');await wait(400);
  assert.equal(bridge.online,true);assert.equal(bridge.frame.state.selectedTimerId,'t2');assert.equal(bridge.frame.sequence,2);
});
test('loopback pairing, bearer state, applied ACK, stale rejection and no replay',async t=>{
  const token='s'.repeat(48),nonce='n'.repeat(48),requests=[];let paired=false,stale=false;
  const server=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};requests.push({path:req.url,body,auth:req.headers.authorization});res.setHeader('content-type','application/json');if(req.url==='/pair'){if(paired||body.nonce!==nonce){res.writeHead(403).end('{}');return;}paired=true;res.end(JSON.stringify({token,sessionId:'session',protocolVersion:1}));return;}if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403).end('{}');return;}if(req.url==='/state')res.end(JSON.stringify({sessionId:'session',sequence:1,stale,state:{timers:{t1:{},t2:{}}},layout:{id:'x',slots:[]}}));else res.end(JSON.stringify({ok:true,applied:true}));});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());const b=new Bridge();t.after(()=>b.disconnect());
  assert.equal(await b.bootstrap('/wrong',new URLSearchParams({port:'1234',nonce})),false);
  assert.equal(await b.bootstrap('/bootstrap',new URLSearchParams({port:'https://evil.invalid',nonce})),false);
  const received=new Promise(resolve=>b.onFrame=resolve);assert.equal(await b.bootstrap('/bootstrap',new URLSearchParams({port:String(server.address().port),nonce})),true);await received;
  assert.equal(b.online,true);assert.deepEqual(await b.command({commandId:'1',type:'start',timerId:'t1'},'device'),{ok:true,applied:true});assert.equal(requests.at(-1).body.deviceId,'device');
  stale=true;await wait(350);assert.equal(b.online,false);await assert.rejects(b.command({commandId:'2',type:'bell',timerId:'t1'},'device'));assert.equal(requests.filter(r=>r.path==='/command').length,1);
  const after=requests.length;await wait(350);assert.equal(requests.length,after,'no reconnect command queue or autonomous retry');
});

test('a delayed command acknowledgement succeeds without replay',async t=>{
  const token='s'.repeat(48),nonce='n'.repeat(48);
  let commandCount=0,stateSequence=0;
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
    res.setHeader('content-type','application/json');
    if(req.url==='/pair'){
      assert.equal(body.nonce,nonce);
      res.end(JSON.stringify({token,sessionId:'slow-command',protocolVersion:1}));
    }else if(req.headers.authorization!==`Bearer ${token}`){
      res.writeHead(403).end('{}');
    }else if(req.url==='/state'){
      res.end(JSON.stringify({sessionId:'slow-command',sequence:++stateSequence,state:{timers:{t1:{},t2:{}}},layout:{id:'x',slots:[]}}));
    }else if(req.url==='/command'){
      commandCount++;
      assert.equal(body.commandId,'delayed-command');
      await wait(2000);
      res.end(JSON.stringify({ok:true,applied:true}));
    }else res.end(JSON.stringify({ok:true}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const bridge=new Bridge();t.after(()=>bridge.disconnect());
  const firstFrame=new Promise(resolve=>{bridge.onFrame=resolve;});
  assert.equal(await bridge.bootstrap('/bootstrap',new URLSearchParams({port:String(server.address().port),nonce})),true);
  await firstFrame;
  assert.deepEqual(await bridge.command({commandId:'delayed-command',type:'outputA',timerId:'t1'},'device'),{ok:true,applied:true});
  assert.equal(bridge.online,true);
  await wait(350);
  assert.equal(commandCount,1,'the delayed acknowledgement must not replay the command');
});

test('stale watchdog expires even when an SDK rendering/instruction callback hangs',async t=>{
  const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(req.url==='/pair'?{token:'x'.repeat(32),sessionId:'hang',protocolVersion:1}:{sessionId:'hang',sequence:1,state:{timers:{t1:{},t2:{}}}}));});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const b=new Bridge();t.after(()=>b.disconnect());let frameSeen;const ready=new Promise(resolve=>frameSeen=resolve);b.onFrame=()=>{frameSeen();return new Promise(()=>{});};
  await b.bootstrap('/bootstrap',new URLSearchParams({port:String(server.address().port),nonce:'n'.repeat(32)}));await ready;assert.equal(b.online,true);await wait(1600);assert.equal(b.online,false);assert.equal(b.frame,undefined);
});
