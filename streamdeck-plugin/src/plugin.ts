import streamDeck, {action,SingletonAction,type KeyAction,type KeyDownEvent,type KeyUpEvent,type WillAppearEvent,type WillDisappearEvent,type DidReceiveSettingsEvent} from '@elgato/streamdeck';
import {randomUUID} from 'node:crypto';
import {Bridge} from './bridge.js';
import {keyImage,pinCommand,needsHold,numericBindings,formatMs} from './logic.js';
import type {Settings,Key,Command,Frame,Instruction,TimerId} from './types.js';
import {layout} from './shared.js';

// SDK 3 defaults to cached/message-ID settings behavior requiring SD 7.1.
// Legacy event behavior keeps our declared 7.0 support and, importantly, makes
// getSettings a real Elgato round-trip rather than a read from SDK's own cache.
streamDeck.settings.useLegacySettingsBehavior=true;

const bridge=new Bridge();
type Owned={action:KeyAction<Settings>;settings:Settings;lastKey?:Key;lastImage?:string;error?:string;errorUntil?:number};
type Press={command:Command;deviceId:string;cancelled:boolean;pressId?:string;timer?:ReturnType<typeof setTimeout>};
const owned=new Map<string,Owned>(), presses=new Map<string,Press>();
const defaultKey=():Key=>layout.defaultKey('empty',{name:'SET UP'});
let inventoryDirty=true, inventoryAt=0, sequence=0;
let numeric:{deviceId:string;timerId:TimerId;bindings:NonNullable<ReturnType<typeof numericBindings>>;pending:boolean}|undefined;
// The checked-in package intentionally has no invented native profile exports.
// A verified exported starter profile can later be registered here and manifest.
const bundledProfiles:ReadonlySet<string>=new Set();
const instructionIds=new Set<string>();
async function readback(item:Owned){
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([item.action.getSettings(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(Error('Elgato settings timeout')),900);})]);}
  finally{clearTimeout(timeout);}
}

