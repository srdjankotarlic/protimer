import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DeckLayout = require('../../deck-layout.js');
const layoutSource = readFileSync(new URL('../../deck-layout.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../com.srdjankotarlic.protimer.sdPlugin/ui/key.js', import.meta.url), 'utf8');

function inspector(settings = {}) {
  const ids = [
    'form', 'command', 'timerId', 'target', 'name', 'step', 'unit', 'duration', 'color',
    'textSize', 'pressPolicy', 'linked', 'layoutId', 'slotId', 'status', 'linkedHelp',
    'linkFields', 'keyFields', 'timerField', 'targetField', 'adjustFields',
    'durationField', 'nameField', 'colorField', 'textSizeField', 'pressPolicyField',
    'commandHelp', 'safetyNotice', 'nameHint', 'editHere', 'icon', 'stateDisplay', 'outputAction', 'outputField','liveMinus','livePlus'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, {
    value: '', checked: false, hidden: false, disabled: false, textContent: '', options: [], handlers: {},
    append(option) { this.options.push(option); },
    addEventListener(event, handler) { this.handlers[event] = handler; },
    fire(event) { this.handlers[event]?.({ preventDefault() {} }); }
  }]));
  Object.assign(elements.timerId, { value: 'selected' });
  Object.assign(elements.target, { value: 'selected' });
  Object.assign(elements.step, { value: '1' });
  Object.assign(elements.unit, { value: 's' });
  Object.assign(elements.duration, { value: '00:05:00' });
  Object.assign(elements.color, { value: '#202631' });
  Object.assign(elements.textSize, { value: '18' });
  Object.assign(elements.pressPolicy, { value: 'short' });
  const messages = [];
  class WebSocket {
    static OPEN = 1;
    readyState = WebSocket.OPEN;
    send(raw) { messages.push(JSON.parse(raw)); }
  }
  const window = {};
  const runtime = {
    WebSocket, window,
    crypto: { randomUUID: () => 'new-instance' },
    document: {
      getElementById: id => elements[id],
      createElement: () => ({ value: '', textContent: '' })
    }
  };
  runInNewContext(layoutSource, runtime);
  runInNewContext(source, runtime);
  window.connectElgatoStreamDeckSocket('1234', 'context-1', 'registerPropertyInspector', '{}', JSON.stringify({ payload: { settings } }));
  return { elements, messages };
}

test('Property Inspector uses supported catalog labels and only relevant controls', () => {
  const { elements: el } = inspector({ key: DeckLayout.defaultKey('preset', { durationMs: 0 }) });
  assert.deepEqual(el.command.options.map(option => option.value), DeckLayout.catalog.map(item => item.id));
  assert.equal(el.command.options.find(option => option.value === 'startPause').textContent, 'START / PAUSE');
  assert.equal(el.command.options.some(option => option.value === 'mirror'), false);
  assert.equal(el.duration.value, '00:00:00');
  assert.equal(el.durationField.hidden, false);
  assert.equal(el.duration.disabled, false);
  assert.equal(el.adjustFields.hidden, true);
  el.command.value = 'adjust';
  el.command.fire('change');
  assert.equal(el.durationField.hidden, true);
  assert.equal(el.duration.disabled, true);
  assert.equal(el.adjustFields.hidden, false);
  assert.equal(el.targetField.hidden, false);
  el.command.value = 'selectTimer';
  el.command.fire('change');
  assert.equal(el.timerField.hidden, false);
});

test('immediate RESET saves short policy and irrelevant inputs do not block it', () => {
  const { elements: el, messages } = inspector({ key: DeckLayout.defaultKey('preset') });
  el.command.value = 'reset';
  el.command.fire('change');
  el.duration.value = 'invalid hidden duration';
  el.step.value = 'invalid hidden step';
  assert.equal(el.pressPolicy.value, 'short');
  assert.equal(el.pressPolicy.disabled, true);
  el.form.fire('submit');
  assert.equal(messages.length, 1, el.status.textContent);
  assert.equal(messages[0].payload.key.command, 'reset');
  assert.equal(messages[0].payload.key.pressPolicy, 'short');
  assert.equal(messages[0].payload.key.durationMs, 300000);
  assert.equal(messages[0].payload.key.step, 1);
});

