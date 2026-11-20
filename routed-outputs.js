'use strict';
const path=require('node:path');
const Routes=require('./audience-routes');
const TimerTools=require('./timer-tools');
const {gridBounds}=require('./output-quality');

function placement(display,route,state){
  if(route.presentation==='fullscreen') return display.bounds;
  const settings=route.view==='t2'?state.secondary:state;
  if(settings?.gridOn&&settings.gridSize) return gridBounds(display,settings);
  const area=display.workArea;
  const size=TimerTools.size(settings?.outputSize);
  const width=Math.min(area.width,size?.width??Math.min(900,Math.round(area.width*.55)));
  const height=Math.min(area.height,size?.height??Math.round(width*9/16));
  return {x:area.x+Math.floor((area.width-width)/2),y:area.y+Math.floor((area.height-height)/2),width,height};
}

module.exports=function routedOutputs({BrowserWindow,getDisplays,getState,occupied,changed}){
  const entries=new Map();
  let applying=false;
  function info(){
    return [...entries.values()].filter(entry=>entry.live).map(({route})=>({...route}));
  }
  function has(id){ return entries.has(id); }
  function close(ids){
    for(const [id,entry] of entries){
      if(!ids||ids.includes(id)) entry.window.destroy();
    }
  }
  function publish(entry,state){
    if(!entry.loaded||entry.window.isDestroyed()) return;
    entry.window.webContents.send('state',Routes.project(state,entry.route));
  }
  function place(entry,display,state){
    const full=entry.route.presentation==='fullscreen';
    const settings=entry.route.view==='t2'?state.secondary:state;
    entry.window.setAlwaysOnTop((full&&!display.hasControl)||TimerTools.outputOnTop(settings),'floating');
    entry.window.setBounds(placement(display,entry.route,state));
    entry.window.webContents.send('win-fs',full);
  }
  function prepare(route,display){
    const state=getState();
    const win=new BrowserWindow({
      ...placement(display,route,state),show:false,title:'ProTimer',
      backgroundColor:Routes.backgrounds[route.background]||state.bgColor||'#000000',
      frame:false,hasShadow:false,movable:false,resizable:false,fullscreenable:false,
      enableLargerThanScreen:true,
      webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,
        nodeIntegration:false,backgroundThrottling:false}
    });
    const entry={route,window:win,live:false,loaded:false};
    entries.set(route.displayId,entry);
    win.on('closed',()=>{
      if(entries.get(route.displayId)===entry) entries.delete(route.displayId);
      changed();
    });
    return new Promise((resolve,reject)=>{
      // Load the shared renderer off-screen and wait for its first paint.
      // Leave already-live outputs alone if a target fails to initialize.
      let painted=false;
      const timer=setTimeout(()=>fail(new Error('OUTPUT_TIMEOUT')),6000);
      function fail(error){ clearTimeout(timer); reject(error); }
      function finish(){
        if(!painted||!entry.loaded) return;
        clearTimeout(timer);
        resolve(entry);
      }
      win.once('closed',()=>fail(new Error('OUTPUT_CLOSED')));
      win.once('ready-to-show',()=>{ painted=true; finish(); });
      win.loadFile(path.join(__dirname,'output.html'),{query:{routed:'1'}}).then(()=>{
        if(win.isDestroyed()) return;
        entry.loaded=true;
        publish(entry,getState());
        finish();
      }).catch(fail);
    });
  }
  async function apply(values){
    if(applying) return {ok:false,code:'OUTPUT_BUSY'};
    const state=getState();
    if(!state) return {ok:false,code:'OUTPUT_NOT_READY'};
    const connected=getDisplays();
    const plan=Routes.plan(values,connected,state,occupied());
    if(!plan.ok) return plan;
    applying=true;
    const newIds=plan.routes.filter(route=>!has(route.displayId)).map(route=>route.displayId);
    try{
      await Promise.all(plan.routes.filter(route=>newIds.includes(route.displayId))
        .map(route=>prepare(route,Routes.displayFor(route,connected))));
      const displays=getDisplays(), current=getState();
      const checked=Routes.plan(plan.routes,displays,current,occupied());
      if(!checked.ok){ close(newIds); return checked; }
      if(plan.routes.some(route=>!has(route.displayId))){ close(newIds); return {ok:false,code:'OUTPUT_CLOSED'}; }
      for(const route of plan.routes){
        const entry=entries.get(route.displayId);
        entry.route=route;
        place(entry,Routes.displayFor(route,displays),current);
        publish(entry,current);
        if(!entry.live) entry.window.showInactive();
        entry.live=true;
      }
      changed();
      return {ok:true,outputs:plan.routes};
    }catch(error){
      close(newIds);
      return {ok:false,code:'OUTPUT_NOT_APPLIED'};
    }finally{ applying=false; }
  }
  function update(previous){
    if(!entries.size) return;
    const current=getState(), displays=getDisplays();
    for(const entry of entries.values()){
      const {route}=entry, target=Routes.displayFor(route,displays);
      if(!target){ entry.window.destroy(); continue; }
      if(entry.live&&(!previous||
        JSON.stringify(placement(target,route,previous))!==JSON.stringify(placement(target,route,current))||
        TimerTools.outputOnTop(route.view==='t2'?previous.secondary:previous)!==TimerTools.outputOnTop(route.view==='t2'?current.secondary:current)))
        place(entry,target,current);
      publish(entry,current);
    }
  }
  return {info,has,close,apply,update};
};
