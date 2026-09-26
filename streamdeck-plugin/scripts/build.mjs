import {build} from 'esbuild';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),target=new URL('com.srdjankotarlic.protimer.sdPlugin/',root);
await mkdir(new URL('bin/',target),{recursive:true});await mkdir(new URL('imgs/',target),{recursive:true});
await copyFile(new URL('../deck-layout.js',root),new URL('ui/layout.js',target));
await copyFile(new URL('../LICENSE',root),new URL('LICENSE',target));
await mkdir(new URL('licenses/',target),{recursive:true});
for(const [packageName,file]of [['@elgato/streamdeck','elgato-streamdeck-MIT.txt'],['@elgato/utils','elgato-utils-MIT.txt'],['@elgato/schemas','elgato-schemas-MIT.txt'],['ws','ws-MIT.txt']])await copyFile(new URL(`node_modules/${packageName}/LICENSE`,root),new URL(`licenses/${file}`,target));
await copyFile(new URL('node_modules/zod/LICENSE',root),new URL('licenses/zod-MIT.txt',target));
await build({entryPoints:[fileURLToPath(new URL('src/plugin.ts',root))],bundle:true,platform:'node',format:'esm',target:'node20.19',outfile:fileURLToPath(new URL('bin/plugin.js',target)),banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'},sourcemap:false});
await build({entryPoints:[fileURLToPath(new URL('src/logic.ts',root)),fileURLToPath(new URL('src/bridge.ts',root))],bundle:true,platform:'node',format:'esm',target:'node20.19',outdir:fileURLToPath(new URL('.test-build/',root))});
// Build-native original bitmap icons, not screenshots or generated profiles.
function crc(buf){let n=0xffffffff;for(const b of buf){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum]);}
function icon(size){const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const offset=y*(size*4+1)+1+x*4;const dx=x-size/2,dy=y-size/2,r=Math.hypot(dx,dy);const stroke=(r>size*.32&&r<size*.36)||(Math.abs(dx)<size*.017&&dy<0&&dy>-size*.24)||(Math.abs(dy)<size*.017&&dx>0&&dx<size*.2);raw[offset]=stroke?81:16;raw[offset+1]=stroke?207:21;raw[offset+2]=stroke?134:29;raw[offset+3]=255;}const head=Buffer.alloc(13);head.writeUInt32BE(size,0);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
for(const[name,size]of[['plugin',256],['plugin@2x',512],['category',28],['category@2x',56],['action',20],['action@2x',40],['key',72],['key@2x',144]])await writeFile(new URL(`imgs/${name}.png`,target),icon(size));
