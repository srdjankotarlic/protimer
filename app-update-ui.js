(function(root){
  const copy={
    sr:{
      checking:'Proveravam GitHub…',current:'ProTimer je ažuriran.',available:'Dostupan je ProTimer {version}.',
      downloading:'Preuzimanje ažuriranja…',ready:'Paket je preuzet i SHA‑256 je proveren.',
      download:'Preuzmi ažuriranje',open:'Otvori instalaciju',portable:'Prikaži novi EXE',cancel:'Otkaži preuzimanje',
      macHelp:'Zatvori ProTimer pa iz DMG-a prevuci novu aplikaciju na isto mesto i izaberi Replace.',
      setupHelp:'U Windows Setup-u potvrdi nadogradnju u istom folderu. Podešavanja i rundown se čuvaju.',
      portableHelp:'Zatvori ProTimer i zameni stari prenosivi EXE novim fajlom.',
      CHECK_FAILED:'GitHub trenutno nije dostupan. Pokušaj ponovo.',
      RELEASE_UNAVAILABLE:'GitHub nije vratio stabilno izdanje. Pokušaj kasnije.',
      PACKAGE_UNAVAILABLE:'Provereni paket za ovu platformu još nije dostupan.',
      RATE_LIMIT:'GitHub je privremeno ograničio provere. Pokušaj kasnije.',
      SHOW_ACTIVE:'Pre otvaranja instalacije zaustavi tajmere, zatvori izlaze i isključi online deljenje.',
      INTEGRITY_FAILED:'SHA‑256 ili veličina paketa se ne podudara. Ponovo preuzmi paket.',
      OPEN_FAILED:'Sistem nije mogao da otvori paket. Pokušaj ponovo.',
      DOWNLOAD_FAILED:'Preuzimanje nije završeno. Proveri vezu i pokušaj ponovo.',
      CHECK_FIRST:'Prvo proveri novu verziju.',
      CANCELED:'Preuzimanje je otkazano.',
      installed:'Trenutna verzija {version}',unsupported:'Ažuriranje iz aplikacije nije dostupno za ovu kopiju.'
    },
    en:{
      checking:'Checking GitHub…',current:'ProTimer is up to date.',available:'ProTimer {version} is available.',
      downloading:'Downloading update…',ready:'Download complete. SHA‑256 verified.',
      download:'Download update',open:'Open installer',portable:'Show new EXE',cancel:'Cancel download',
      macHelp:'Quit ProTimer, then drag the app from the DMG to its current location and choose Replace.',
      setupHelp:'Confirm the upgrade in Windows Setup and keep the installation folder. Your settings and rundown are kept.',
      portableHelp:'Quit ProTimer and replace the old portable EXE with the new file.',
      CHECK_FAILED:'GitHub is unavailable. Try again.',
      RELEASE_UNAVAILABLE:'GitHub did not return a stable release. Try again later.',
      PACKAGE_UNAVAILABLE:'A verified package for this platform is not available yet.',
      RATE_LIMIT:'GitHub temporarily limited update checks. Try again later.',
      SHOW_ACTIVE:'Stop the timers, close audience outputs and turn off online sharing before opening the installer.',
      INTEGRITY_FAILED:'The file size or SHA‑256 did not match. Download the package again.',
      OPEN_FAILED:'The system could not open the package. Try again.',
      DOWNLOAD_FAILED:'The download did not finish. Check your connection and try again.',
      CHECK_FIRST:'Check for a new version first.',
      CANCELED:'Download canceled.',
      installed:'Current version {version}',unsupported:'In-app updates are unavailable for this copy.'
    }
  };
  root.createUpdateUI=function({api,language}){
    const get=id=>document.getElementById(id);
    const launch=get('btnCheckUpdates'),dialog=get('appUpdateDialog'),action=get('appUpdateAction');
    const cancel=get('appUpdateCancel'),recheck=get('appUpdateRecheck'),meter=get('appUpdateProgress');
    let state={},busy='',message='',instructions=false;
    const label=(key,version='')=>(copy[language()]||copy.sr)[key]?.replace('{version}',version)||'';
    function render(){
      get('appCurrentVersion').textContent=state.current?`v${state.current}`:'';
      if(state.type)launch.hidden=false;
      get('appUpdateInstalled').textContent=state.current?label('installed',state.current):'';
      get('appUpdateStatus').textContent=label(message,state.latest);
      get('appUpdateHelp').textContent=instructions?label({mac:'macHelp',setup:'setupHelp',portable:'portableHelp'}[state.type]):'';
      action.hidden=!state.latest||!!busy;
      action.textContent=label(state.ready?(state.type==='portable'?'portable':'open'):'download');
      meter.hidden=busy!=='download';
      cancel.hidden=busy!=='download';
      cancel.textContent=label('cancel');
      recheck.disabled=!!busy;
    }
    async function send(kind){
      if(busy)return;
      busy=kind; instructions=false; meter.value=0;
      message={check:'checking',download:'downloading',open:'ready'}[kind];
      render();
      try{
        const result=await api.appUpdate(kind);
        state={...state,...result};
        message=result.ok?(state.ready?'ready':state.latest?'available':'current')
          :(label(result.code)?result.code:kind==='download'?'DOWNLOAD_FAILED':'CHECK_FAILED');
        instructions=state.ready&&result.ok;
      }catch(_){ message=kind==='download'?'DOWNLOAD_FAILED':'CHECK_FAILED'; }
      finally{busy='';render();}
    }
    launch.addEventListener('click',()=>{
      if(!dialog.open)dialog.showModal();
      if(!state.ready&&!busy)void send('check');
    });
    recheck.addEventListener('click',()=>send('check'));
    action.addEventListener('click',()=>send(state.ready?'open':'download'));
    cancel.addEventListener('click',()=>api.appUpdate('cancel').catch(()=>{}));
    get('appUpdateClose').addEventListener('click',()=>dialog.close());
    api.onAppUpdateProgress(value=>{if(busy==='download')meter.value=value;});
    api.appUpdate('status').then(next=>{state=next;render();}).catch(()=>{});
    return {render};
  };
})(globalThis);