function keyFor(item:Owned):Key{
  const settings=item.settings,frame=bridge.frame;
  if(settings.layoutId&&settings.slotId&&frame?.layout.id===settings.layoutId){
    const index=Number.isInteger(settings.slotIndex)?settings.slotIndex!:frame.layout.slots.findIndex(slot=>slot?.id===settings.slotId);
    item.lastKey=frame.layout.slots[index]||{...defaultKey(),command:'empty',name:'EMPTY SLOT'};return item.lastKey;
  }
  if(settings.layoutId&&item.lastKey)return item.lastKey;
  try{return settings.key?layout.normalizeKey(settings.key)||defaultKey():defaultKey();}catch{return layout.defaultKey('empty',{name:'INVALID KEY'});}
}
async function cancelPress(context:string){
  const p=presses.get(context);if(!p)return;
  p.cancelled=true;clearTimeout(p.timer);presses.delete(context);
  if(p.pressId&&bridge.online)await bridge.send('/release',{pressId:p.pressId,deviceId:p.deviceId}).catch(()=>{});
}
function cancelAll(){for(const id of presses.keys())void cancelPress(id);numeric=undefined;}
function fail(item:Owned,message='NOT CONFIRMED'){item.error=message.slice(0,22);item.errorUntil=performance.now()+2000;void item.action.showAlert();void render(item);}
async function render(item:Owned){
  const key=keyFor(item),state=bridge.online?bridge.frame?.state:undefined;
  const binding=numeric?.bindings.get(item.action.id);
  let overlay:Parameters<typeof keyImage>[2];
  if(numeric?.deviceId===item.action.device.id&&!binding)overlay={label:'—',status:'NUMERIC ENTRY'};
  if(binding&&state&&binding.type!=='activeTime'){
    const entry=state.numeric;
    overlay={label:binding.label,status:'SET ONLY'};
    if(binding.type==='numericValue')overlay={label:`${numeric!.timerId.toUpperCase()} ENTRY`,value:entry?.buffer?.replace(/(\d{2})(\d{2})(\d{2})/,'$1:$2:$3')||formatMs(state.timers[numeric!.timerId].draft.durationMs),status:entry?.field?String(entry.field).toUpperCase():'EDITING'};
  }
  const displayKey=binding?.type==='activeTime'?{...key,command:'activeTime',timerId:numeric!.timerId}:key;
  const error=(item.errorUntil||0)>performance.now()?item.error:undefined;
  const image=keyImage(displayKey,state,overlay,error);
  if(image===item.lastImage)return;
  await item.action.setImage(image);item.lastImage=image;
}
async function sendInventory(){
  if(!bridge.online)return;
  inventoryDirty=false;inventoryAt=performance.now();
  await bridge.send('/inventory',{
    protocolVersion:1,pluginVersion:'0.1.0',softwareVersion:streamDeck.info.application.version,
    devices:[...streamDeck.devices].filter(device=>device.isConnected).map(device=>({id:device.id,name:device.name,type:device.type,size:device.size})),
    actions:[...owned.values()].map(item=>({context:item.action.id,instanceId:item.settings.instanceId,deviceId:item.action.device.id,row:item.action.coordinates?.row,column:item.action.coordinates?.column,layoutId:item.settings.layoutId,slotId:item.settings.slotId,slotIndex:item.settings.slotIndex})),
    canActivate:bundledProfiles.size>0,profiles:[...bundledProfiles],layoutRevision:bridge.frame?.layoutRevision,
    profileEvidence:'visible-own-actions-only',
    profileUnavailableReason:bundledProfiles.size?undefined:'Starter profiles require export and validation in the Elgato application; manual ProTimer Key placement is available.'
  });
}
async function instruction(i:Instruction){
  if(instructionIds.has(i.id))return;instructionIds.add(i.id);if(instructionIds.size>512)instructionIds.delete(instructionIds.values().next().value!);
  try{
    if(i.type==='activate'){
      if(!i.deviceId||!i.profile||!bundledProfiles.has(i.profile))throw Error('No verified bundled profile');
      if(!streamDeck.devices.getDeviceById(i.deviceId)?.isConnected)throw Error('Device disconnected');
      await streamDeck.profiles.switchToProfile(i.deviceId,i.profile);
      await bridge.send('/result',{id:i.id,ok:true,status:'request-sent-not-activation-confirmed'});
    }else if(i.type==='back'){
      // SDK cannot identify arbitrary profiles. Only accept operator's explicit
      // current-device request when our own visible actions provide evidence.
      if(!i.deviceId||![...owned.values()].some(item=>item.action.device.id===i.deviceId))throw Error('No visible ProTimer actions on this device');
      cancelAll();await streamDeck.profiles.switchToProfile(i.deviceId);
      await bridge.send('/result',{id:i.id,ok:true,status:'request-sent-not-activation-confirmed'});
    }else if(i.type==='bind'){
      const item=i.context?owned.get(i.context):undefined,frame=bridge.frame;
      if(!item||item.action.device.id!==i.deviceId||item.settings.instanceId!==i.instanceId||!frame||frame.layout.id!==i.layoutId)throw Error('Owned action changed');
      const index=frame.layout.slots.findIndex(key=>key?.id===i.slotId);
      if(index<0)throw Error('Unknown logical slot');
      await cancelPress(item.action.id);
      const settings={...item.settings,layoutId:i.layoutId,slotId:i.slotId,slotIndex:index,key:frame.layout.slots[index]!};
      await item.action.setSettings(settings);
      const confirmed=await readback(item);
      if(confirmed.instanceId!==settings.instanceId||confirmed.layoutId!==settings.layoutId||confirmed.slotIndex!==index||confirmed.slotId!==settings.slotId)throw Error('Settings not confirmed');
      item.settings=confirmed;item.lastImage=undefined;await render(item);inventoryDirty=true;await sendInventory();
      await bridge.send('/result',{id:i.id,ok:true,deviceConfirmed:true,status:'sdk-settings-readback-confirmed'});
    }else if(i.type==='applyLayout'){
      // One host snapshot is the atomic logical layout source. SDK image calls
      // are not a hardware transaction and do not claim one. Only own instances.
      cancelAll();
      const frame=bridge.frame!;
      if(i.layoutRevision!==frame.layoutRevision)throw Error('Layout revision changed');
      let updatedLinkedActions=0;
      await Promise.all([...owned.values()].map(async item=>{
        if(item.settings.layoutId===frame.layout.id&&Number.isInteger(item.settings.slotIndex)){
          const key=keyFor(item),settings={...item.settings,key,slotId:key.id};
          await item.action.setSettings(settings);const confirmed=await readback(item);
          if(JSON.stringify(confirmed.key)!==JSON.stringify(settings.key))throw Error('Key settings not confirmed');item.settings=confirmed;updatedLinkedActions++;
        }
        await render(item);
      }));
      await sendInventory();await bridge.send('/result',{id:i.id,ok:true,deviceConfirmed:updatedLinkedActions>0,updatedLinkedActions,layoutRevision:frame.layoutRevision,status:updatedLinkedActions?'visible-owned-settings-readback-confirmed':'no-visible-linked-actions'});
    }else throw Error('Unsupported instruction');
  }catch{await bridge.send('/result',{id:i.id,ok:false,error:'Cannot perform requested profile/layout operation'}).catch(()=>{});}
}

