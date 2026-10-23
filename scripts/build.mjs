import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const required=['package.json','extension.js','lib/config.cjs','lib/mcp.cjs','lib/llm.cjs','media/icon.svg','media/icon.png','media/webview.js','media/webview.css','examples/config.json','README.md','INSTALL_FA.md'];
for(const f of required){if(!fs.existsSync(f))throw new Error('Missing build input: '+f);}
for(const f of required.filter(f=>/\.(js|cjs)$/.test(f)))execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
JSON.parse(fs.readFileSync('package.json','utf8'));JSON.parse(fs.readFileSync('examples/config.json','utf8'));
console.log('Abroo build OK — no external npm dependencies, code runs directly in VS Code.');
