'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {BrowserWindow} = require('electron');

// Real audience windows; all app settings belong to disposable --smoke userData.
module.exports = async function({controlWin,getOutput,getSecondary,screen}) {
  const ctl=code=>controlWin.webContents.executeJavaScript(code);
  const wait=async(probe,message)=>{
    const end=Date.now()+5000;
    while(!await probe()){assert.ok(Date.now()<end,message);await new Promise(r=>setTimeout(r,30));}
  };
  const host=screen.getDisplayMatching(controlWin.getBounds());
  const setTop=(role,on)=>ctl(`$('${role==='secondary'?'chkSecondaryOutputOnTop':'chkOutputOnTop'}').checked=${!!on};$('${role==='secondary'?'chkSecondaryOutputOnTop':'chkOutputOnTop'}').dispatchEvent(new Event('change'));`);
  await ctl(`api.closeOutput();api.closeSecondaryOutput();`);
  await wait(()=>!getOutput()&&!getSecondary(),'Close old test outputs');
  await ctl(`bothRunning(false);S.mode='countdown';S.secondary.mode='countdown';setDuration(600000);secondaryDuration(330000);
    S.dualTimer=true;S.separateOutputs=true;S.gridOn=false;S.transparent=false;S.fitWindow=false;
    S.outputLayer='normal';S.outputSize={width:640,height:360};S.secondary.outputLayer='normal';S.secondary.gridOn=false;
    S.secondary.outputSize={width:480,height:270};syncDualUI();send();`);
  await setTop('primary',true);await setTop('secondary',false);
  assert.equal(getOutput(),null); assert.equal(getSecondary(),null,'Checkbox must not open outputs');
  await ctl(`api.sendToDisplay(${host.id});api.openSecondaryOutput(${host.id});`);
  await wait(()=>getOutput()?.isVisible()&&getSecondary()?.isVisible(),'Both outputs open');
  await wait(()=>getOutput().isAlwaysOnTop()&&!getSecondary().isAlwaysOnTop(),'Independent native top on creation');
  console.log('OUTPUT_TOP_CLOSED_EDIT_AND_INDEPENDENT_CREATE_OK=true');

  await ctl(`$('btnBothStart').click();`);
  await wait(()=>ctl('S.running&&S.secondary.running'),'Both timers running');
  const clocks=`JSON.stringify([S,S.secondary].map(s=>({running:s.running,mode:s.mode,durationMs:s.durationMs,endAt:s.endAt,startAt:s.startAt})))`;
  const before=await ctl(clocks),primary=getOutput(),secondary=getSecondary();
  const a=primary.getBounds(),b=secondary.getBounds(),controlTop=controlWin.isAlwaysOnTop();
  await setTop('primary',false);await setTop('secondary',true);
  await wait(()=>!primary.isAlwaysOnTop()&&secondary.isAlwaysOnTop(),'Live checkbox changes');
  assert.equal(await ctl(clocks),before,'Checkbox must not touch either clock');
  assert.equal(getOutput(),primary);assert.equal(getSecondary(),secondary,'No output recreation');
  assert.deepEqual(primary.getBounds(),a);assert.deepEqual(secondary.getBounds(),b);
  assert.equal(controlWin.isAlwaysOnTop(),controlTop,'Control stacking must not change');
  if(process.platform==='darwin') {
    assert.equal(secondary.isVisibleOnAllWorkspaces(),true);
    assert.equal(primary.isVisibleOnAllWorkspaces(),false);
  }
  assert.deepEqual(await ctl(`(()=>{const s=JSON.parse(localStorage.getItem('pt_settings'));return [s.outputLayer,s.secondary.outputLayer]})()`),['normal','above']);
  console.log('OUTPUT_TOP_LIVE_CLOCKS_GEOMETRY_CONTROL_AND_PERSISTENCE_OK=true');

  await ctl(`S.secondary.gridOn=true;S.secondary.gridSize=3;S.secondary.gridCell=2;send();`);
  await wait(()=>secondary.getBounds().width!==b.width,'Secondary Grid applied');
  await setTop('secondary',false);
  await wait(()=>!secondary.isAlwaysOnTop(),'Unchecked must override Grid priority');
  await ctl(`S.secondary.gridCell=5;send();`);
  assert.equal(secondary.isAlwaysOnTop(),false,'Grid must not secretly turn top back on');
  await setTop('secondary',true);
  await wait(()=>secondary.isAlwaysOnTop(),'Checkbox explicitly enables top');
  console.log('OUTPUT_TOP_GRID_NO_AUTOMATIC_REENABLE_OK=true');

  await ctl(`$('btnBothPause').click();`);
  await setTop('primary',true);await setTop('secondary',false);
  await ctl(`api.closeOutput();api.closeSecondaryOutput();`);
  await wait(()=>!getOutput()&&!getSecondary(),'Close before persistence reload');
  await new Promise(resolve=>{controlWin.webContents.once('did-finish-load',resolve);controlWin.webContents.reload();});
  assert.deepEqual(await ctl(`[S.outputLayer,S.secondary.outputLayer,$('chkOutputOnTop').checked,$('chkSecondaryOutputOnTop').checked]`),['above','normal',true,false]);
  assert.equal(getOutput(),null);assert.equal(getSecondary(),null,'Reload must stay Control-only');
  await ctl(`api.sendToDisplay(${host.id});api.openSecondaryOutput(${host.id});`);
  await wait(()=>getOutput()?.isVisible()&&getSecondary()?.isVisible(),'Reopen after reload');
  await wait(()=>getOutput().isAlwaysOnTop()&&!getSecondary().isAlwaysOnTop(),'Restored checkbox states');
  await ctl(`S.transparent=true;send();`);
  await wait(()=>getOutput()?.isVisible()&&getSecondary()?.isVisible(),'Transparent outputs recreated');
  await wait(()=>getOutput().isAlwaysOnTop()&&!getSecondary().isAlwaysOnTop(),'Transparency must not override unchecked');
  console.log('OUTPUT_TOP_RELOAD_CONTROL_ONLY_REOPEN_TRANSPARENCY_OK=true');

  const helper=process.env.PROTIMER_WINDOW_ORDER_HELPER;
  const nativeOrder=(...pids)=>JSON.parse(execFileSync(helper,[process.pid,...pids].map(String),{encoding:'utf8',timeout:5000}));
  const nativeId=win=>Number(win.getMediaSourceId().split(':')[1]);
  if(process.platform==='darwin'&&helper) {
    // Same documented level as installed StageDeck projection; not a claim
    // that this controlled fixture is the actual StageDeck application.
    const presentation=new BrowserWindow({...host.bounds,frame:false,show:false,backgroundColor:'#24314a',webPreferences:{sandbox:true}});
    try {
      presentation.setAlwaysOnTop(true,'screen-saver');
      await presentation.loadURL('data:text/html,<body style="background:%2324314a;color:white;font:40px system-ui">Presentation z-order test</body>');
      presentation.show();presentation.focus();
      const pid=nativeId(presentation),tid=nativeId(getOutput());
      await wait(()=>{const rows=nativeOrder();return rows.some(r=>r.id===pid)&&rows.some(r=>r.id===tid);},'Native windows visible');
      let rows=nativeOrder(),p=rows.find(r=>r.id===pid),t=rows.find(r=>r.id===tid);
      assert.ok(t.layer>p.layer&&t.order<p.order,JSON.stringify({timer:t,presentation:p}));
      console.log('OUTPUT_TOP_NATIVE_ABOVE_STAGEDECK_LEVEL_OK='+JSON.stringify({timerLayer:t.layer,presentationLayer:p.layer,timerOrder:t.order,presentationOrder:p.order}));
      await setTop('primary',false);presentation.focus();
      await wait(()=>{const r=nativeOrder(),a=r.find(x=>x.id===pid),b=r.find(x=>x.id===tid);return a&&b&&a.order<b.order;},'Unchecked must really go behind presentation');
      await setTop('primary',true);presentation.focus();
      await wait(()=>{const r=nativeOrder(),a=r.find(x=>x.id===pid),b=r.find(x=>x.id===tid);return a&&b&&b.order<a.order;},'Recheck must return over focused presentation');
      console.log('OUTPUT_TOP_NATIVE_OFF_ON_REAL_Z_ORDER_OK=true');
    } finally {presentation.destroy();}

    const pptPid=Number(process.env.PROTIMER_TEST_POWERPOINT_PID);
    if(pptPid>0) {
      const activate=()=>execFileSync('/usr/bin/osascript',['-e','tell application "Microsoft PowerPoint" to activate'],{timeout:5000});
      activate();
      const ppt=nativeOrder(pptPid).filter(r=>r.pid===pptPid&&r.bounds.Width>600&&r.bounds.Height>400).sort((a,b)=>b.bounds.Width*b.bounds.Height-a.bounds.Width*a.bounds.Height)[0];
      assert.ok(ppt,'Actual PowerPoint slideshow window is required');
      const target=screen.getDisplayMatching({x:ppt.bounds.X,y:ppt.bounds.Y,width:ppt.bounds.Width,height:ppt.bounds.Height});
      await ctl(`S.transparent=false;S.gridOn=false;S.outputSize={width:480,height:270};send();api.sendToDisplay(${target.id});`);
      await wait(()=>getOutput()?.isVisible()&&getOutput().getBounds().width===480,'Timer over PowerPoint display');
      const tid=nativeId(getOutput());activate();
      await wait(()=>{const r=nativeOrder(pptPid),p=r.find(x=>x.id===ppt.id),t=r.find(x=>x.id===tid);return p&&t&&t.order<p.order;},'Timer not above actual focused PowerPoint');
      let rows=nativeOrder(pptPid),t=rows.find(r=>r.id===tid),p=rows.find(r=>r.id===ppt.id);
      const overlap=Math.max(0,Math.min(t.bounds.X+t.bounds.Width,p.bounds.X+p.bounds.Width)-Math.max(t.bounds.X,p.bounds.X))*Math.max(0,Math.min(t.bounds.Y+t.bounds.Height,p.bounds.Y+p.bounds.Height)-Math.max(t.bounds.Y,p.bounds.Y));
      assert.ok(overlap>t.bounds.Width*t.bounds.Height*.9,'Timer must overlap the PowerPoint screen');
      console.log('OUTPUT_TOP_ACTUAL_POWERPOINT_FOREGROUND_OK='+JSON.stringify({timerLayer:t.layer,powerPointLayer:p.layer,timerOrder:t.order,powerPointOrder:p.order,overlap}));
      await setTop('primary',false);activate();
      await wait(()=>{const r=nativeOrder(pptPid),p=r.find(x=>x.id===ppt.id),t=r.find(x=>x.id===tid);return p&&t&&p.order<t.order;},'Unchecked must let actual PowerPoint cover timer');
      await setTop('primary',true);activate();
      await wait(()=>{const r=nativeOrder(pptPid),p=r.find(x=>x.id===ppt.id),t=r.find(x=>x.id===tid);return p&&t&&t.order<p.order;},'Recheck must return above actual PowerPoint');
      console.log('OUTPUT_TOP_ACTUAL_POWERPOINT_OFF_ON_OK=true');
    }
  }

  const oldSize=controlWin.getContentSize();
  for(const width of [820,1120]) {
    controlWin.setContentSize(width,740);
    for(const language of ['sr','en']) {
      await ctl(`lang='${language}';S.lang=lang;applyLang();`);
      assert.equal(await ctl(`(()=>{return ['chkOutputOnTop','chkSecondaryOutputOnTop','chkOnTop'].every(id=>{const r=$(id).parentElement.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});})()`),true,`Checkbox clipped at ${width} ${language}`);
    }
  }
  controlWin.setContentSize(...oldSize);
  await ctl(`lang='sr';S.lang=lang;applyLang();`);
  console.log('OUTPUT_TOP_RESPONSIVE_SR_EN_OK=true');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'protimer-on-top-'));
  const screenshot=path.join(dir,'timer-on-top-checkbox.png');
  const rect=await ctl(`(()=>{const r=document.querySelector('.topbar').getBoundingClientRect();return{x:0,y:0,width:innerWidth,height:Math.ceil(r.height)};})()`);
  fs.writeFileSync(screenshot,(await controlWin.webContents.capturePage(rect)).toPNG());
  console.log('OUTPUT_TOP_SCREENSHOT='+screenshot);
};
