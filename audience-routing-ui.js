(function(root){
  const copy={
    sr:{
      display:'Ekran',view:'Prikaz',background:'Pozadina',presentation:'Režim',
      none:'Bez dodele',t1:'Tajmer 1',t2:'Tajmer 2',both:'Oba tajmera',standard:'Standardna',
      luma:'Luma · crna',green:'Chroma · zelena',blue:'Chroma · plava',
      fullscreen:'Pun ekran',window:'Prozor / Grid',send:'Pošalji',close:'Zatvori',
      control:'Kontrola',live:'Prikazuje',pending:'Izmene čekaju slanje',success:'Prikaz poslat',
      busy:'Postavljanje izlaza…',noDisplays:'Nema dostupnih ekrana.',
      disconnected:'Ekran nije povezan. Proveri izlaz u sistemskim podešavanjima.',
      legacy:'Na ovom ekranu je otvoren običan izlaz. Zatvori ga pre slanja.',
      TIMER_DISABLED:'Prvo uključi Tajmer 2.',NO_ROUTES:'Dodeli prikaz bar jednom ekranu.',
      OUTPUT_BUSY:'Slanje je u toku.',OUTPUT_NOT_APPLIED:'Izlaz nije otvoren. Proveri povezane ekrane i probaj ponovo.',
      FORGOTTEN:'Ukloni dodelu'
    },
    en:{
      display:'Display',view:'Show',background:'Background',presentation:'Mode',
      none:'Unassigned',t1:'Timer 1',t2:'Timer 2',both:'Both timers',standard:'Standard',
      luma:'Luma · black',green:'Chroma · green',blue:'Chroma · blue',
      fullscreen:'Fullscreen',window:'Window / Grid',send:'Send',close:'Close',
      control:'Control',live:'Showing',pending:'Changes ready to send',success:'Output sent',
      busy:'Setting up outputs…',noDisplays:'No displays detected.',
      disconnected:'Display disconnected. Check your system display settings.',
      legacy:'A standard output is open here. Close it before sending.',
      TIMER_DISABLED:'Enable Timer 2 first.',NO_ROUTES:'Assign at least one display.',
      OUTPUT_BUSY:'Outputs are being sent.',OUTPUT_NOT_APPLIED:'Could not open the output. Check connected displays and retry.',
      FORGOTTEN:'Remove assignment'
    }
  };
  root.createAudienceRouting=function({host,api,language,dualEnabled,screenList}){
    const routes=new Map();
    let busy=false,list=[],lastKey='';
    const rows=host.querySelector('tbody');
    const feedback=host.querySelector('[role="status"]');
    const sendAll=host.querySelector('#routeSendAll'),closeAll=host.querySelector('#routeCloseAll');
    const captions=host.querySelectorAll('thead th');
    const text=key=>(copy[language()]||copy.sr)[key];
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
        option.disabled=!dualEnabled()&&['t2','both'].includes(id);
        sel.add(option);
      }
      sel.value=value; sel.disabled=disabled;
      sel.addEventListener('change',()=>change(sel.value,sel));
      return sel;
    }
    function update(force=false,focus){
      list=screenList()||[];
      const key=JSON.stringify([language(),dualEnabled(),busy,list.map(d=>[d.id,d.label,d.width,d.height,d.hasControl,d.hasOutput,d.hasSecondaryOutput,d.routedOutput]),[...routes.values()]]);
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
        const canSend=assigned&&!!display&&!legacy&&(cfg.view==='t1'||dualEnabled());
        const name=cell(row);
        name.textContent=display?`${label} · ${display.width}×${display.height}${display.hasControl?' · '+text('control'):''}`:label;
        if(!display||legacy||live){
          const detail=document.createElement('small');
          detail.textContent=!display?text('disconnected'):legacy?text('legacy'):
            `${text('live')} ${text(live.view)}${JSON.stringify(live)!==JSON.stringify(cfg)?' · '+text('pending'):''}`;
          name.append(detail);
        }
        function field(key,options){
          const control=select(text(key),label,options,cfg[key],busy||!display||(!assigned&&key!=='view'),(value)=>{
            if(key==='view'&&value==='none') routes.delete(id);
            else routes.set(id,{...cfg,[key]:value});
            save(); update(true,{id,label,key});
          });
          cell(row).append(control);
          if(focus?.id===id&&focus.label===label&&focus.key===key)control.focus();
        }
        field('view',['none',...AudienceRoutes.views]);
        field('background',Object.keys(AudienceRoutes.backgrounds));
        field('presentation',['fullscreen','window']);
        const action=cell(row);
        if(display){
          action.append(button(text('send'),()=>apply([cfg]),!canSend||busy));
          if(live)action.append(button(text('close'),()=>api.closeRoutedOutputs(id),busy));
        }else action.append(button(text('FORGOTTEN'),()=>{ routes.delete(id);save();update(); },busy));
      }
      if(!shown.length){ const empty=rows.insertRow().insertCell();empty.colSpan=5;empty.textContent=text('noDisplays'); }
      sendAll.disabled=busy||!routes.size;
      closeAll.disabled=busy||!list.some(display=>display.routedOutput);
    }
    sendAll.addEventListener('click',()=>apply([...routes.values()]));
    closeAll.addEventListener('click',()=>api.closeRoutedOutputs());
    return {update};
  };
})(globalThis);
