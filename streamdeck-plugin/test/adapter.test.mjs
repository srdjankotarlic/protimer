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
function imageSvg(message){
  const image=message.payload.image;
  assert.match(image,/^data:image\/svg\+xml;base64,/,'SDK setImage must not receive raw SVG');
  return Buffer.from(image.split(',')[1],'base64').toString('utf8');
}
async function until(predicate,message,timeout=4000){const deadline=Date.now()+timeout;while(!predicate()){if(Date.now()>deadline)throw Error(message);await delay(20);}}

test('compiled SDK plugin: one-touch native commands, owned keys, spatial numeric page and no auto switch (simulated Elgato)',{timeout:18000},async t=>{
  const deviceId='test-xl',actions=new Map(),sdkMessages=[],commands=[],results=[];let inventory,connection,online=true,token='t'.repeat(48),nonce='n'.repeat(48),instructions=[],board=L.defaultLayout();
  const raw={t1:{mode:'countdown',running:true,endAt:Date.now()+523000,remMs:523000,durationMs:900000},t2:{mode:'countdown',running:false,remMs:600000,durationMs:600000}};
  let bells=0,liveView='both';const model=M.create({nativeSingleTap:true,readActive:id=>({...raw[id],enabled:true,overtime:true}),applyOperation:async op=>{const a=raw[op.timerId];if(op.type==='reset'){a.running=false;a.remMs=op.durationMs;}else if(op.type==='pause'){a.remMs=a.endAt-Date.now();a.running=false;}else if(['start','resume'].includes(op.type)){a.endAt=Date.now()+a.remMs;a.running=true;}else if(op.type==='bell')bells++;else if(['startSet','loadSet'].includes(op.type)){a.mode=op.mode;a.durationMs=op.durationMs;a.remMs=op.durationMs;a.endAt=op.type==='startSet'?Date.now()+op.durationMs:0;a.running=op.type==='startSet'&&op.mode!=='clock';}else if(op.type.startsWith('live'))liveView={liveT1:'t1',liveT2:'t2',liveBoth:'both'}[op.type];return{ok:true};}});
  const snapshot=()=>({...model.snapshot(),singleTap:true,liveTimerView:liveView});
  const context={sourceId:'native-deck',sessionId:'test-session',deviceId};let stateSequence=0;
  const server=http.createServer(async(req,res)=>{
    const parts=[];for await(const part of req)parts.push(part);const body=parts.length?JSON.parse(Buffer.concat(parts).toString()):{};
    res.setHeader('content-type','application/json');if(!online){res.writeHead(503).end('{}');return;}
    let result={ok:true};
    if(req.url==='/pair')result={token,sessionId:'test-session',protocolVersion:1};
    else if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403).end('{}');return;}
    else if(req.url==='/state')result={sessionId:'test-session',sequence:++stateSequence,state:snapshot(),layout:board,layoutRevision:1,instructions};
    else if(req.url==='/inventory')inventory=body;
    else if(req.url==='/press')result=model.beginPress(body.command,context);
    else if(req.url==='/release')result=model.cancelPress(body.pressId,context);
    else if(req.url==='/result'){results.push(body);instructions=instructions.filter(i=>i.id!==body.id);}
    else if(req.url==='/command'){delete body.deviceId;commands.push(body);result=await model.dispatch(body,context);if(result.ok)result.frame={sessionId:'test-session',sequence:++stateSequence,state:snapshot(),layout:board,layoutRevision:1};if(body.type==='selectTimer')await delay(200);}
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
  await until(()=>inventory?.actions.length===28,'Inventory missing');assert.equal(inventory.canActivate,true);assert.deepEqual(inventory.profiles,['profiles/protimer-xl-full']);assert.equal(inventory.devices[0].id,deviceId);assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile').length,0,'startup must not change profile');
  assert.equal(sdkMessages.some(m=>m.event==='setImage'&&['key-7','key-15','key-23','key-31'].includes(m.context)),false,'FREE keys never touched');
  await until(()=>sdkMessages.some(m=>m.event==='setImage'&&m.context==='key-3'&&imageSvg(m).includes('RUNNING')),'Authoritative active graphic missing');
  const press=async(index,duration=30)=>{const id=`key-${index}`,a=actions.get(id),payload={controller:'Keypad',coordinates:a.coordinates,settings:a.settings};send('keyDown',id,payload);await delay(duration);send('keyUp',id,payload);};
  // USB reconnect is not a profile change. Elgato can keep its visible action
  // contexts and send device lifecycle events without repeating willAppear.
  connection.send(JSON.stringify({event:'deviceDidDisconnect',device:deviceId}));
  await until(()=>inventory?.devices.length===0,'USB disconnect inventory missing');
  const disconnectedCount=commands.length;
  await press(11);assert.equal(commands.length,disconnectedCount,'disconnected USB cannot execute commands');
  connection.send(JSON.stringify({event:'deviceDidConnect',device:deviceId,deviceInfo:info.devices[0]}));
  await until(()=>inventory?.actions.length===28&&inventory?.devices.length===1,'USB reconnect lost visible owned actions');
  const deadline=raw.t1.endAt;await press(17);await until(()=>model.snapshot().timers.t1.draft.durationMs===600000,'Preset failed');assert.equal(raw.t1.endAt,deadline,'SET preset must not alter ACTIVE');
  await press(11);await until(()=>model.snapshot().timers.t1.draft.durationMs===660000,'SET +1 minute tap failed');assert.equal(raw.t1.endAt,deadline);
  await press(25);await press(11);await until(()=>model.snapshot().timers.t2.draft.durationMs===660000,'Immediate T2 SET adjustment before selection ACK failed');assert.equal(model.snapshot().timers.t1.draft.durationMs,660000);assert.equal(commands.at(-1).timerId,'t2');
  await press(24);await until(()=>model.snapshot().selectedTimerId==='t1','Explicit T1 selection failed');
  await press(1);await until(()=>!raw.t1.running,'PAUSE tap failed');assert.equal(model.snapshot().timers.t1.draft.durationMs,660000);
  await press(2);await until(()=>raw.t1.running,'RESUME tap failed');assert.equal(model.snapshot().timers.t1.draft.durationMs,660000);
  await press(0);await until(()=>raw.t1.durationMs===660000&&raw.t1.running,'One-touch running replacement failed');
  await press(5);await until(()=>raw.t1.running===false,'One-touch reset failed');
  assert.equal(commands.filter(c=>c.type==='reset').length,1);
  const bellPayload={controller:'Keypad',coordinates:actions.get('key-6').coordinates,settings:actions.get('key-6').settings};
  send('keyDown','key-6',bellPayload);await until(()=>bells===1,'One-touch bell failed');
  send('keyDown','key-6',bellPayload);await delay(300);assert.equal(bells,1,'held/repeated keyDown never auto-repeats');
  send('keyUp','key-6',bellPayload);
  await press(28);await until(()=>commands.some(c=>c.type==='blackoutOn'),'One-touch BLACK ON failed');
  await press(29);await until(()=>commands.some(c=>c.type==='blackoutOff'),'One-touch RESTORE failed');
  await press(14);await until(()=>model.snapshot().numeric!==null,'ENTER TIME failed');
  // Spatial XL overlay: top-left shows ACTIVE/ENTRY; digits form a right-side
  // 7-8-9 / 4-5-6 / 1-2-3 / 0 keypad. Column 8 stays genuinely FREE.
  const numericPress=async(row,column)=>{const id=`key-${row*8+column}`,a=actions.get(id),payload={controller:'Keypad',coordinates:a.coordinates,settings:a.settings};send('keyDown',id,payload);await delay(45);send('keyUp',id,payload);};
  await numericPress(3,0);await until(()=>model.snapshot().timers.t1.draft.durationMs===0,'Clear SET did not clear only prepared draft');assert.equal(raw.t1.running,false);assert.notEqual(raw.t1.durationMs,0,'Clear SET is not ACTIVE reset');
  await numericPress(2,1);for(const digit of '012345'){const [row,column]={0:[3,5],1:[2,4],2:[2,5],3:[2,6],4:[1,4],5:[1,5]}[digit];await numericPress(row,column);}
  await until(()=>model.snapshot().numeric?.buffer==='012345','Numeric digits did not reach host');await numericPress(3,2);await until(()=>model.snapshot().timers.t1.draft.durationMs===5025000,'Numeric apply not 01:23:45');assert.equal(raw.t1.running,false);
  await press(0);await until(()=>raw.t1.running&&raw.t1.durationMs===5025000,'START SET ready tap failed');assert.equal(commands.filter(c=>c.type==='startSet').length,2);
  instructions=[{id:'bind-test',type:'bind',deviceId,context:'key-6',instanceId:'instance-6',layoutId:layout.id,slotId:layout.slots[16].id}];
  await until(()=>results.some(r=>r.id==='bind-test'),'Binding no response');assert.equal(results.at(-1).deviceConfirmed,true);assert.equal(actions.get('key-6').settings.slotIndex,16);assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile').length,0);
  board.slots[16]=null;
  await until(()=>actions.get('key-6').settings.key.command==='empty','Owned inactive slot was not emptied');
  const settingsWrites=sdkMessages.filter(m=>m.event==='setSettings'&&m.context==='key-6').length;
  await delay(600);assert.equal(sdkMessages.filter(m=>m.event==='setSettings'&&m.context==='key-6').length,settingsWrites,'inactive slot must not generate a new identity/settings write every frame');
  board=L.defaultLayout();
  const independent={instanceId:'instance-6',key:L.defaultKey('adjust',{step:5,unit:'m',target:'set'})};
  actions.get('key-6').settings=independent;send('didReceiveSettings','key-6',{controller:'Keypad',coordinates:actions.get('key-6').coordinates,settings:independent});
  await until(()=>inventory.actions.find(a=>a.context==='key-6')?.layoutId===undefined,'Elgato detach not acknowledged');
  const startedDeadline=raw.t1.endAt;await press(6);await until(()=>model.snapshot().timers.t1.draft.durationMs===5325000,'Independent Elgato edit did not execute its selected command');assert.equal(raw.t1.endAt,startedDeadline);assert.equal(bells,1);
  // Explicitly add our own actions to formerly FREE positions. No foreign
  // action is replaced; the mixed-profile assertions above stay intact.
  for(const i of [7,15,23,31]){const a={settings:{instanceId:`instance-${i}`,key:L.defaultLayout('full').slots[i]},coordinates:{row:Math.floor(i/8),column:i%8}};actions.set(`key-${i}`,a);send('willAppear',`key-${i}`,{controller:'Keypad',coordinates:a.coordinates,settings:a.settings,isInMultiAction:false});}
  await until(()=>inventory?.actions.length===32,'New owned controls missing');
  await press(7);assert.equal(raw.t1.endAt,startedDeadline,'LOAD READY must not replace a running ACTIVE');
  await press(1);await until(()=>!raw.t1.running,'Pause before LOAD READY failed');
  await press(7);await until(()=>raw.t1.remMs===5325000&&!raw.t1.running,'LOAD READY did not copy without start');
  assert.equal(model.snapshot().timers.t1.active.status,'READY');
  const readyClocks=JSON.stringify(raw);
  for(const [i,view]of [[15,'t1'],[23,'both'],[31,'t2']]){await press(i);await until(()=>liveView===view,'LIVE selection failed');assert.equal(JSON.stringify(raw),readyClocks,'LIVE selection must not touch either clock');}
  online=false;await until(()=>sdkMessages.some(m=>m.event==='setImage'&&m.context==='key-3'&&imageSvg(m).includes('OFFLINE')),'Offline display missing');
  const count=commands.length;await press(0,1650);assert.equal(commands.length,count,'no offline START SET');await press(30);assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile').length,0,'starter CLEAR SET must not claim a profile switch');
  const customBack={...actions.get('key-30').settings,key:L.defaultKey('back')};actions.get('key-30').settings=customBack;
  send('didReceiveSettings','key-30',{controller:'Keypad',coordinates:actions.get('key-30').coordinates,settings:customBack});
  await delay(50);await press(30);await until(()=>sdkMessages.some(m=>m.event==='switchToProfile'),'optional custom BACK remains available offline');
  assert.equal(sdkMessages.find(m=>m.event==='switchToProfile').payload.profile,undefined);
  online=true;
  const reconnectSequence=stateSequence;
  connection.send(JSON.stringify({event:'didReceiveDeepLink',payload:{url:`/bootstrap?port=${server.address().port}&nonce=${nonce}&streamdeck=hidden`}}));
  await until(()=>stateSequence>reconnectSequence&&inventory?.devices.length===1,'Reconnect inventory missing');
  const commandsBeforeProfile=commands.length;
  instructions=[{id:'activate-native',type:'activate',deviceId,profile:'profiles/protimer-xl-full'}];
  await until(()=>results.some(r=>r.id==='activate-native'),'Manual native profile request missing');
  assert.equal(results.find(r=>r.id==='activate-native').ok,true);
  assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile'&&m.payload.profile==='profiles/protimer-xl-full').length,1);
  instructions=[{id:'activate-native',type:'activate',deviceId,profile:'profiles/protimer-xl-full'}];await delay(500);
  assert.equal(sdkMessages.filter(m=>m.event==='switchToProfile'&&m.payload.profile==='profiles/protimer-xl-full').length,1,'duplicate instruction must not switch twice');
  instructions=[{id:'invalid-profile',type:'activate',deviceId,profile:'private-user-profile'}];
  await until(()=>results.some(r=>r.id==='invalid-profile'),'Invalid profile response missing');
  assert.equal(results.find(r=>r.id==='invalid-profile').ok,false);assert.equal(commands.length,commandsBeforeProfile,'profile activation never runs a timer command');
});
