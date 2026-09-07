const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { leaveFullscreen } = require('../window-tools');

class FakeWindow extends EventEmitter {
  full = true;
  destroyed = false;
  calls = 0;
  isFullScreen() { return this.full; }
  isDestroyed() { return this.destroyed; }
  setFullScreen(value) { this.calls++; this.emit('leave-full-screen'); this.full = value; }
}
test('Windows event-before-state ordering is awaited and concurrent calls share one exit', async () => {
  const win = new FakeWindow();
  const first = leaveFullscreen(win), second = leaveFullscreen(win);
  assert.equal(first, second);
  assert.equal(await first, true);
  assert.equal(win.calls, 1);
  win.full = true;
  assert.equal(await leaveFullscreen(win), true); // no stale resolved promise
  assert.equal(win.calls, 2);
  assert.equal(win.listenerCount('leave-full-screen'), 0);
});
test('macOS asynchronous transitions finish before applying a size', async () => {
  const win = new FakeWindow();
  win.setFullScreen = value => setTimeout(() => { win.full = value; win.emit('leave-full-screen'); }, 10);
  assert.equal(await leaveFullscreen(win), true);
  assert.equal(win.full, false);
});
test('closed windows and failed transitions do not allow sizing', async () => {
  const win = new FakeWindow();
  win.setFullScreen = () => {};
  assert.equal(await leaveFullscreen(win, 10), false);
  win.destroyed = true;
  assert.equal(await leaveFullscreen(win), false);
});
