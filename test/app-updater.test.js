'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {buildType,selectUpdate,createUpdater}=require('../app-updater');

const data=Buffer.from('sample installer bytes');
const digest=createHash('sha256').update(data).digest('hex');
const release={tag_name:'v2.7.1',draft:false,prerelease:false,assets:['arm64.dmg','x64.exe','portable.exe'].map(extension=>{
  const name='ProTimer-Update-2.7.1-'+extension;
  return {name,state:'uploaded',size:data.length,digest:'sha256:'+digest,browser_download_url:
    'https://github.com/srdjankotarlic/protimer/releases/download/v2.7.1/'+name};
})};
const lookup=target=>String(target).startsWith('https://api.github.com/');
const checkResponse=()=>Response.json(release);
async function fixture(t,overrides={}){
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'protimer-updater-test-'));
  t.after(()=>fs.rm(temp,{recursive:true,force:true}));
  const opened=[],progress=[];
  let safe=true;
  const updater=createUpdater({current:'2.7.0',type:'setup',temp,
    canOpen:()=>safe,openPackage:async(file,type)=>{opened.push([file,type]);return '';},
    progress:percent=>progress.push(percent),
    fetchImpl:async url=>lookup(url)?checkResponse():new Response(data),
    ...overrides});
  return {updater,opened,progress,temp,safe:value=>{safe=value;}};
}

test('selects a verified installer for the running OS, never downgrades or installs pre-releases',()=>{
  assert.equal(buildType('darwin','x64'),null);
  assert.equal(buildType('win32','x64',true),'portable');
  assert.match(selectUpdate(release,'2.7.1-beta','mac').name,/arm64\.dmg$/);
  assert.match(selectUpdate(release,'2.6.1','portable').name,/portable\.exe$/);
  assert.equal(selectUpdate(release,'2.7.1','setup'),null);
  assert.equal(selectUpdate(release,'2.10.0','setup'),null);
  assert.throws(()=>selectUpdate({...release,prerelease:true},'2.7.0','setup'),{code:'RELEASE_UNAVAILABLE'});
  assert.throws(()=>selectUpdate({...release,assets:[]},'2.7.0','setup'),{code:'PACKAGE_UNAVAILABLE'});
  const bad=structuredClone(release);
  bad.assets[1].digest=null;
  assert.throws(()=>selectUpdate(bad,'2.7.0','setup'),{code:'PACKAGE_UNAVAILABLE'});
  bad.assets[1].digest='sha256:'+digest;
  bad.assets[1].browser_download_url='https://example.org/ProTimer-Update-2.7.1-x64.exe';
  assert.throws(()=>selectUpdate(bad,'2.7.0','setup'),{code:'PACKAGE_UNAVAILABLE'});
});

test('check, download and open are separate actions and opening is blocked during a live show',async t=>{
  const requests=[];
  const f=await fixture(t,{fetchImpl:async target=>{
    requests.push(String(target));
    if(lookup(target))return checkResponse();
    if(String(target).startsWith('https://github.com/'))return new Response(null,{status:302,
      headers:{location:'https://release-assets.githubusercontent.com/real-package'}});
    return new Response(data);
  }});
  const {updater}=f;
  assert.equal((await updater.run('open')).code,'CHECK_FIRST');
  assert.equal((await updater.run('check')).latest,'2.7.1');
  assert.equal(requests.length,1);
  assert.equal((await updater.run('download')).ready,true);
  assert.deepEqual(f.progress,[100]);
  assert.equal(f.opened.length,0);
  f.safe(false);
  assert.equal((await updater.run('open')).code,'SHOW_ACTIVE');
  f.safe(true);
  assert.equal((await updater.run('open')).ok,true);
  assert.equal(f.opened.length,1);
  assert.ok((await fs.readFile(f.opened[0][0])).equals(data));
  await fs.writeFile(f.opened[0][0],Buffer.alloc(data.length));
  const changed=await updater.run('open');
  assert.equal(changed.code,'INTEGRITY_FAILED');
  assert.equal(changed.ready,false);
  assert.equal(f.opened.length,1);
});

test('failed verification and insecure redirects never leave an executable package',async t=>{
  for(const scenario of ['bad bytes','foreign host','short file']){
    const f=await fixture(t,{fetchImpl:async target=>{
      if(lookup(target))return checkResponse();
      if(scenario==='foreign host')return new Response(null,{status:302,headers:{location:'http://bad.example/a.exe'}});
      return new Response(scenario==='short file'?data.subarray(1):Buffer.alloc(data.length));
    }});
    assert.equal((await f.updater.run('check')).ok,true);
    const result=await f.updater.run('download');
    assert.equal(result.code,scenario==='foreign host'?'DOWNLOAD_FAILED':'INTEGRITY_FAILED');
    assert.deepEqual(await fs.readdir(f.temp),[]);
    assert.equal(f.opened.length,0);
  }
});

test('cancel interrupts a download and still allows a retry',async t=>{
  let started,hold=true;
  const waiting=new Promise(resolve=>{started=resolve;});
  const f=await fixture(t,{fetchImpl:async (target,{signal})=>{
    if(lookup(target))return checkResponse();
    if(!hold)return new Response(data);
    started();
    return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  }});
  await f.updater.run('check');
  const active=f.updater.run('download');
  await waiting;
  assert.equal((await f.updater.run('download')).code,'BUSY');
  await f.updater.run('cancel');
  assert.equal((await active).code,'CANCELED');
  assert.deepEqual(await fs.readdir(f.temp),[]);
  hold=false;
  assert.equal((await f.updater.run('download')).ready,true);
});

test('rate limiting is distinct from an up-to-date result',async t=>{
  const f=await fixture(t,{fetchImpl:async ()=>new Response(null,{status:429})});
  assert.equal((await f.updater.run('check')).code,'RATE_LIMIT');
});
