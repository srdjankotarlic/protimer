import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
// Inspect only the bounded, checked-in genuine Elgato export. No extraction,
// profile generation or modifications of the running Elgato profile database.
export function inspectProfile(file){
  const zip=readFileSync(file);
  if(zip.length>1024*1024)throw Error('Profile is too large');
  const end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  if(end<0||end+22>zip.length)throw Error('Invalid profile ZIP');
  const count=zip.readUInt16LE(end+10);let at=zip.readUInt32LE(end+16);const json=[];
  if(count>100)throw Error('Too many profile entries');
  for(let i=0;i<count;i++){
    if(zip.readUInt32LE(at)!==0x02014b50)throw Error('Invalid central entry');
    const flags=zip.readUInt16LE(at+8),method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+24),packed=zip.readUInt32LE(at+20);
    const nameLength=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32),local=zip.readUInt32LE(at+42);
    const name=zip.subarray(at+46,at+46+nameLength).toString('utf8');at+=46+nameLength+extra+comment;
    if(flags&1||size>65536||name.includes('..')||name.startsWith('/')||name.includes('\\'))throw Error('Unsafe profile entry');
    if(!name.endsWith('.json'))continue;
    if(zip.readUInt32LE(local)!==0x04034b50)throw Error('Invalid local entry');
    const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),data=zip.subarray(start,start+packed);
    const raw=method===8?inflateRawSync(data,{maxOutputLength:65536}):method===0?data:null;
    if(!raw||raw.length!==size)throw Error('Invalid profile compression/size');
    json.push({name,value:JSON.parse(raw.toString('utf8'))});
  }
  return {sha256:createHash('sha256').update(zip).digest('hex'),json};
}
export const EXPORTED_SHA256='e86a1cecc8535f87987e8925f7e95c24aeae331afac0ef8fad20f4e301fa9fe3';
export function checkBundledProfile(){
  const result=inspectProfile(new URL('../com.srdjankotarlic.protimer.sdPlugin/profiles/protimer-xl-full.streamDeckProfile',import.meta.url));
  if(result.sha256!==EXPORTED_SHA256)throw Error('Native profile changed: re-export and verify through Elgato before accepting a new hash');
  return result;
}
