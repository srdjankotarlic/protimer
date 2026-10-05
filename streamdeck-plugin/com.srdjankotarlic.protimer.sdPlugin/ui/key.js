/* Official Property Inspector websocket protocol; this never executes actions. */
'use strict';

const $ = id => document.getElementById(id);
const timerCommands = new Set([
  'startPause', 'start', 'pause', 'resume', 'startSet', 'loadSet', 'activeTime', 'setTime',
  'reset', 'bell', 'adjust', 'preset', 'enterTime', 'countdown', 'countup',
  'clock', 'clearSet', 'loadSelected', 'fullscreen', 'selectTimer'
]);
const dynamicColors = new Set(['startPause', 'activeTime', 'setTime', 'adjust', 'editTarget', 'blackout', 'outputA', 'outputB']);
const noPress = new Set(['activeTime', 'setTime', 'empty', 'back']);
const explanations = {
  empty: 'Inactive ProTimer key. To free this physical position, remove the ProTimer action in Elgato.',
  startPause: 'Start, pause or resume ACTIVE. Prepared SET time is started with START SET.',
  startSet: 'One tap starts SET as ACTIVE, replacing any running or paused time immediately.',
  loadSet:'Copy READY/SET into ACTIVE without starting. Pause a running ACTIVE first. SET is kept.',
  liveT1:'Send Timer 1 to its selected display and restore the picture. Uses the LIVE fullscreen/window setting in Control. Neither clock is changed.',
  liveT2:'Send Timer 2 to the selected display and restore the picture. Requires Timer 2 enabled. Uses Control routing and LIVE fullscreen/window settings.',
  liveBoth:'Send both timers using the split or separate displays selected in Control. Restores the picture without starting or resetting either timer.',
  activeTime: 'Read-only display of the currently running ACTIVE time.',
  setTime: 'Read-only display of the time prepared in SET.',
  editTarget: 'One tap switches adjustments between SET and LIVE. LIVE changes the running time.',
  reset: 'One tap stops and resets ACTIVE to its last started duration. SET is kept.',
  bell: 'Ring the bell once.',
  adjust: 'Use a negative amount to subtract time. SET prepares the next run; LIVE changes ACTIVE.',
  preset: 'Load this duration into SET only. Use START SET when ready to run it.',
  enterTime: 'Open numeric time entry on the Deck. At least 20 visible ProTimer keys are needed.',
  countdown: 'Prepare countdown mode in SET. Use START SET to apply it.',
  countup: 'Prepare count-up mode in SET. Use START SET to apply it.',
  clock: 'Prepare clock mode in SET. Use START SET to apply it.',
  clearSet: 'Clear the prepared SET time without resetting ACTIVE.',
  blackout: 'One tap blacks out the output; another restores it. The timer keeps running.',
  blackoutOn: 'One tap makes the outputs black. Repeated taps keep them black; the timer keeps running.',
  blackoutOff: 'One tap restores the audience picture. Repeated taps keep it visible; the timer keeps running.',
  outputA: 'Toggle output A.',
  outputB: 'Toggle output B.',
  selectTimer: 'Switch the selected timer between Timer 1 and Timer 2; editing returns to SET.',
  message: 'Open the message editor in Control. This key does not send a message.',
  settings: 'Open settings in Control.',
  back: 'Return to a previous profile only after plugin profile activation. For a manually created profile, use Elgato Switch Profile on a FREE key.',
  prev: 'Select the previous rundown item.',
  next: 'Select the next rundown item.',
  loadSelected: 'Load the selected rundown item into SET without starting ACTIVE.',
  fullscreen: 'Toggle fullscreen of the existing output for this timer. Does not reset its time.'
};

for (const command of DeckLayout.catalog) {
  const option = document.createElement('option');
  option.value = command.id;
  option.textContent = command.label;
  $('command').append(option);
}
for (const icon of DeckLayout.icons) {
  const option=document.createElement('option'); option.value=icon;
  option.textContent=icon==='none'?'Automatic function icon':icon;
  $('icon').append(option);
}

