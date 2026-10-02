const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createProfileGuard}=require('../deck-profile-guard');
const inventory=(prefix='old',version=1)=>({visibilityVersion:version,actions:Array.from({length:32},(_,i)=>({deviceId:'xl',context:prefix+i}))});
test('profile return requires manual accepted switch and new visible contexts; unchanged/manual startup cannot qualify',()=>{
  const g=createProfileGuard();assert.equal(g.observe(inventory(),'s',true),false);
  g.request(inventory(),'xl','s');g.acknowledge(true);assert.equal(g.observe(inventory(),'s',true),false);
  assert.equal(g.observe(inventory('new',2),'s',true),true);
  assert.equal(g.observe(inventory('new',2),'s',true),true);
});
test('manual page/profile/device lifecycle change, stale connection and new session revoke return, including same-context reappearance',()=>{
  for(const change of [()=>[inventory('new',3),'s',true],()=>[inventory('foreign',2),'s',true],()=>[inventory('new',2),'other',true],()=>[inventory('new',2),'s',false]]){
    const g=createProfileGuard();g.request(inventory(),'xl','s');g.acknowledge(true);assert.equal(g.observe(inventory('new',2),'s',true),true);
    assert.equal(g.observe(...change()),false);assert.equal(g.observe(inventory('new',2),'s',true),false);
  }
});
test('failed or expired profile switch never enables return; resetting/selecting device revokes it',()=>{
  let now=0;const g=createProfileGuard({now:()=>now});g.request(inventory(),'xl','s');g.acknowledge(false);assert.equal(g.observe(inventory('new',2),'s',true),false);
  g.request(inventory(),'xl','s');g.acknowledge(true);now=31000;assert.equal(g.observe(inventory('new',2),'s',true),false);
  now=0;g.request(inventory(),'xl','s');g.acknowledge(true);g.observe(inventory('new',2),'s',true);g.reset();assert.equal(g.observe(inventory('new',2),'s',true),false);
});
