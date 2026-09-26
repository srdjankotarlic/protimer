(function (root) {
  'use strict';
  root.ProTimerDeckController = async function (host, api) {
    if (!api.deckInvoke) return null;
    let settings = await api.deckInvoke('status'), ui, model, lastPersisted = '', sequence = 0, globalDialog = false,lastLanguage=host.language();
    const audio = host.audio || root.ProTimerDeckAudio(api,host.notice);
    const context = { sourceId: 'control', sessionId: 'local', connected: true };
    function frame() {
      if (!model) return;
      const value = model.snapshot();
      for (const id of ['t1', 't2']) {
        const active = value.timers[id].active;
        active.text = active.mode === 'clock' ? new Date().toLocaleTimeString('en-GB', { hour12: false }) : root.DeckModel.formatTime(active.mode === 'countup' ? active.elapsedMs : active.remainingMs);
        active.color = host.color(id);
      }
      value.blackout = host.blackout();
      api.deckFrame(value); ui?.update({ ...settings, ...value });
      if(lastLanguage!==host.language()){lastLanguage=host.language();ui?.setLanguage(lastLanguage);}
      return value;
    }
    model = root.DeckModel.create({ readActive: host.readActive, persisted: settings.drafts,
      now: () => Date.now(), guardNow: () => performance.now(), readRundown: host.readRundown,
      applyOperation: async operation => {
        if (operation.type === 'bell') return audio.play(settings.audio);
        if (operation.type === 'settings') { ui.openSettings(); return { ok: true }; }
        if (operation.type === 'back') return api.deckInvoke('back');
        return host.applyOperation(operation);
      }, onChange: (_state, persisted) => {
        const json = JSON.stringify(persisted); if (json !== lastPersisted) { lastPersisted = json; api.deckDrafts(persisted); }
        frame();
      }
    });
    function pin(command) {
      const state = model.snapshot(), timerId = command.timerId === 't2' ? 't2' : command.timerId === 't1' ? 't1' : state.selectedTimerId;
      const value = { ...command, commandId: command.commandId || crypto.randomUUID(), timerId, sequence: ++sequence };
      if (value.type === 'startSet') { value.expectedActiveVersion ??= state.timers[timerId].active.version; value.expectedDraftVersion ??= state.timers[timerId].draft.version; }
      return value;
    }
    function fromKey(key) {
      const state = model.snapshot(), timerId = key.timerId === 'selected' ? state.selectedTimerId : key.timerId;
      const command = { type: key.command, timerId, commandId: crypto.randomUUID(), payload: {} };
      if (key.command === 'adjust') command.payload = { step: key.step, unit: key.unit, target: key.target === 'selected' ? state.editTarget : key.target };
      if (key.command === 'preset') command.payload = { durationMs: key.durationMs };
      return pin(command);
    }
    async function execute(command, source = context) { const result = await model.confirmTwice(pin(command), source); frame(); return result; }
    async function invoke(action, payload) {
      if (action === 'command') return execute(payload);
      if (action === 'audioList') {const value=await audio.outputs();return {...value,outputs:value.devices};}
      if (action === 'audioTest') return audio.play(settings.audio);
      const result = await api.deckInvoke(action, payload);
      settings = await api.deckInvoke('status'); frame(); return result;
    }
    ui = root.ProTimerDeckUI.mount(host.element, { lang: host.language(), invoke, snapshot: { ...settings, ...model.snapshot() } });
    api.onDeckStatus(value => { settings = value; frame(); });
    api.onDeckRequest(async request => {
      let result;
      try {
        if (request.action === 'disconnect') { model.disconnect(request.context || context); result = { ok: true }; }
        else if (Date.now() > request.expiresAt) result = { ok: false, error: 'COMMAND_EXPIRED' };
        else {
          const payload = request.payload || {}, source = { ...(request.context || context), guardDeadline: performance.now()+Math.max(0,Math.min(3500,request.expiresAt-Date.now())) };
          if (request.action === 'command') { const { deviceId, ...command } = payload; result = await model.dispatch(command, source); }
          else if (request.action === 'press') result = model.beginPress(payload.command, source);
          else if (request.action === 'release') result = model.cancelPress(payload.pressId, source);
          else if (request.action === 'disconnect' || request.action === 'resetEditTarget') { model.disconnect(source); result = { ok: true }; }
          else if (request.action === 'hotkey') {
            const key = settings.layout.slots.find(k => k?.id === payload.keyId);
            if(document.querySelector('.pt-deck-dialog[open]'))result={ok:false,error:'EDITOR_OPEN'};
            else if (!key) result={ok:false,error:'HOTKEY_REMOVED'};
            else if (globalDialog) result={ok:false,error:'CONFIRMATION_OPEN'};
            else if(payload.global){
              globalDialog=true;
              try{
                const pinned=fromKey(key);pinned.expectedActiveVersion=model.snapshot().timers[pinned.timerId].active.version;
                const answer=await api.deckInvoke('confirmGlobalCommand',{keyId:key.id,timerId:pinned.timerId});
                if(!answer.ok)result={ok:false,error:'CANCELLED'};
                else{
                  const confirmedSource={...source,guardDeadline:performance.now()+3500};
                  result=await model.confirmTwice(pinned,confirmedSource);
                  if(result.code==='CONFIRM_REQUIRED')result=await model.confirmTwice(pinned,confirmedSource);
                }
              }finally{globalDialog=false;}
            }else result=await model.confirmTwice(fromKey(key),source);
            if (result.code === 'CONFIRM_REQUIRED') host.notice(result.message);
          }
        }
      } catch (_) { result = { ok: false, error: 'COMMAND_FAILED' }; }
      frame(); api.deckReply({ id: request.id, result: result || { ok: false, error: 'UNKNOWN_REQUEST' } });
    });
    // Preserve built-in local shortcuts. Custom shortcuts only win if explicitly
    // configured and never fire while editing text. Global OS hooks live in main.
    document.addEventListener('keydown', async event => {
      if(document.querySelector('.pt-deck-dialog[open]'))return;
      if (event.repeat || event.isComposing || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      let hotkey;
      try { hotkey = root.DeckLayout.normalizeHotkey([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', event.key === ' ' ? 'Space' : event.key].filter(Boolean).join('+')); } catch (_) { return; }
      const key = settings.layout.slots.find(k => k?.hotkey === hotkey); if (!key) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const result = await model.confirmTwice(fromKey(key), { sourceId: 'local-hotkey', sessionId: 'local', connected: true });
      if (!result.ok) host.notice(result.message || result.error); frame();
    }, true);
    frame(); const interval = setInterval(frame, 250);
    return { model, ui, frame, execute, fromKey, playBell: () => audio.play(settings.audio), observe: () => model.observe(), prepared: id => model.prepared(id), dispose: () => { clearInterval(interval); ui.destroy(); } };
  };
})(window);