@action({UUID:'com.srdjankotarlic.protimer.key'})
class ProTimerKey extends SingletonAction<Settings>{
  override async onWillAppear(ev:WillAppearEvent<Settings>){
    if(!ev.action.isKey()||ev.action.isInMultiAction())return;
    const settings={...ev.payload.settings};
    // Elgato duplicates persisted settings. A visible collision gets a fresh
    // stable identity; device + context remains the current lifecycle identity.
    if(!settings.instanceId||[...owned.values()].some(item=>item.settings.instanceId===settings.instanceId&&item.action.id!==ev.action.id)){
      settings.instanceId=randomUUID();await ev.action.setSettings(settings);
    }
    owned.set(ev.action.id,{action:ev.action,settings});inventoryDirty=true;await render(owned.get(ev.action.id)!);
  }
  override async onWillDisappear(ev:WillDisappearEvent<Settings>){await cancelPress(ev.action.id);owned.delete(ev.action.id);if(numeric?.bindings.has(ev.action.id))numeric=undefined;inventoryDirty=true;}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<Settings>){
    const item=owned.get(ev.action.id);if(!item)return;
    await cancelPress(ev.action.id);item.settings={...ev.payload.settings};item.lastImage=undefined;inventoryDirty=true;await render(item);
  }
  override async onKeyDown(ev:KeyDownEvent<Settings>){
    const item=owned.get(ev.action.id);if(!item||presses.has(ev.action.id))return;
    const key=keyFor(item);
    // BACK deliberately works with no ProTimer process or bridge connection.
    if(key.command==='back'&&!numeric){cancelAll();presses.set(ev.action.id,{command:{} as Command,deviceId:ev.action.device.id,cancelled:false});await streamDeck.profiles.switchToProfile(ev.action.device.id);return;}
    if(!bridge.online||!bridge.frame){fail(item,'OFFLINE');return;}
    const state=bridge.frame.state,binding=numeric?.bindings.get(ev.action.id);
    if(numeric?.deviceId===ev.action.device.id&&!binding)return;
    if(binding&&['activeTime','numericValue'].includes(binding.type))return;
    if(!binding&&['activeTime','setTime','empty'].includes(key.command))return;
    const command=binding?{commandId:randomUUID(),type:binding.type,timerId:numeric!.timerId,payload:binding.type==='numericDigit'?{digit:Number(binding.value)}:binding.type==='numericField'?{field:binding.value}:{}}:pinCommand(key,state);
    command.sequence=++sequence;
    if(command.type==='numericBegin'){
      const contexts=[...owned.values()].filter(o=>o.action.device.id===ev.action.device.id).sort((a,b)=>(a.action.coordinates!.row*8+a.action.coordinates!.column)-(b.action.coordinates!.row*8+b.action.coordinates!.column)).map(o=>o.action.id);
      const bindings=numericBindings(contexts);if(!bindings){fail(item,'NEED 20 KEYS');return;}
      numeric={deviceId:ev.action.device.id,timerId:command.timerId,bindings,pending:true};
    }
    const p:Press={command,deviceId:ev.action.device.id,cancelled:false};presses.set(ev.action.id,p);
    const apply=async()=>{
      if(p.cancelled||!bridge.online||!owned.has(ev.action.id))return;
      try{await bridge.command(command,p.deviceId);if(command.type==='numericBegin'&&numeric)numeric.pending=false;if(['numericApply','numericCancel'].includes(command.type))numeric=undefined;}
      catch(error){if(command.type==='numericBegin')numeric=undefined;const reason=error instanceof Error&&/^[A-Z_]{2,40}$/.test(error.message)?error.message.replaceAll('_',' '):'NOT CONFIRMED';fail(item,reason);}
    };
    if(!binding&&needsHold(key,command,state)){
      try{
        const result=await bridge.send('/press',{command,deviceId:p.deviceId});p.pressId=result.pressId;
        if(p.cancelled){if(p.pressId)await bridge.send('/release',{pressId:p.pressId,deviceId:p.deviceId});return;}
        if(!result.ok||!p.pressId){fail(item,'HOLD REJECTED');return;}
        command.pressId=p.pressId;p.timer=setTimeout(()=>void apply(),1550);
      }catch{fail(item,'HOLD REJECTED');}
    }else await apply();
  }
  override async onKeyUp(ev:KeyUpEvent<Settings>){await cancelPress(ev.action.id);}
}

bridge.onOffline=()=>{cancelAll();for(const item of owned.values())void render(item);};
bridge.onFrame=async(frame:Frame)=>{
  if(numeric&&!numeric.pending&&(!frame.state.numeric||frame.state.numeric.timerId!==numeric.timerId))numeric=undefined;
  await Promise.all([...owned.values()].map(render));
  if(inventoryDirty||performance.now()-inventoryAt>1500)await sendInventory();
  for(const i of frame.instructions||[])await instruction(i);
};
streamDeck.system.onDidReceiveDeepLink(ev=>{void bridge.bootstrap(ev.url.path,ev.url.queryParameters);});
streamDeck.devices.onDeviceDidConnect(()=>{inventoryDirty=true;});
streamDeck.devices.onDeviceDidChange(()=>{cancelAll();inventoryDirty=true;});
streamDeck.devices.onDeviceDidDisconnect(ev=>{cancelAll();for(const [id,item]of owned)if(item.action.device.id===ev.device.id)owned.delete(id);inventoryDirty=true;});
streamDeck.system.onSystemDidWakeUp(()=>bridge.disconnect());
streamDeck.actions.registerAction(new ProTimerKey());
// No focus/app/USB listener calls switchToProfile. Reconnection only pairs.
await streamDeck.connect();
