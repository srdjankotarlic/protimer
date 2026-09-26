import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {WebSocketServer} from 'ws';
const require=createRequire(import.meta.url),L=require('../../deck-layout.js'),M=require('../../deck-model.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,message,timeout=4000){const deadline=Date.now()+timeout;while(!predicate()){if(Date.now()>deadline)throw Error(message);await delay(20);}}

test('compiled SDK plugin: real event adapter, owned keys, held guards, numeric page, offline BACK and no auto switch (simulated Elgato)',{timeout:18000},async t=>{
  const deviceId='test-xl',actions=new Map(),sdkMessages=[],commands=[],results=[];let inventory,connection,online=true,token='t'.repeat(48),nonce='n'.repeat(48),instructions=[];
  const raw={t1:{mode:'countdown',running:true,endAt:Date.now()+523000,remMs:523000,durationMs:900000},t2:{mode:'countdown',running:false,remMs:600000,durationMs:600000}};
  let bells=0;const model=M.create({readActive:id=>({...raw[id],enabled:true,overtime:true}),applyOperation:async op=>{const a=raw[op.timerId];if(op.type==='reset'){a.running=false;a.remMs=op.durationMs;}else if(op.type==='bell')bells++;else if(op.type==='startSet'){a.durationMs=op.durationMs;a.remMs=op.durationMs;a.endAt=Date.now()+op.durationMs;a.running=true;}return{ok:true};}});
  const context={sourceId:'native-deck',sessionId:'test-session',deviceId};let stateSequence=0;
  const server=http.createServer(async(req,res)=>{
    const parts=[];for await(const part of req)parts.push(part);const body=parts.length?JSON.parse(Buffer.concat(parts).toString()):{};
    res.setHeader('content-type','application/json');if(!online){res.writeHead(503).end('{}');return;}
    let result={ok:true};
    if(req.url==='/pair')result={token,sessionId:'test-session',protocolVersion:1};
    else if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403).end('{}');return;}
    else if(req.url==='/state')result={sessionId:'test-session',sequence:++stateSequence,state:model.snapshot(),layout:L.defaultLayout(),layoutRevision:1,instructions};
    else if(req.url==='/inventory')inventory=body;
    else if(req.url==='/press')result=model.beginPress(body.command,context);
    else if(req.url==='/release')result=model.cancelPress(body.pressId,context);
    else if(req.url==='/result'){results.push(body);instructions=instructions.filter(i=>i.id!==body.id);}
    else if(req.url==='/command'){delete body.deviceId;commands.push(body);result=await model.dispatch(body,context);}
    res.end(JSON.stringify(result));
  });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const ws=new WebSocketServer({host:'127.0.0.1',port:0});await once(ws,'listening');t.after(()=>ws.close());
  ws.on('connection',socket=>{connection=socket;socket.on('message',buffer=>{const message=JSON.parse(buffer);sdkMessages.push(message);
    if(message.event==='setSettings')actions.get(message.context).settings=message.payload;
    if(message.event==='getSettings'){const a=actions.get(message.context);socket.send(JSON.stringify({event:'didReceiveSettings',action:'com.srdjankotarlic.protimer.key',context:message.context,device:deviceId,id:message.id,payload:{controller:'Keypad',coordinates:a.coordinates,isInMultiAction:false,settings:a.settings}}));}
  });});
  const info={application:{font:'Arial',language:'en',platform:process.platform==='win32'?'windows':'mac',platformVersion:'15',version:'7.0.0'},colors:{},devicePixelRatio:2,devices:[{id:deviceId,name:'Simulated XL',size:{columns:8,rows:4},type:2}],plugin:{uuid:'com.srdjankotarlic.protimer',version:'0.1.0.0'}};
  const folder=fileURLToPath(new URL('../com.srdjankotarlic.protimer.sdPlugin/',import.meta.url));
  const child=spawn(process.execPath,['bin/plugin.js','-port',String(ws.address().port),'-pluginUUID','com.srdjankotarlic.protimer','-registerEvent','registerPlugin','-info',JSON.stringify(info)],{cwd:folder,stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',data=>errors+=data.toString());t.after(()=>{child.kill();connection?.terminate();});
  await until(()=>sdkMessages.some(m=>m.event==='registerPlugin'),`SDK registration failed: ${errors}`);
  const send=(event,context,payload={})=>connection.send(JSON.stringify({event,action:'com.srdjankotarlic.protimer.key',context,device:deviceId,payload}));
  connection.send(JSON.stringify({event:'deviceDidConnect',device:deviceId,deviceInfo:info.devices[0]}));
  const layout=L.defaultLayout();for(let i=0;i<32;i++){const key=layout.slots[i];if(!key)continue;const context=`key-${i}`,a={settings:{instanceId:`instance-${i}`,key},coordinates:{row:Math.floor(i/8),column:i%8}};actions.set(context,a);send('willAppear',context,{controller:'Keypad',coordinates:a.coordinates,settings:a.settings,isInMultiAction:false});}
  connection.send(JSON.stringify({event:'didReceiveDeepLink',payload:{url:`/bootstrap?port=${server.address().port}&nonce=${nonce}&streamdeck=hidden`}}));
  await until(()=>inventory?.actions.length===28,'Inventory missing');assert.equal(inventory.canActivate,false);assert.equal(inventory.devices[0].id,deviceId);assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile').length,0,'startup must not change profile');
  assert.equal(sdkMessages.some(m=>m.event==='setImage'&&['key-7','key-15','key-23','key-31'].includes(m.context)),false,'FREE keys never touched');
  await until(()=>sdkMessages.some(m=>m.event==='setImage'&&m.context==='key-2'&&m.payload.image.includes('RUNNING')),'Authoritative active graphic missing');
  const press=async(index,duration=30)=>{const id=`key-${index}`,a=actions.get(id),payload={controller:'Keypad',coordinates:a.coordinates,settings:a.settings};send('keyDown',id,payload);await delay(duration);send('keyUp',id,payload);};
  const deadline=raw.t1.endAt;await press(17);await until(()=>model.snapshot().timers.t1.draft.durationMs===600000,'Preset failed');assert.equal(raw.t1.endAt,deadline,'SET preset must not alter ACTIVE');
  await press(5);await delay(100);assert.equal(raw.t1.running,true,'short reset rejected');await press(5,1650);await until(()=>raw.t1.running===false,'Held reset failed');
  await press(6);await delay(100);assert.equal(bells,1);await delay(300);assert.equal(bells,1,'no bell auto repeat');
  await press(14);await until(()=>model.snapshot().numeric!==null,'ENTER TIME failed');
  // 28 owned contexts sorted by coordinates: ACTIVE, ENTRY, h,m,s,7,8,9,4,5,6,1,2,3,0,back,clear,apply,cancel.
  const numericContexts=[...actions.keys()];const numericPress=async index=>{const id=numericContexts[index],a=actions.get(id),payload={controller:'Keypad',coordinates:a.coordinates,settings:a.settings};send('keyDown',id,payload);await delay(45);send('keyUp',id,payload);};
  await numericPress(19);await until(()=>model.snapshot().timers.t1.draft.durationMs===0,'Clear SET did not clear only prepared draft');assert.equal(raw.t1.running,false);assert.notEqual(raw.t1.durationMs,0,'Clear SET is not ACTIVE reset');
  await numericPress(16);for(const digit of '012345'){await numericPress({0:14,1:11,2:12,3:13,4:8,5:9}[digit]);}
  await until(()=>model.snapshot().numeric?.buffer==='012345','Numeric digits did not reach host');await numericPress(17);await until(()=>model.snapshot().timers.t1.draft.durationMs===5025000,'Numeric apply not 01:23:45');assert.equal(raw.t1.running,false);
  instructions=[{id:'bind-test',type:'bind',deviceId,context:'key-6',instanceId:'instance-6',layoutId:layout.id,slotId:layout.slots[16].id}];
  await until(()=>results.some(r=>r.id==='bind-test'),'Binding no response');assert.equal(results.at(-1).deviceConfirmed,true);assert.equal(actions.get('key-6').settings.slotIndex,16);assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile').length,0);
  online=false;await until(()=>sdkMessages.some(m=>m.event==='setImage'&&m.context==='key-2'&&m.payload.image.includes('OFFLINE')),'Offline display missing');
  const count=commands.length;await press(1,1650);assert.equal(commands.length,count,'no offline START SET');await press(30);await until(()=>sdkMessages.some(m=>m.event==='switchToProfile'),'BACK must work offline');assert.equal(sdkMessages.find(m=>m.event==='switchToProfile').payload.profile,undefined);
});
