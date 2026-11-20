'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Routes=require('../audience-routes');
const routedOutputs=require('../routed-outputs');

const displays=Array.from({length:7},(_,i)=>({
  id:i+1,label:'Display '+(i+1),hasControl:false,
  bounds:{x:1920*i,y:0,width:1920,height:1080},
  workArea:{x:1920*i,y:0,width:1920,height:1040}
}));
const values=displays.map(({id,label},i)=>({
  displayId:id,label,view:i<3?'t1':i<5?'t2':'both',
  background:i===3?'luma':i===4?'green':i===6?'blue':'standard',presentation:'fullscreen'
}));
const state={
  dualTimer:true,separateOutputs:true,liveTimerView:'t2',
  mode:'countdown',durationMs:600000,remMs:510000,running:true,endAt:1000000,
  secondary:{mode:'countdown',durationMs:300000,remMs:290000,running:true,endAt:800000},
  bgColor:'#121212',fgColor:'#f0f0f0',text:'Hello',textOnly:true,message:{text:'wrap up'},
  showNowNext:true,showProgress:true,blackout:false,blackoutMode:'black',digitFont:'cyber'
};

test('an independent view and key can be assigned to each of seven displays',()=>{
  const planned=Routes.plan(values,displays,state,new Set());
  assert.equal(planned.ok,true);
  assert.deepEqual(planned.routes,values);
  const original=structuredClone(state);
  for(const route of values){
    const output=Routes.project(state,route);
    assert.equal(output.endAt,route.view==='t2'?800000:1000000);
    assert.equal(output.dualTimer,route.view==='both');
    assert.equal(output.digitFont,'cyber');
    assert.equal(output.liveHidden,false);
    if(route.background!=='standard'){
      assert.equal(output.bgColor,Routes.backgrounds[route.background]);
      assert.equal(output.fgColor,'#ffffff');
      assert.equal(output.textOnly,false);
      assert.equal(output.text,'');
      assert.equal(output.message,null);
      assert.equal(output.showProgress,false);
      assert.equal(output.showNowNext,false);
      assert.equal(output.blackoutMode,'foreground');
    }else assert.equal(output.bgColor,state.bgColor);
  }
  assert.deepEqual(state,original);
  assert.equal(Routes.project({...state,dualTimer:false},values[3]).liveHidden,true);
});

test('routing rejects missing and changed display IDs, conflicts and invalid assignments',()=>{
  const plan=(routes,screens=displays,settings=state,occupied=[])=>Routes.plan(routes,screens,settings,new Set(occupied));
  assert.equal(plan(values.slice(0,2),displays.slice(0,1)).code,'DISPLAY_NOT_CONNECTED');
  assert.equal(plan([{...values[0],label:'New display'}]).code,'DISPLAY_NOT_CONNECTED');
  assert.equal(plan([values[0],values[0]]).code,'INVALID_ROUTES');
  assert.equal(plan([{...values[0],background:'__proto__'}]).code,'INVALID_ROUTES');
  assert.equal(plan(values,displays,{dualTimer:false}).code,'TIMER_DISABLED');
  assert.equal(plan(values,displays,state,[4]).code,'STANDARD_OUTPUT_OPEN');
  assert.equal(plan([],displays,state).code,'NO_ROUTES');
});

