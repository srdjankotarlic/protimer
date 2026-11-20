'use strict';

const {createHash}=require('node:crypto');
const {createReadStream}=require('node:fs');
const fs=require('node:fs/promises');
const path=require('node:path');

const repository='srdjankotarlic/protimer';
const web=`https://github.com/${repository}/releases`;
const latest=`https://api.github.com/repos/${repository}/releases/latest`;
const updateNames={
  mac:version=>`ProTimer-Update-${version}-arm64.dmg`,
  setup:version=>`ProTimer-Update-${version}-x64.exe`,
  portable:version=>`ProTimer-Update-${version}-portable.exe`
};
const downloadHosts=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);
const maxAssetBytes=1024**3;

function buildType(platform,arch,portable){
  if(platform==='darwin'&&arch==='arm64')return 'mac';
  if(platform==='win32'&&arch==='x64')return portable?'portable':'setup';
  return null;
}
function versionParts(version){
  if(typeof version!=='string'||!/^\d{1,8}\.\d{1,8}\.\d{1,8}$/.test(version))return null;
  return version.split('.').map(Number);
}
function newer(remote,current){
  const a=versionParts(remote),b=versionParts(current.split('-')[0]);
  if(!a||!b)return false;
  const index=a.findIndex((part,i)=>part!==b[i]);
  return index<0?current.includes('-'):a[index]>b[index];
}
function failure(code){return Object.assign(new Error(code),{code});}
function selectUpdate(release,current,type){
  const version=typeof release?.tag_name==='string'&&release.tag_name.startsWith('v')?release.tag_name.slice(1):'';
  if(release?.draft||release?.prerelease||!versionParts(version))throw failure('RELEASE_UNAVAILABLE');
  if(!newer(version,current))return null;
  const name=updateNames[type](version);
  const url=`${web}/download/v${version}/${name}`;
  const asset=release.assets?.find(item=>item.name===name&&item.browser_download_url===url);
  if(!asset||asset.state!=='uploaded'||!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>maxAssetBytes||
     !/^sha256:[0-9a-f]{64}$/i.test(asset.digest))throw failure('PACKAGE_UNAVAILABLE');
  return {version,name,url,bytes:asset.size,sha256:asset.digest.slice(7).toLowerCase()};
}
async function openAsset(url,signal,fetchImpl){
  for(let hops=0;hops<5;hops++){
    const target=new URL(url);
    if(target.protocol!=='https:'||target.port||target.username||target.password||!downloadHosts.has(target.hostname))
      throw failure('DOWNLOAD_FAILED');
    const response=await fetchImpl(target,{signal,redirect:'manual'});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');
      await response.body?.cancel();
      if(!location)throw failure('DOWNLOAD_FAILED');
      url=new URL(location,target).href;
    }else{
      if(!response.ok||!response.body)throw failure('DOWNLOAD_FAILED');
      return response;
    }
  }
  throw failure('DOWNLOAD_FAILED');
}
async function releaseJSON(fetchImpl,signal){
  const response=await fetchImpl(latest,{signal,redirect:'error',headers:{
    Accept:'application/vnd.github+json','User-Agent':'ProTimer-Update-Check'
  }});
  if(response.status===403||response.status===429)throw failure('RATE_LIMIT');
  if(!response.ok||!response.body)throw failure('CHECK_FAILED');
  let size=0;
  const chunks=[];
  for await(const chunk of response.body){
    size+=chunk.byteLength;
    if(size>1024**2)throw failure('RELEASE_UNAVAILABLE');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function verifyFile(file,asset){
  const stat=await fs.lstat(file);
  if(!stat.isFile()||stat.size!==asset.bytes)throw failure('INTEGRITY_FAILED');
  const hash=createHash('sha256');
  for await(const part of createReadStream(file))hash.update(part);
  if(hash.digest('hex')!==asset.sha256)throw failure('INTEGRITY_FAILED');
}
function createUpdater({current,type,temp,canOpen,openPackage,progress=()=>{},fetchImpl=fetch}){
  let candidate=null, staging=null, operation=null;
  let ready=false;
  const info=()=>({current,type,latest:candidate?.version??null,ready});
  async function run(action){
    if(action==='status')return {ok:true,...info()};
    if(action==='cancel'){
      if(operation?.action==='download')operation.controller.abort();
      return {ok:true,...info()};
    }
    if(!type||!Object.hasOwn(updateNames,type))return {ok:false,code:'UNSUPPORTED',...info()};
    if(operation)return {ok:false,code:'BUSY',...info()};
    const controller=new AbortController();
    operation={action,controller};
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(action==='download'?600000:15000)]);
    try{
      if(action==='check'){
        const update=selectUpdate(await releaseJSON(fetchImpl,signal),current,type);
        if(staging&&update?.sha256!==candidate?.sha256){
          // Keep opened packages available to the system installer.
          staging=null;
          ready=false;
        }
        candidate=update;
      }else if(action==='download'){
        if(!candidate)throw failure('CHECK_FIRST');
        if(ready)return {ok:true,...info()};
        staging=await fs.mkdtemp(path.join(temp,'protimer-update-'));
        const file=path.join(staging,candidate.name);
        const hash=createHash('sha256');
        const response=await openAsset(candidate.url,signal,fetchImpl);
        const handle=await fs.open(file,'wx',0o600);
        let bytes=0, percent=-1;
        try{
          for await(const part of response.body){
            bytes+=part.byteLength;
            if(bytes>candidate.bytes)throw failure('INTEGRITY_FAILED');
            await handle.writeFile(part);
            hash.update(part);
            const next=Math.floor(bytes/candidate.bytes*100);
            if(next!==percent){percent=next;progress(next);}
          }
        }finally{await handle.close();}
        if(bytes!==candidate.bytes||hash.digest('hex')!==candidate.sha256)throw failure('INTEGRITY_FAILED');
        ready=true;
      }else if(action==='open'){
        if(!candidate||!staging||!ready)throw failure('CHECK_FIRST');
        if(!canOpen())throw failure('SHOW_ACTIVE');
        const file=path.join(staging,candidate.name);
        await verifyFile(file,candidate);
        if(!canOpen())throw failure('SHOW_ACTIVE');
        if(await openPackage(file,type))throw failure('OPEN_FAILED');
      }else throw failure('UNSUPPORTED');
      return {ok:true,...info()};
    }catch(error){
      if(action==='download'&&staging&&!ready){
        await fs.rm(staging,{force:true,recursive:true}).catch(()=>{});
        staging=null;
      }
      if(action==='open'&&['INTEGRITY_FAILED','ENOENT'].includes(error.code)){
        ready=false;
        await fs.rm(staging,{force:true,recursive:true}).catch(()=>{});
        staging=null;
        return {ok:false,code:'INTEGRITY_FAILED',...info()};
      }
      const codes=new Set(['RELEASE_UNAVAILABLE','PACKAGE_UNAVAILABLE','RATE_LIMIT','CHECK_FAILED','DOWNLOAD_FAILED',
        'CHECK_FIRST','SHOW_ACTIVE','INTEGRITY_FAILED','OPEN_FAILED','UNSUPPORTED']);
      const fallback={open:'OPEN_FAILED',download:'DOWNLOAD_FAILED'}[action]||'CHECK_FAILED';
      return {ok:false,code:controller.signal.aborted?'CANCELED':codes.has(error.code)?error.code:fallback,...info()};
    }finally{operation=null;}
  }
  return {run,stop:()=>operation?.controller.abort()};
}

module.exports={buildType,selectUpdate,createUpdater};
