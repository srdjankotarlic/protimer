(function(root){
  const copy={
    sr:{
      display:'Ekran',view:'Prikaz',background:'Pozadina',presentation:'Režim',
      none:'Bez dodele',t1:'Tajmer 1',t2:'Tajmer 2',both:'Tajmeri 1 + 2',t3:'Tajmer 3',t13:'Tajmeri 1 + 3',t23:'Tajmeri 2 + 3',all:'Sva tri tajmera',standard:'Standardna',
      luma:'Luma · crna',green:'Chroma · zelena',blue:'Chroma · plava',
      split:'Podela',inherit:'Kao u kontroli',columns:'Levo / desno',rows:'Gore / dole',
      fullscreen:'Pun ekran',window:'Prozor / Grid',send:'Pošalji',close:'Zatvori',
      control:'Kontrola',live:'Prikazuje',pending:'Izmene čekaju slanje',success:'Prikaz poslat',
      busy:'Postavljanje izlaza…',noDisplays:'Nema dostupnih ekrana.',
      disconnected:'Ekran nije povezan. Proveri izlaz u sistemskim podešavanjima.',
      legacy:'Na ovom ekranu je otvoren običan izlaz. Zatvori ga pre slanja.',
      TIMER_DISABLED:'Uključi sve tajmere iz izabrane kombinacije.',NO_ROUTES:'Dodeli prikaz bar jednom ekranu.',
      OUTPUT_BUSY:'Slanje je u toku.',OUTPUT_NOT_APPLIED:'Izlaz nije otvoren. Proveri povezane ekrane i probaj ponovo.',
      FORGOTTEN:'Ukloni dodelu'
    },
    en:{
      display:'Display',view:'Show',background:'Background',presentation:'Mode',
      none:'Unassigned',t1:'Timer 1',t2:'Timer 2',both:'Timers 1 + 2',t3:'Timer 3',t13:'Timers 1 + 3',t23:'Timers 2 + 3',all:'All three timers',standard:'Standard',
      luma:'Luma · black',green:'Chroma · green',blue:'Chroma · blue',
      split:'Split',inherit:'Use Control setting',columns:'Side by side',rows:'Stacked',
      fullscreen:'Fullscreen',window:'Window / Grid',send:'Send',close:'Close',
      control:'Control',live:'Showing',pending:'Changes ready to send',success:'Output sent',
      busy:'Setting up outputs…',noDisplays:'No displays detected.',
      disconnected:'Display disconnected. Check your system display settings.',
      legacy:'A standard output is open here. Close it before sending.',
      TIMER_DISABLED:'Enable each timer in this selection.',NO_ROUTES:'Assign at least one display.',
      OUTPUT_BUSY:'Outputs are being sent.',OUTPUT_NOT_APPLIED:'Could not open the output. Check connected displays and retry.',
      FORGOTTEN:'Remove assignment'
    }
  };
  root.createAudienceRouting=function({host,api,language,timerState,screenList}){
    const routes=new Map();
    let busy=false,list=[],lastKey='';
    const rows=host.querySelector('tbody');
    const feedback=host.querySelector('[role="status"]');
    const sendAll=host.querySelector('#routeSendAll'),closeAll=host.querySelector('#routeCloseAll');
    const captions=host.querySelectorAll('thead th');
    const text=key=>(copy[language()]||copy.sr)[key];
    const available=view=>AudienceRoutes.available(timerState(),view);
    const sendable=()=>[...routes.values()].filter(route=>available(route.view));
    function save(){
      localStorage.setItem('pt_routes',JSON.stringify({version:1,routes:[...routes.values()]}));
    }
    try{
      const saved=JSON.parse(localStorage.getItem('pt_routes')||'null');
      if(saved?.version===1&&Array.isArray(saved.routes)){
        for(const value of saved.routes.slice(0,64)){
          const route=AudienceRoutes.assignment(value);
          if(route) routes.set(route.displayId,route);
        }
      }
    }catch(_){}
    function status(message){ feedback.textContent=message; }
    function resultText(result){
      const aliases={DISPLAY_NOT_CONNECTED:'disconnected',STANDARD_OUTPUT_OPEN:'legacy'};
      return [result.label,text(aliases[result.code]||result.code)||text('OUTPUT_NOT_APPLIED')].filter(Boolean).join(' · ');
    }
    async function apply(assignments){
      if(busy)return {ok:false,code:'OUTPUT_BUSY',message:text('OUTPUT_BUSY')};
      busy=true; status(text('busy')); update();
      try{
        const result=await api.applyRoutedOutputs(assignments);
        if(result.ok){
          status(text('success'));
          return result;
        }
        const message=resultText(result); status(message);
        return {...result,message};
      }catch(_){
        const message=text('OUTPUT_NOT_APPLIED'); status(message);
        return {ok:false,code:'OUTPUT_NOT_APPLIED',message};
      }finally{
        busy=false; update();
      }
    }
    function cell(row){ return row.insertCell(); }
    function button(label,clicked,disabled){
      const b=document.createElement('button'); b.type='button'; b.textContent=label;
      b.disabled=disabled; b.addEventListener('click',clicked); return b;
    }
    function select(label,labelDisplay,options,value,disabled,change){
      const sel=document.createElement('select'); sel.setAttribute('aria-label',label+' · '+labelDisplay);
      for(const id of options){
        const option=new Option(text(id),id);
        option.disabled=AudienceRoutes.views.includes(id)&&!available(id);
        option.hidden=option.disabled&&id!==value;
        sel.add(option);
      }
      sel.value=value; sel.disabled=disabled;
      sel.addEventListener('change',()=>change(sel.value,sel));
      return sel;
    }
    function update(force=false,focus){
      list=screenList()||[];
      const key=JSON.stringify([language(),timerState().dualTimer,timerState().thirdTimer,busy,list.map(d=>[d.id,d.label,d.width,d.height,d.hasControl,d.hasOutput,d.hasSecondaryOutput,d.routedOutput]),[...routes.values()]]);
      if(!force&&key===lastKey) return;
      lastKey=key;
      const shown=list.map(d=>({id:d.id,label:d.label,display:d,live:d.routedOutput}));
      for(const route of routes.values())
        if(!AudienceRoutes.displayFor(route,list)) shown.push({id:route.displayId,label:route.label,display:null,live:null});
      rows.replaceChildren();
      ['display','view','background','presentation'].forEach((id,i)=>{ captions[i].textContent=text(id); });
      for(const {id,label,display,live} of shown){
        const row=rows.insertRow();
        const stored=routes.get(id);
        const cfg=(stored?.label===label?stored:null)||{displayId:id,label,view:'none',background:'standard',presentation:'fullscreen'};
        const assigned=cfg.view!=='none';
        const legacy=display&&(display.hasOutput||display.hasSecondaryOutput);
        const canSend=assigned&&!!display&&!legacy&&available(cfg.view);
        const name=cell(row);
        name.textContent=display?`${label} · ${display.width}×${display.height}${display.hasControl?' · '+text('control'):''}`:label;
        if(!display||legacy||live||assigned&&!available(cfg.view)){
          const detail=document.createElement('small');
          detail.textContent=!display?text('disconnected'):legacy?text('legacy'):
            (live?`${text('live')} ${text(live.view)}${JSON.stringify(live)!==JSON.stringify(cfg)?' · '+text('pending'):''}`:'');
          if(display&&assigned&&!available(cfg.view)) detail.textContent=text('TIMER_DISABLED');
          name.append(detail);
        }
        function field(key,options,target=cell(row)){
          const control=select(text(key),label,options,cfg[key]??'inherit',busy||!display||(!assigned&&key!=='view'),(value)=>{
            if(key==='view'&&value==='none') routes.delete(id);
            else {
              const next={...cfg,[key]:value};
              if(key==='split'&&value==='inherit') delete next.split;
              routes.set(id,next);
            }
            save(); update(true,{id,label,key});
          });
          target.append(control);
          if(focus?.id===id&&focus.label===label&&focus.key===key)control.focus();
        }
        const viewCell=cell(row);
        field('view',['none',...AudienceRoutes.views],viewCell);
        if(['both','t13','t23','all'].includes(cfg.view)) field('split',['inherit','columns','rows'],viewCell);
        field('background',Object.keys(AudienceRoutes.backgrounds));
        field('presentation',['fullscreen','window']);
        const action=cell(row);
        if(display){
          action.append(button(text('send'),()=>apply([cfg]),!canSend||busy));
          if(live)action.append(button(text('close'),()=>api.closeRoutedOutputs(id),busy));
        }else action.append(button(text('FORGOTTEN'),()=>{ routes.delete(id);save();update(); },busy));
      }
      if(!shown.length){ const empty=rows.insertRow().insertCell();empty.colSpan=5;empty.textContent=text('noDisplays'); }
      sendAll.disabled=busy||!sendable().length;
      closeAll.disabled=busy||!list.some(display=>display.routedOutput);
    }
    sendAll.addEventListener('click',()=>apply(sendable()));
    closeAll.addEventListener('click',()=>api.closeRoutedOutputs());
    return {update};
  };
})(globalThis);