test('the window manager sends seven independent projections and closes only disconnected or selected outputs',async()=>{
  let connected=displays,settings=state,failId=null;
  const created=[];
  class Window extends EventEmitter {
    constructor(opts){
      super();
      this.id=opts.x/1920+1;
      this.live=false;
      this.destroyed=false;
      this.frames=[];
      this.webContents={send:(type,data)=>{if(type==='state')this.frames.push(data);}};
      created.push(this);
    }
    async loadFile(){
      if(this.id===failId) throw Error('simulated load failure');
      this.emit('ready-to-show');
    }
    isDestroyed(){return this.destroyed;}
    destroy(){this.destroyed=true;this.emit('closed');}
    setAlwaysOnTop(){}
    setBounds(bounds){this.bounds=bounds;}
    showInactive(){this.live=true;}
  }
  const outputs=routedOutputs({BrowserWindow:Window,getDisplays:()=>connected,getState:()=>settings,
    occupied:()=>new Set(),changed:()=>{}});
  assert.deepEqual(outputs.info(),[]);
  assert.equal(await outputs.apply(values).then(r=>r.ok),true);
  assert.deepEqual(outputs.info(),values);
  assert.equal(created.length,7);
  for(const [i,win] of created.entries()){
    assert.equal(win.live,true);
    assert.deepEqual(win.bounds,displays[i].bounds);
    assert.deepEqual(win.frames.at(-1),Routes.project(state,values[i]));
  }

  const reconfigured={...values[1],view:'both'};
  assert.equal(await outputs.apply([reconfigured]).then(r=>r.ok),true);
  assert.equal(created.length,7);
  assert.equal(created[1].frames.at(-1).dualTimer,true);
  settings={...state,blackout:true};
  outputs.update(state);
  assert.equal(created[4].frames.at(-1).bgColor,'#00ff00');
  assert.equal(created[4].frames.at(-1).blackout,true);

  connected=displays.filter(d=>d.id!==4);
  outputs.update();
  assert.equal(created[3].destroyed,true);
  assert.equal(outputs.info().length,6);
  connected=displays;
  outputs.update();
  assert.equal(outputs.info().length,6,'Reconnection requires a new Send');
  assert.equal(created[3].destroyed,true);

  failId=4;
  assert.equal((await outputs.apply([values[3],values[6]])).ok,false);
  assert.equal(outputs.info().length,6);
  assert.deepEqual(created[6].frames.at(-1),Routes.project(settings,values[6]));
  outputs.close([1]);
  assert.equal(created[0].destroyed,true);
  assert.equal(created[1].destroyed,false);
  outputs.close();
  assert.deepEqual(outputs.info(),[]);
});

test('each nonempty combination projects only its enabled source clocks and per-display split',()=>{
  const {groups,optionalTimer,audienceState,outputState}=require('../timer-tools');
  const source={...state,thirdTimer:true,liveTimerView:'all',
    secondary:{...state.secondary,mode:'countup',elapsedMs:42000,startAt:900001},
    tertiary:{...optionalTimer(),mode:'clock',durationMs:1000}};
  const original=structuredClone(source);
  const selections=['t3','t13','t23','all','both','t2','t1'].map((view,i)=>({
    ...values[i],view,split:i%2===0?'rows':'columns'
  }));
  assert.equal(Routes.plan(selections,displays,source,new Set()).ok,true);
  const modes={t1:'countdown',t2:'countup',t3:'clock'};
  for(const route of selections){
    const picture=Routes.project(source,route);
    assert.equal(picture.dualSplit,route.split);
    assert.deepEqual([picture.mode,picture.secondary?.mode,picture.tertiary?.mode].filter(Boolean),groups[route.view].map(id=>modes[id]));
    assert.equal(audienceState(picture),picture,'An individual assignment must survive the renderer projection');
  }
  assert.equal(audienceState(outputState(source)).thirdTimer,false,'Legacy separate T1 output stays solo');
  assert.equal(audienceState(source).thirdTimer,true,'Shared OBS output can include three');
  assert.deepEqual(source,original);
  const two={...source,dualTimer:false};
  assert.equal(Routes.plan([selections[1]],displays,two,new Set()).ok,true);
  assert.equal(Routes.plan([selections[2]],displays,two,new Set()).code,'TIMER_DISABLED');
  assert.equal(Routes.project(two,selections[3]).secondary.mode,'clock');
  assert.equal(Routes.project({...two,thirdTimer:false},selections[0]).liveHidden,true);
});
