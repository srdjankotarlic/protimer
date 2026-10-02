import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {checkBundledProfile} from '../scripts/check-profile.mjs';
const L=createRequire(import.meta.url)('../../deck-layout.js');
test('bundled profile is an unchanged genuine Elgato XL export with 32 supported actions and no connection secrets',()=>{
  const {json}=checkBundledProfile(),pkg=json.find(f=>f.name==='package.json').value;
  assert.equal(pkg.AppVersion,'7.6.0.23012');assert.equal(pkg.DeviceModel,'20GAT9902');assert.deepEqual(pkg.RequiredPlugins,['com.srdjankotarlic.protimer']);
  const actions=json.flatMap(f=>(f.value.Controllers||[]).flatMap(c=>Object.entries(c.Actions||{})));
  assert.equal(actions.length,32);
  const ids=new Set(),full=L.defaultLayout('full');
  for(const [position,action]of actions){
    assert.equal(action.UUID,'com.srdjankotarlic.protimer.key');const [col,row]=position.split(',').map(Number);
    assert.equal(action.Settings.key.command,full.slots[row*8+col].command);
    assert.ok(L.normalizeKey(action.Settings.key));
    for(const key of Object.keys(action.Settings))assert.ok(['instanceId','key','layoutId','slotId','slotIndex'].includes(key));
    assert.equal(ids.has(action.Settings.instanceId),false);ids.add(action.Settings.instanceId);
  }
  assert.doesNotMatch(JSON.stringify(json),/"(?:token|nonce|secret|audioFile|hotkey)"\s*:\s*"[^"\s]+"/i);
  const manifest=JSON.parse(readFileSync(new URL('../com.srdjankotarlic.protimer.sdPlugin/manifest.json',import.meta.url)));
  assert.deepEqual(manifest.Profiles,[{Name:'profiles/protimer-xl-full',DeviceType:2,Readonly:false,DontAutoSwitchWhenInstalled:true,AutoInstall:false}]);
});