let socket, context, settings = {};

function updateFields() {
  const linked = $('linked').checked;
  const command = $('command').value;
  const target = $('target').value;
  $('linkedHelp').hidden = !linked;
  $('editHere').hidden = !linked;
  $('linkFields').hidden = !linked;
  $('keyFields').hidden = linked;
  $('timerField').hidden = !timerCommands.has(command);
  $('targetField').hidden = command !== 'adjust';
  $('adjustFields').hidden = command !== 'adjust';
  $('durationField').hidden = command !== 'preset';
  $('outputField').hidden = !['outputA','outputB'].includes(command);
  $('step').disabled = linked || command !== 'adjust';
  $('duration').disabled = linked || command !== 'preset';
  $('nameField').hidden = command === 'empty';
  $('nameHint').hidden = command === 'empty';
  $('colorField').hidden = ['activeTime','setTime','adjust'].includes(command) || command === 'empty';
  $('textSizeField').hidden = command === 'empty';
  $('pressPolicyField').hidden = true;
  $('commandHelp').textContent = explanations[command] || DeckLayout.catalog.find(item => item.id === command)?.label || '';

  $('pressPolicy').value = 'short';
  $('pressPolicy').disabled = true;
  let notice = '';
  if (['reset','blackout','blackoutOn','blackoutOff','startSet'].includes(command)) notice = 'One tap · immediate action, including replacement of running time. / Jedan dodir · odmah, bez držanja.';
  else if (command === 'editTarget'||command==='adjust'&&target==='live') notice = 'One tap changes LIVE time. SET is the safer preparation target. / LIVE menja aktivno vreme.';
  else if (['outputA', 'outputB'].includes(command)) notice = 'One tap performs the selected output operation without resetting the timer.';
  else if (command === 'adjust' && target === 'selected') notice = 'This follows the current EDIT SET/LIVE selection. If LIVE is selected, a tap changes ACTIVE time.';
  $('safetyNotice').textContent = notice;
  $('safetyNotice').hidden = !notice;
}

function display() {
  const input = settings.key || {};
  const supported = DeckLayout.catalog.some(item => item.id === input.command);
  const command = supported ? input.command : 'empty';
  const key = { ...DeckLayout.defaultKey(command), ...input };
  $('command').value = command;
  for (const name of ['timerId', 'target', 'name', 'step', 'unit', 'color', 'textSize', 'icon', 'outputAction']) {
    if (key[name] !== undefined) $(name).value = String(key[name]);
  }
  $('pressPolicy').value = key.pressPolicy === 'confirm' ? 'hold' : key.pressPolicy;
  $('stateDisplay').checked = key.stateDisplay;
  const seconds = Number.isInteger(key.durationMs) && key.durationMs >= 0 && key.durationMs <= DeckLayout.MAX_DURATION
    ? key.durationMs / 1000 : 300;
  $('duration').value = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
  $('linked').checked = !!(settings.layoutId || settings.slotId);
  $('layoutId').value = settings.layoutId || '';
  $('slotId').value = settings.slotId || '';
  $('status').textContent = input.command && !supported
    ? 'This saved action is unsupported. Choose a supported action and save.' : '';
  updateFields();
}

window.connectElgatoStreamDeckSocket = function(port, uuid, registerEvent, info, actionInfo) {
  if (!/^\d+$/.test(String(port))) return;
  context = uuid;
  const action = JSON.parse(actionInfo);
  settings = action.payload.settings || {};
  display();
  socket = new WebSocket(`ws://127.0.0.1:${Number(port)}`);
  socket.onopen = () => socket.send(JSON.stringify({ event: registerEvent, uuid }));
  socket.onmessage = event => {
    try {
      const message = JSON.parse(event.data);
      if (message.event === 'didReceiveSettings') {
        settings = message.payload.settings || {};
        display();
      }
    } catch {}
  };
};

