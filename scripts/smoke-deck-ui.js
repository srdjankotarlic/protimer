'use strict';

const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Exercise the actual Control renderer and persisted layout API. The caller must
// use the app's isolated --smoke profile. This is not an Elgato/USB hardware test.
// No timer or bell command is allowed: defensive interceptors stop one before it
// can have a live effect, and turn any attempted execution into a test failure.
module.exports = async function smokeDeckUI({ controlWin }) {
  const js = code => controlWin.webContents.executeJavaScript(code);
  const originalBounds = controlWin.getBounds();
  const saved = await js(`(async () => {
    const settings = await api.deckInvoke('status');
    return { layout: settings.layout, globalHotkeys: settings.globalHotkeys, language: lang };
  })()`);
  try {
    const setup = await js(`(async () => {
      document.querySelector('.pt-deck-dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
      const disabled = await api.deckInvoke('configureHotkeys', { enabled: false });
      if (!disabled.ok) throw new Error('Cannot isolate global shortcuts for editor smoke');
      const status = await api.deckInvoke('status');
      return api.deckInvoke('applyLayout', { layout: DeckLayout.defaultLayout('standard'), expectedRevision: status.layoutRevision });
    })()`);
    assert.equal(setup.applied, true, 'Prepare an isolated standard logical layout');
    await delay(50);
    controlWin.setSize(1120, 740);
    // Native resize and Chromium's viewport update can arrive separately. A
    // small CI display may also clamp the requested outer window dimensions.
    // Wait for the renderer to match the actual native content size; never
    // report that a clamped window tested the requested 1120 × 740 frame.
    let geometry, previousGeometry = '', settledFrames = 0;
    for (let attempt = 0; attempt < 80; attempt++) {
      await delay(25);
      const viewport = await js('({width:innerWidth,height:innerHeight})');
      const [width, height] = controlWin.getContentSize();
      geometry = { requestedFrame: { width: 1120, height: 740 }, frame: controlWin.getBounds(), content: { width, height }, viewport };
      const signature = JSON.stringify(geometry);
      settledFrames = viewport.width === width && viewport.height === height && signature === previousGeometry ? settledFrames + 1 : 0;
      previousGeometry = signature;
      if (settledFrames >= 2) break;
    }
    console.log('DECK_EDITOR_GEOMETRY=' + JSON.stringify(geometry));
    assert.ok(settledFrames >= 2, 'Editor resize did not settle: ' + JSON.stringify(geometry));
    const result = await js(`(${editorChecks.toString()})()`);
    assert.equal(result.ok, true);
    assert.equal(result.commands, 0, 'Editor and simulation must never dispatch a timer command');
    assert.equal(result.audioStarts, 0, 'Editor and simulation must never play a bell');
    assert.ok(result.checks >= 15);
    console.log('DECK_EDITOR_UI_CHECKS=' + result.checks);
    console.log('DECK_EDITOR_APPLY_CANCEL_UNDO_DRAG_HOTKEY_OK=true');
    console.log('DECK_EDITOR_NO_LIVE_COMMANDS_OK=true');
    console.log('DECK_EDITOR_32_KEYS_VISIBLE_OK=true');
  } finally {
    // Restore even if a UI assertion fails. No user layouts are deleted and the
    // original active clocks were never replaced, paused, reset or adjusted.
    const restored = await js(`(async () => {
      document.querySelector('.pt-deck-dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
      const status = await api.deckInvoke('status');
      const result = await api.deckInvoke('applyLayout', { layout: ${JSON.stringify(saved.layout)}, expectedRevision: status.layoutRevision });
      await api.deckInvoke('configureHotkeys', { enabled: ${JSON.stringify(!!saved.globalHotkeys)} });
      deckControl.ui.setLanguage(${JSON.stringify(saved.language)});
      return result;
    })()`);
    controlWin.setBounds(originalBounds);
    assert.equal(restored.applied, true, 'Restore the original layout after editor smoke');
    await delay(50); // Let the host's restored-layout status reach the mounted UI.
  }
};