test('START SET explains immediate one-touch replacement', () => {
  const { elements: el, messages } = inspector({ key: DeckLayout.defaultKey('startPause', { name: 'Old action' }) });
  el.command.value = 'startSet';
  el.command.fire('change');
  assert.equal(el.name.value, '');
  assert.equal(el.pressPolicy.value, 'short');
  assert.equal(el.pressPolicy.disabled, true);
  assert.equal(el.pressPolicyField.hidden, true);
  assert.match(el.safetyNotice.textContent, /One tap.*immediate action/);
  el.form.fire('submit');
  assert.equal(messages.length, 1, el.status.textContent);
  assert.equal(messages[0].payload.key.pressPolicy, 'short');
  assert.equal(messages[0].payload.key.name, '');
});

test('linked key exposes only link IDs and preserves its logical slot binding', () => {
  const key = DeckLayout.defaultKey('startPause');
  const { elements: el, messages } = inspector({ instanceId: 'old-instance', key, layoutId: 'protimer-standard', slotId: 'protimer-slot-1', slotIndex: 0 });
  assert.equal(el.keyFields.hidden, true);
  assert.equal(el.linkFields.hidden, false);
  assert.equal(el.duration.disabled, true);
  el.form.fire('submit');
  assert.equal(messages.length, 1, el.status.textContent);
  assert.equal(messages[0].payload.slotIndex, 0);
  assert.equal(messages[0].payload.key.command, 'startPause');
  el.slotId.value = 'protimer-slot-2';
  el.form.fire('submit');
  assert.equal(Object.hasOwn(messages[1].payload, 'slotIndex'), false);
});

test('direct LIVE adjustment is one-touch but invalid visible values are rejected', () => {
  const { elements: el, messages } = inspector({ key: DeckLayout.defaultKey('adjust') });
  el.target.value = 'live';
  el.target.fire('change');
  assert.equal(el.pressPolicy.value, 'short');
  assert.equal(el.pressPolicy.disabled, true);
  el.step.value = '0';
  el.form.fire('submit');
  assert.equal(messages.length, 0);
  el.step.value = '-5';
  el.form.fire('submit');
  assert.equal(messages.length, 1, el.status.textContent);
  assert.equal(messages[0].payload.key.target, 'live');
  assert.equal(messages[0].payload.key.step, -5);
  assert.equal(messages[0].payload.key.pressPolicy, 'short');
});
test('LIVE shortcuts configure only this key, pin ACTIVE target, preserve timer and send no command',()=>{
  for(const [button,step] of [['liveMinus',-1],['livePlus',1]]){
    const {elements:el,messages}=inspector({instanceId:'own-key',layoutId:'protimer-standard',slotId:'protimer-slot-11',slotIndex:10,key:DeckLayout.defaultKey('adjust',{timerId:'t2',target:'set',step:5,unit:'s'})});
    el[button].fire('click');assert.equal(messages.length,0);assert.equal(el.linked.checked,false);
    assert.equal(el.target.value,'live');assert.equal(el.timerId.value,'t2');assert.equal(el.unit.value,'m');
    el.form.fire('submit');assert.equal(messages.length,1);assert.equal(messages[0].event,'setSettings');
    assert.equal(messages[0].payload.key.target,'live');assert.equal(messages[0].payload.key.timerId,'t2');
    assert.equal(messages[0].payload.key.step,step);assert.equal(messages[0].payload.key.unit,'m');
    assert.equal(Object.hasOwn(messages[0].payload,'layoutId'),false);
  }
});

test('Elgato edits detach only this key, preserve its configuration, and never execute a command',()=>{
  const {elements:el,messages}=inspector({instanceId:'instance',layoutId:'protimer-standard',slotId:'protimer-slot-9',slotIndex:8,key:DeckLayout.defaultKey('adjust',{step:-5,unit:'m',target:'set'})});
  el.editHere.fire('click');assert.equal(el.keyFields.hidden,false);assert.equal(el.linked.checked,false);
  el.step.value='-10';el.icon.value='minus';el.form.fire('submit');
  assert.equal(messages.length,1);assert.equal(messages[0].event,'setSettings');
  assert.equal(messages[0].payload.key.step,-10);assert.equal(messages[0].payload.key.target,'set');
  assert.equal(messages[0].payload.instanceId,'instance');assert.equal(Object.hasOwn(messages[0].payload,'layoutId'),false);
});