$('command').addEventListener('change', () => {
  const defaults = DeckLayout.defaultKey($('command').value);
  $('name').value = '';
  $('color').value = defaults.color;
  $('pressPolicy').value = defaults.pressPolicy;
  $('status').textContent = '';
  updateFields();
});
$('target').addEventListener('change', updateFields);
$('linked').addEventListener('change', updateFields);
$('editHere').addEventListener('click', () => {
  $('linked').checked=false; updateFields();
  $('status').textContent='Editing this key only. Choose an action and Save key. / Izaberi komandu pa Save key.';
});
for (const [id,step] of [['liveMinus',-1],['livePlus',1]]) $(id).addEventListener('click',()=>{
  $('linked').checked=false;
  $('command').value='adjust';$('target').value='live';$('step').value=String(step);$('unit').value='m';
  $('name').value='';$('icon').value='none';$('pressPolicy').value='short';
  updateFields();
  $('status').textContent='LIVE adjustment prepared. Save key to apply. ACTIVE is unchanged. / Sačuvaj dugme; tajmer još nije promenjen.';
});
$('form').addEventListener('submit', event => {
  event.preventDefault();
  if (socket?.readyState !== WebSocket.OPEN) {
    $('status').textContent = 'Elgato connection unavailable.';
    return;
  }

  const linked = $('linked').checked;
  const command = $('command').value;
  const defaults = DeckLayout.defaultKey(command);
  const sameCommand = settings.key?.command === command;
  let step = 1, durationMs = 300000;
  if (!linked && command === 'adjust') {
    step = Number($('step').value);
    if (!Number.isSafeInteger(step) || step === 0 || Math.abs(step) > 359999) {
      $('status').textContent = 'Enter a non-zero whole-number adjustment.';
      return;
    }
  }
  if (!linked && command === 'preset') {
    const duration = $('duration').value.match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/);
    if (!duration) {
      $('status').textContent = 'Use HH:MM:SS (maximum 99:59:59).';
      return;
    }
    durationMs = (Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])) * 1000;
  }

  const key = linked && DeckLayout.validateKey(settings.key).ok
    ? DeckLayout.normalizeKey(settings.key)
    : {
        ...defaults,
        id: /^[\w.-]{1,96}$/.test(settings.key?.id || '') ? settings.key.id : defaults.id,
        ...(sameCommand ? {
          ...(settings.key.hotkey !== undefined ? { hotkey: settings.key.hotkey } : {})
        } : {}),
        timerId: timerCommands.has(command) ? $('timerId').value : 'selected',
        target: command === 'adjust' ? $('target').value : 'selected',
        name: $('name').value.trim(),
        icon: $('icon').value,
        stateDisplay: $('stateDisplay').checked,
        outputAction: ['outputA','outputB'].includes(command) ? $('outputAction').value : 'toggle',
        step,
        unit: command === 'adjust' ? $('unit').value : 's',
        durationMs,
        color: $('color').value,
        textSize: Math.max(12, Math.min(28, Number($('textSize').value) || 18)),
        pressPolicy: 'short'
      };

  if (linked && (!/^[\w.-]{1,96}$/.test($('layoutId').value) || !/^[\w.-]{1,96}$/.test($('slotId').value))) {
    $('status').textContent = 'Copy valid layout and slot IDs from Control.';
    return;
  }
  const validated = DeckLayout.validateKey(key);
  if (!validated.ok) {
    $('status').textContent = validated.errors.join(' ');
    return;
  }
  const sameBinding = linked && settings.layoutId === $('layoutId').value && settings.slotId === $('slotId').value;
  settings = {
    instanceId: settings.instanceId || crypto.randomUUID(),
    key: validated.key,
    ...(linked ? { layoutId: $('layoutId').value, slotId: $('slotId').value } : {}),
    ...(sameBinding && Number.isInteger(settings.slotIndex) ? { slotIndex: settings.slotIndex } : {})
  };
  socket.send(JSON.stringify({ event: 'setSettings', context, payload: settings }));
  $('status').textContent = 'Settings sent to Elgato. No timer command was run.';
});
