const test = require('node:test');
const assert = require('node:assert/strict');
const Clock = require('../engine-clock');
test('wall-clock jumps correct both authoritative deadlines without changing durations or paused timers', () => {
  let wall=100000,mono=0;
  const s={mode:'countdown',running:true,endAt:wall+600000,durationMs:600000,secondary:{mode:'countup',running:true,startAt:wall,elapsedMs:0}};
  const clock=Clock.create({wallNow:()=>wall,monoNow:()=>mono,onJump:d=>Clock.shiftRunning(s,d)});
  wall+=1000;mono+=1000;clock.sample();assert.equal(s.endAt-wall,599000);
  wall+=3600000;clock.sample();assert.equal(s.endAt-wall,599000);assert.equal(wall-s.secondary.startAt,1000);
  wall-=7200000;clock.sample();assert.equal(s.endAt-wall,599000);assert.equal(s.durationMs,600000);
  s.running=false;const deadline=s.endAt;wall+=86400000;clock.sample();assert.equal(s.endAt,deadline);
});
test('simulated suspend includes elapsed sleep once and long durations never wrap at 24h',()=>{
  let wall=0,mono=0;const s={mode:'countdown',running:true,endAt:359999000,secondary:{mode:'countup',running:true,startAt:0}};
  const clock=Clock.create({wallNow:()=>wall,monoNow:()=>mono,onJump:d=>Clock.shiftRunning(s,d)});
  clock.suspend();wall+=48*3600000;clock.sample();clock.resume();
  wall+=1000;mono+=1000;clock.sample();assert.equal(s.endAt-wall,187198000);assert.equal(wall-s.secondary.startAt,172801000);
});
