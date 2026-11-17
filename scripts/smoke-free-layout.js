'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {BrowserWindow}=require('electron');
const {MEASURE_RENDERER}=require('../output-quality');

module.exports=async function({controlWin,getOutput,screen,serverPort}){
  const ctl=code=>controlWin.webContents.executeJavaScript(code);
  const run=(win,code)=>win.webContents.executeJavaScript(code);
  async function wait(probe,message){
    const end=Date.now()+6500;
    while(!await probe()){assert.ok(Date.now()<end,message);await new Promise(r=>setTimeout(r,35));}
  }
  const host=screen.getDisplayMatching(controlWin.getBounds());
  await ctl(`api.closeSecondaryOutput();api.closeOutput();`);
  await wait(()=>!getOutput(),'Old test output closed');
  await ctl(`bothRunning(false); S.dualTimer=true;S.separateOutputs=false;S.dualSplit='rows';S.liveTimerView='both';
    S.freeAudience=false; S.freeLayout=null;S.gridOn=false;S.fitWindow=false;S.transparent=false;S.bgColor='#192637';
    S.blackout=false;S.mode='clock';S.text='SESSION TITLE';S.textOnly=false;S.message={text:'BREAK IN FIVE',flash:false};
    S.showNowNext=false;S.showProgress=false;S.fgColor='#fff';S.useWarnColors=true;S.warnRed='#ff3020';S.redSec=60;
    secondaryDuration(60000);S.secondary.remMs=30000;S.outputSize={width:800,height:500};S.outputLayer='normal';
    S.outputLayout=TimerTools.layout();S.secondary.layout=TimerTools.layout({y:-62});syncDualUI();send();api.sendToDisplay(${host.id});`);
  await wait(()=>getOutput()?.isVisible(),'Audience window did not open');
  const out=getOutput();
  await wait(()=>run(out,`!!S&&S.dualTimer&&$('stage').classList.contains('rows')&&innerWidth===800&&innerHeight===500`),'Split output did not render');
  assert.equal(await run(out,`getComputedStyle($('secondaryPane')).overflow`),'hidden');
  const bounds=out.getBounds();
  const edit=(key,x,y,scale)=>ctl(`$('layoutTarget').value=${JSON.stringify(key)};$('layoutTarget').dispatchEvent(new Event('change'));
    for(const [id,value] of [['timerXValue',${x}],['timerYValue',${y}],['timerScaleValue',${scale}]]){
      $(id).value=value;$(id).dispatchEvent(new Event('input'));
    }`);
  const enable=on=>ctl(`$('chkFreeAudience').checked=${on};$('chkFreeAudience').dispatchEvent(new Event('change'));`);
  await enable(true);
  await edit('primary',-48,20,85);
  await edit('secondary',46,-5,100);
  await edit('title',-30,-78,70);
  await edit('message',16,66,85);
  const measure=`(()=>Object.fromEntries(['timer','secondaryTimer','text','msg'].map(id=>{
    const r=$(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,w:r.width,h:r.height}];
  })))()`;
  await wait(()=>run(out,`document.body.classList.contains('free-audience')&&$('secondaryTimer').style.left==='73%'&&$('msg').style.top==='83%'`),'Free positions did not arrive');
  const rects=await run(out,measure);
  for(const [id,x,y] of [['timer',.26,.60],['secondaryTimer',.73,.475],['text',.35,.11],['msg',.58,.83]]){
    const r=rects[id];assert.ok(Math.abs(r.x+r.w/2-x*800)<1&&Math.abs(r.y+r.h/2-y*500)<1,JSON.stringify({id,r}));
  }
  assert.ok(rects.secondaryTimer.y<250&&rects.secondaryTimer.y+rects.secondaryTimer.h>250,'Timer 2 crosses the old split');
  assert.equal((await run(out,MEASURE_RENDERER)).clipped,false,'No clipping at the old split');
  assert.deepEqual(out.getBounds(),bounds);
  await wait(async()=>{
    const image=await out.webContents.capturePage();
    const {width,height}=image.getSize(),bytes=image.toBitmap();
    // BGRA, count red T2 glyph pixels on both sides of the removed boundary.
    let upper=0, lower=0;
    const X=Math.floor(width*.53), R=Math.ceil(width*.94);
    for(let y=Math.floor(height*.25);y<height*.65;y++)for(let x=X;x<R;x++){
      const i=4*(y*width+x);
      if(bytes[i+2]>200&&bytes[i+1]<95&&bytes[i]<95){if(y<height/2)upper++;else lower++;}
    }
    return upper>300&&lower>50;
  },'Captured timer glyphs are missing across the former pane boundary');
  const screenshot=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'protimer-free-layout-')),'free-audience.png');
  fs.writeFileSync(screenshot,(await out.webContents.capturePage()).toPNG());
  console.log('FREE_LAYOUT_SCREENSHOT='+screenshot);
  console.log('FREE_LAYOUT_NATIVE_PIXELS_CROSS_OLD_DIVIDER_OK=true');

  const viewer=new BrowserWindow({width:800,height:500,useContentSize:true,show:false,webPreferences:{backgroundThrottling:false}});
  try{
    await viewer.loadURL(`http://127.0.0.1:${serverPort}/`);
    await wait(()=>run(viewer,`document.body.classList.contains('free-audience')&&$('secondaryTimer').style.left==='73%'&&$('msg').textContent==='BREAK IN FIVE'`),'Browser/OBS output did not receive layout');
    await edit('message',95,66,120);
    await wait(()=>run(out,`$('msg').style.left==='97.5%'`),'Live message layout did not update');
    assert.equal((await run(out,MEASURE_RENDERER)).clipped,true,'Physical viewport edge must still be reported');
    await edit('message',16,66,85);
    await ctl(`S.mode='countdown';setDuration(600000);S.showProgress=true;S.showNowNext=true;
      cues=[{id:'opening',name:'Opening',durationMs:600000},{id:'panel',name:'Panel',durationMs:600000}];currentCue=0;send();`);
    await edit('rundown',0,48,55);
    await edit('progress',0,93,65);
    await wait(()=>run(viewer,`$('nownext').style.top==='74%'&&$('prog').style.top==='96.5%'&&$('nownext').style.display==='flex'&&$('prog').style.display==='block'`),'Rundown and progress not independently placed');
    await enable(false);
    await wait(()=>run(out,`!document.body.classList.contains('free-audience')&&$('secondaryContent').style.transform==='translate(0%, -62%) scale(1)'&&$('msg').style.left===''&&$('prog').style.clipPath===''`),'Turning free mode off must restore the old layout');
    await enable(true);
    assert.equal(await ctl(`JSON.parse(localStorage.getItem('pt_settings')).freeLayout.message.x`),16);
    await ctl('api.closeOutput()');
    await wait(()=>!getOutput(),'Output closed before restart');
    await new Promise(resolve=>{controlWin.webContents.once('did-finish-load',resolve);controlWin.webContents.reload();});
    assert.deepEqual(await ctl(`[S.freeAudience,S.freeLayout.secondary.x,S.freeLayout.message.x,S.secondary.layout.y,$('chkFreeAudience').checked]`),[true,46,16,-62,true]);
    assert.equal(getOutput(),null,'Saved layout never opens the output on startup');
    console.log('FREE_LAYOUT_BROWSER_ELEMENTS_LEGACY_AND_PERSISTENCE_OK=true');
  } finally {viewer.destroy();}
};
