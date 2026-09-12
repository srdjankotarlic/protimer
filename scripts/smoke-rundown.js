'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

module.exports = async function smokeRundown({ controlWin }) {
  const js = code => controlWin.webContents.executeJavaScript(code);
  const check = async (name, code) => {
    const result = await js(`(async()=>{${code}})()`);
    assert.equal(result, true, name);
    console.log(name + '=true');
  };
  await js(`cancelAutoAdvance(); autoNext=false; reset(); currentCue=-1; selectedCue=null; editingCue=null; removedCue=null;
    cues=[{name:'Opening',durationMs:60000,note:'Host',color:'#3fb950'},
      {name:'A long keynote title that must stay readable',durationMs:120000,note:'Microphone 1',color:'#4493f8'},
      {name:'Questions',durationMs:180000,note:'Audience',color:'#d9a441'}];
    S.showStart='01:00'; rundownHasRun=false; $('cueEditor').open=false; renderCues(); send();`);
  await check('RUNDOWN_SAFE_SELECTION_OK', `
    const duration=S.durationMs, remaining=S.remMs;
    document.querySelectorAll('.cue-select')[1].click();
    await new Promise(r=>setTimeout(r,100));
    return currentCue===-1&&!S.running&&S.durationMs===duration&&S.remMs===remaining&&selectedCue===cues[1]&&
      !$('ouStatus').classList.contains('late')&&$('cueTotal').textContent===fmtMs(360000);`);
  await check('RUNDOWN_PAUSE_RESUME_OK', `
    $('btnRundownStart').click(); const active=cues[currentCue],deadline=S.endAt;
    document.querySelectorAll('.cue-select')[2].click();
    if(cues[currentCue]!==active||S.endAt!==deadline||!S.running) return false;
    $('btnRundownStart').click(); const paused=S.remMs;
    if(S.running||!$('btnRundownStart').textContent.includes(t('rundownResume'))) return false;
    await new Promise(r=>setTimeout(r,150)); $('btnRundownStart').click();
    return S.running&&currentCue===0&&Math.abs(S.endAt-Date.now()-paused)<100;`);
  await check('RUNDOWN_CONFIRM_REPLACE_OK', `
    const deadline=S.endAt;
    $('btnCueLoad').click();
    if($('cueConfirm').hidden||S.endAt!==deadline||currentCue!==0) return false;
    $('btnCueCancelAction').click(); if(!$('cueConfirm').hidden||S.endAt!==deadline) return false;
    $('btnCueLoad').click(); $('btnCueConfirm').click();
    return currentCue===2&&!S.running&&S.remMs===180000;`);
  await check('RUNDOWN_EDIT_LIVE_SAFE_OK', `
    $('btnRundownStart').click(); const deadline=S.endAt,duration=S.durationMs;
    selectedCue=cues[currentCue]; editSelectedCue();
    $('cueName').value='Questions updated'; $('cueNote').value='New note'; cueDraftMs=240000; addCue();
    return S.running&&S.endAt===deadline&&S.durationMs===duration&&cues[currentCue].durationMs===240000&&
      cues[currentCue].name==='Questions updated'&&cues[currentCue].note==='New note'&&editingCue===null;`);
  await check('RUNDOWN_DELETE_UNDO_IDENTITY_OK', `
    const active=cues[currentCue],deadline=S.endAt;
    selectedCue=active; renderCues(); if(!$('btnCueDelete').disabled) return false;
    deleteSelectedCue(); if(cues.length!==3) return false;
    selectedCue=cues[0]; renderCues(); $('btnCueDelete').click();
    if(cues[currentCue]!==active||S.endAt!==deadline||cues.length!==2) return false;
    $('btnCueUndo').click();
    return cues.length===3&&cues[currentCue]===active&&S.endAt===deadline&&!removedCue;`);
  await check('RUNDOWN_DUPLICATE_MOVE_OK', `
    const active=cues[currentCue],deadline=S.endAt;
    selectedCue=cues[0]; duplicateSelectedCue(); const copy=selectedCue;
    if(copy===cues[0]||copy.durationMs!==cues[0].durationMs||copy.color!==cues[0].color) return false;
    moveCue(cues.indexOf(copy),1);
    return cues.length===4&&selectedCue===copy&&cues[currentCue]===active&&S.endAt===deadline;`);
  await check('RUNDOWN_STALE_CONFIRMATION_OK', `
    selectedCue=cues[0]; requestCueLoad(selectedCue,true); go();
    // Force another active item, as a phone/Companion command may do while confirmation is open.
    loadCue(1,true); const deadline=S.endAt;
    $('btnCueConfirm').click();
    return currentCue===1&&S.endAt===deadline&&$('cueConfirm').hidden&&$('cueFeedbackText').textContent===t('cueActionChanged');`);
  await check('RUNDOWN_RESET_NEXT_PREVIOUS_OK', `
    $('btnCueReset').click(); $('btnCueConfirm').click();
    if(S.running||S.remMs!==cues[1].durationMs) return false;
    $('btnGo').click(); if(currentCue!==2||!S.running) return false;
    $('btnCuePrevious').click(); $('btnCueConfirm').click();
    return currentCue===1&&S.running;`);
  await check('RUNDOWN_PLAN_CONTROLS_OK', `
    $('btnPlanNow').click(); if(S.showStart!==clock(Date.now())||$('showStartInput').value!==S.showStart) return false;
    $('btnPlanClear').click(); return S.showStart===''&&$('cuePlannedEnd').textContent==='—';`);
  await check('RUNDOWN_AUTO_ADVANCE_OK', `
    cancelAutoAdvance();cues=[{name:'First',durationMs:1000},{name:'Second',durationMs:60000}];
    currentCue=-1;selectedCue=null;autoNext=true;loadCue(0,true);S.endAt=Date.now()-10;send();
    await new Promise(r=>setTimeout(r,1100));
    const advanced=currentCue===1&&S.running&&S.durationMs===60000;
    autoNext=false;cancelAutoAdvance();reset();return advanced;`);
  await check('RUNDOWN_EMPTY_INVALID_DURATION_OK', `
    cues=[];currentCue=-1;selectedCue=null;renderCues();
    if(!$('btnRundownStart').disabled||!$('btnGo').disabled||!$('btnRundownRestart').disabled)return false;
    const old=cueDraftMs;cueDraftMs=0;addCue();cueDraftMs=old;
    return cues.length===0&&$('cueFeedbackText').textContent===t('cueInvalid');`);
  await js(`reset(); currentCue=-1; selectedCue=null; cancelCueEdit(); removedCue=null; $('cueFeedback').hidden=true;
    cues=Array.from({length:20},(_,i)=>({name:'Conference item '+(i+1)+' — clear title',durationMs:60000,note:i%2?'Speaker and microphone note':'',color:'#4493f8'}));
    $('cueEditor').open=false; renderCues();`);
  await check('RUNDOWN_SCROLL_SELECTION_OK', `
    const list=$('cueList'); list.scrollTop=list.scrollHeight;
    const before=list.scrollTop; document.querySelectorAll('.cue-select')[19].click();
    const rows=[...list.querySelectorAll('.cue')],heights=rows.map(r=>r.getBoundingClientRect().height);
    return rows.length===20&&Math.min(...heights)>=90&&Math.max(...heights)-Math.min(...heights)<1&&
      list.scrollHeight>list.clientHeight&&Math.abs(list.scrollTop-before)<2;`);
  controlWin.focus(); controlWin.webContents.focus();
  await js(`document.querySelectorAll('.cue-select')[18].focus();`);
  controlWin.webContents.sendInputEvent({ type:'keyDown', keyCode:'Enter' });
  controlWin.webContents.sendInputEvent({ type:'char', keyCode:'\r' });
  controlWin.webContents.sendInputEvent({ type:'keyUp', keyCode:'Enter' });
  await new Promise(resolve=>setTimeout(resolve,150));
  const keyboard=await js('({selected:cues.indexOf(selectedCue),current:currentCue,running:S.running,focus:document.activeElement?.className})');
  assert.equal(keyboard.selected===18&&keyboard.current===-1&&!keyboard.running,true,JSON.stringify(keyboard));
  console.log('RUNDOWN_KEYBOARD_SELECTION_OK=true');
  await js(`$('rundownSchedule').open=false;$('rundownSchedule').querySelector('summary').focus();`);
  controlWin.webContents.sendInputEvent({type:'keyDown',keyCode:'Space'});
  controlWin.webContents.sendInputEvent({type:'char',keyCode:' '});
  controlWin.webContents.sendInputEvent({type:'keyUp',keyCode:'Space'});
  await new Promise(resolve=>setTimeout(resolve,100));
  await check('RUNDOWN_DISCLOSURE_KEYBOARD_SAFE_OK', `return $('rundownSchedule').open&&!S.running;`);
  await check('MODIFIED_SHORTCUTS_SAFE_OK', `
    S.message={text:'Keep this message',flash:false};
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true}));
    document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'c',metaKey:true,bubbles:true}));
    const safe=S.message.text==='Keep this message';S.message={text:'',flash:false};return safe;`);
  const bounds=controlWin.getBounds();
  for(const width of [820,1120]){
    controlWin.setSize(width,900);
    for(const language of ['sr','en']){
      await js(`lang='${language}'; applyLang(); $('cueEditor').open=true;`);
      await new Promise(resolve=>setTimeout(resolve,250));
      await check('RUNDOWN_REFLOW_'+width+'_'+language.toUpperCase()+'_OK', `
        const card=document.querySelector('.cuewrap'),b=card.getBoundingClientRect();
        const children=[...card.querySelectorAll('button,input,summary')].filter(el=>el.getClientRects().length);
        return card.scrollWidth<=card.clientWidth+1&&children.every(el=>{
          const r=el.getBoundingClientRect(); return r.left>=b.left-1&&r.right<=b.right+1;
        });`);
    }
  }
  controlWin.setBounds(bounds);
  await js(`lang='sr'; applyLang(); selectedCue=null; currentCue=-1; $('cueEditor').open=false; renderCues(); saveCues(); send();`);
  fs.writeFileSync(path.join(os.tmpdir(),'protimer-rundown-review.png'),(await controlWin.webContents.capturePage()).toPNG());
  await js('location.reload()');
  await new Promise(resolve=>setTimeout(resolve,600));
  await check('RUNDOWN_RESTORE_SAFE_OK', 'return cues.length===20&&currentCue===-1&&!S.running&&selectedCue===null&&!rundownHasRun;');
};
