// VSIX packaging without internet, npm install, Python, or vsce.
import fs from 'node:fs';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
const root=process.cwd(),pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const name=`${pkg.name}-${pkg.version}.vsix`;
const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const manifest=`<?xml version="1.0" encoding="utf-8"?><PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Id="${xml(pkg.name)}" Version="${xml(pkg.version)}" Language="en-US" Publisher="${xml(pkg.publisher)}"/><DisplayName>${xml(pkg.displayName)}</DisplayName><Description xml:space="preserve">${xml(pkg.description)}</Description><Tags>mcp,liara,ai,chat,rtl</Tags><Categories>AI,Chat</Categories><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="${xml(pkg.engines.vscode)}"/></Properties></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[1.93.0,)"/></Installation><Dependencies/><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.md" Addressable="true"/><Asset Type="Microsoft.VisualStudio.Code.Icons.Default" Path="extension/media/icon.png" Addressable="true"/></Assets></PackageManifest>`;
const contentTypes=`<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="vsixmanifest" ContentType="text/xml"/><Default Extension="xml" ContentType="text/xml"/><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="md" ContentType="text/markdown"/></Types>`;
const files={'[Content_Types].xml':Buffer.from(contentTypes),'extension.vsixmanifest':Buffer.from(manifest)};
for(const filename of ['package.json','extension.js','README.md','INSTALL_FA.md','LICENSE.md','media/icon.svg','media/icon.png','media/webview.css','media/webview.js','lib/config.cjs','lib/llm.cjs','lib/mcp.cjs','examples/config.json'])files['extension/'+filename]=fs.readFileSync(path.join(root,filename));
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(buf){let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function fileEntry(name,raw,offset){
 const n=Buffer.from(name),comp=deflateRawSync(raw),crc=crc32(raw);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(comp.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(n.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(comp.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(n.length,28);central.writeUInt32LE(offset,42);
 return {body:Buffer.concat([local,n,comp]),central:Buffer.concat([central,n])};
}
const bodies=[],centers=[];let offset=0;
for(const [filename,raw] of Object.entries(files)){const entry=fileEntry(filename,raw,offset);bodies.push(entry.body);centers.push(entry.central);offset+=entry.body.length;}
const cent=Buffer.concat(centers);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(centers.length,8);end.writeUInt16LE(centers.length,10);end.writeUInt32LE(cent.length,12);end.writeUInt32LE(offset,16);
fs.writeFileSync(name,Buffer.concat([...bodies,cent,end]));console.log(`Created ${name} (${fs.statSync(name).size} bytes) with ${centers.length} entries`);