async function editorChecks() {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks.push(message);
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const dialog = () => document.querySelector('.pt-deck-dialog[open]');
  const keys = () => [...dialog().querySelectorAll('.pt-deck-key')];
  const click = text => {
    const target = [...dialog().querySelectorAll('button')].find(button => button.textContent === text);
    if (!target) throw new Error('Missing editor button: ' + text);
    target.click();
    return target;
  };
  const field = (name, scope = '.pt-deck-inspector') => {
    const label = [...dialog().querySelectorAll(scope + ' label')].find(label => label.firstChild.textContent === name);
    const input = label?.querySelector('input,select');
    if (!input) throw new Error('Missing editor field: ' + name);
    return input;
  };
  const change = (name, value, scope) => {
    const input = field(name, scope);
    input.value = String(value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const engineBefore = JSON.stringify(S);
  const model = deckControl.model;
  const originalConfirm = model.confirmTwice;
  const audioPrototype = globalThis.AudioBufferSourceNode?.prototype;
  const originalAudioStart = audioPrototype?.start;
  let attemptedCommands = 0, attemptedAudio = 0;
  model.confirmTwice = async () => {
    attemptedCommands++;
    return { ok: false, code: 'SMOKE_UI_COMMAND_BLOCKED', message: 'No live commands in editor smoke' };
  };
  if (audioPrototype) audioPrototype.start = function () {
    attemptedAudio++;
    throw new Error('No audio playback in editor smoke');
  };
  try {
    deckControl.ui.setLanguage('en');
    deckControl.ui.openEditor();
    assert(keys().length === 32, '32 logical keys');
    assert(dialog().querySelectorAll('.pt-deck-free').length === 4, 'Four genuine free entries in the mixed template');
    const activate = [...document.querySelectorAll('.pt-deck>details button')].find(button => button.textContent === 'Activate ProTimer profile');
    const initialStatus = await api.deckInvoke('status');
    assert(initialStatus.profilesVerified === true || activate?.disabled, 'Unverified profiles cannot be activated');

    const lastBounds = keys()[31].getBoundingClientRect();
    const footerBounds = dialog().querySelector('footer').getBoundingClientRect();
    const body = dialog().querySelector('.pt-deck-dialog-body');
    assert(lastBounds.bottom <= footerBounds.top, 'All 32 keys visible above the footer; requested frame 1120 × 740; observed ' + JSON.stringify({
      viewport: { width: innerWidth, height: innerHeight },
      lastKey: { top: lastBounds.top, bottom: lastBounds.bottom, left: lastBounds.left, right: lastBounds.right },
      footer: { top: footerBounds.top, bottom: footerBounds.bottom },
      body: { scrollTop: body.scrollTop, clientHeight: body.clientHeight, scrollHeight: body.scrollHeight }
    }));

    keys()[6].click();
    click('Preview selected key');
    assert(attemptedCommands === 0 && attemptedAudio === 0, 'Bell editor preview is non-executing');
    change('Custom label', 'SMOKE BELL');
    assert(keys()[6].textContent.includes('SMOKE BELL'), 'Rename visible on virtual key');
    click('Undo');
    assert(!keys()[6].textContent.includes('SMOKE BELL'), 'Undo restores label');
    click('Redo');
    assert(keys()[6].textContent.includes('SMOKE BELL'), 'Redo restores edit');
    const stableKey = keys()[6];
    deckControl.frame();
    assert(stableKey === keys()[6], 'Authoritative ticks do not recreate draggable keys');

    click('Duplicate');
    assert(dialog().querySelectorAll('.pt-deck-free').length === 3, 'Duplicate uses one logical free slot');
    click('Empty ProTimer slot');
    assert(dialog().querySelectorAll('.pt-deck-free').length === 3 && keys()[7].textContent.includes('INACTIVE'), 'Inactive owned slot is not falsely shown as free');
    click('Cancel');
    deckControl.ui.openEditor();
    assert(dialog().querySelectorAll('.pt-deck-free').length === 4 && !keys()[6].textContent.includes('SMOKE BELL'), 'Cancel discards label and duplication');

    dialog().querySelector('.pt-deck-management').open = true;
    change('Layout name', 'SMOKE editor layout', '.pt-deck-management');
    dialog().querySelector('.pt-deck-management').open = false;
    assert(dialog().querySelector('.pt-deck-management summary').textContent.includes('SMOKE editor layout'), 'Name is staged in editor');
    const transfer = new DataTransfer();
    keys()[8].dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true }));
    keys()[9].dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    keys()[9].dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    assert(keys()[8].textContent.includes('+1h') && keys()[9].textContent.includes('−1h'), 'Drag and drop swaps logical commands');
    keys()[8].click();
    change('Signed step', -5);
    change('Unit', 'm');
    assert(keys()[8].textContent.includes('−5m'), 'Adjustment label follows configured signed step and unit');
    keys()[16].click();
    change('Preset HH:MM:SS', '01:23:45');
    assert(keys()[16].textContent.includes('83:45'), 'Preset editor keeps complete hour/minute/second duration');

    keys()[0].click();
    change('Keyboard shortcut', 'Ctrl+Shift+9');
    keys()[1].click();
    change('Keyboard shortcut', 'Ctrl+Shift+9');
    assert(dialog().querySelector('.pt-deck-feedback').textContent.toLowerCase().includes('duplicate'), 'Duplicate hotkey is rejected with an explanation');
    keys()[0].click(); // Leave the rejected field; it never entered the valid draft.
    const beforeApply = await api.deckInvoke('status');
    assert(beforeApply.layout.name !== 'SMOKE editor layout', 'Editor changes are not live before Apply');
    click('Apply layout');
    let afterApply;
    for (let attempt = 0; attempt < 100; attempt++) {
      afterApply = await api.deckInvoke('status');
      if (afterApply.layout.name === 'SMOKE editor layout' && !dialog().querySelector('.pt-deck-feedback').textContent.includes('Working')) break;
      await wait(25);
    }
    assert(afterApply.layout.name === 'SMOKE editor layout' && afterApply.layoutRevision === beforeApply.layoutRevision + 1, 'Apply commits once through the actual layout API');
    assert(afterApply.layout.slots[8].step === -5 && afterApply.layout.slots[8].unit === 'm' && afterApply.layout.slots[16].durationMs === 5025000, 'Applied layout matches the displayed prepared edits');
    assert(afterApply.layout.slots.filter(key => key === null).length === 4, 'Four FREE entries remain truly unowned after edits');
    assert(afterApply.layout.slots.filter(key => key?.hotkey === 'Ctrl+Shift+9').length === 1, 'Rejected duplicate never entered persisted layout');
    assert(!dialog().querySelector('.pt-deck-feedback').textContent.includes('Plugin confirmed'), 'No hardware acknowledgement is invented without a real plugin');

    keys()[0].focus();
    keys()[0].dispatchEvent(new KeyboardEvent('keydown', { key: '9', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
    await wait(25);
    assert(attemptedCommands === 0, 'Custom keyboard shortcuts cannot execute through the editor dialog');
    assert(attemptedAudio === 0, 'Editor never plays audio');
    assert(JSON.stringify(S) === engineBefore, 'Editing, simulation and Apply leave the active timer engine untouched');
    click('Cancel');
    deckControl.ui.openEditor();
    assert(dialog().querySelector('.pt-deck-management summary').textContent.includes('SMOKE editor layout') && keys()[8].textContent.includes('−5m'), 'Applied layout survives closing and reopening the editor');
    return { ok: true, checks: checks.length, commands: attemptedCommands, audioStarts: attemptedAudio };
  } finally {
    dialog()?.dispatchEvent(new Event('cancel', { cancelable: true }));
    model.confirmTwice = originalConfirm;
    if (audioPrototype) audioPrototype.start = originalAudioStart;
  }
}
