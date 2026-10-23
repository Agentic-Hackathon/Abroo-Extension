'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const {resolveServer}=require('../lib/config.cjs');
const {canAuto,policyFor,normalizePolicy}=require('../lib/policies.cjs');
const {McpProcess}=require('../lib/mcp.cjs');
const {restore,snapshot,KEY}=require('../lib/session.cjs');
const {stripSecrets}=require('../lib/config.cjs');
let workspace='';
const vscode={workspace:{get workspaceFolders(){return [{uri:{fsPath:workspace}}]},getConfiguration:()=>({get:(_k,def)=>def}),isTrusted:true},Uri:{file:f=>({fsPath:f})},window:{createOutputChannel:()=>({appendLine(){},dispose(){}}),registerWebviewViewProvider:()=>({dispose(){}})},commands:{registerCommand:()=>({dispose(){}}),executeCommand:async()=>{}}};
const oldLoad=Module._load;Module._load=function(req,parent,isMain){if(req==='vscode')return vscode;return oldLoad.apply(this,arguments);};
const {AbrooViewProvider}=require('../extension.js');Module._load=oldLoad;
async function until(fn,timeout=5000){const start=Date.now();while(Date.now()-start<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,8));}throw Error('Missing expected event');}
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abroo-v02-'));workspace=dir;fs.mkdirSync(path.join(dir,'.abroo'));
 const conf={models:[{name:'test',model:'test',provider:'openai-compatible',apiBase:'http://localhost:5000/v1',stream:false}],mcpServers:[{name:'mock',command:process.execPath,args:[path.join(__dirname,'mock-mcp.cjs')]}]};
 fs.writeFileSync(path.join(dir,'.abroo','config.json'),JSON.stringify(conf));
 const stored=new Map();const storage={get:k=>stored.get(k),update:async(k,v)=>{stored.set(k,structuredClone(v));}};
 const context={extensionPath:path.join(__dirname,'..'),globalState:{get:(_k,v)=>v,update:async()=>{}},workspaceState:storage,secrets:{get:async()=>''},subscriptions:[]};
 const events=[],webview={postMessage:async e=>{events.push(e);return true;},onDidReceiveMessage:()=>({dispose(){}}),asWebviewUri:uri=>'vscode-resource:'+uri.fsPath,cspSource:'vscode-resource:',options:{}};
 const view={webview,onDidDispose:()=>{}};
 function provider(){const p=new AbrooViewProvider(context);p.output={appendLine(){}};return p;}
 return {dir,stored,context,events,view,provider,cleanup:(p)=>{for(const c of p.clients)c.stop();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('Config rejects missing MCP script before spawn with a usable message',async()=>{
 const f=fixture();try{await assert.rejects(resolveServer({name:'liara',command:'node',args:['/invalid/path/index.js']},{workspaceFolder:f.dir,secrets:f.context.secrets}),/entry script not found/);}finally{fs.rmSync(f.dir,{recursive:true,force:true});}
});
test('Intentionally stopping MCP does not emit spurious exited(null) status',async()=>{
 const c=new McpProcess({name:'mock',command:process.execPath,args:[path.join(__dirname,'mock-mcp.cjs')],cwd:__dirname});let disconnects=0;c.on('disconnected',()=>disconnects++);
 await c.start();c.stop();await new Promise(r=>setTimeout(r,120));assert.equal(disconnects,0);
});
test('Tool policies default to Ask; mutations cannot be automatic; safe reads can',()=>{
 assert.equal(policyFor({},'liara_restart_app'),'ask');assert.equal(canAuto('liara_list_apps'),true);assert.equal(canAuto('liara_list_env_vars'),false);
 assert.throws(()=>normalizePolicy('liara_create_app','automatic'),/not permitted/);
 assert.equal(policyFor({toolPolicies:{liara_restart_app:'automatic'}},'liara_restart_app'),'ask');
 assert.equal(policyFor({toolPolicies:{liara_list_apps:'automatic'}},'liara_list_apps'),'automatic');
});
test('Session snapshot strips raw tool data and preserves bounded user and assistant text',()=>{
 const events=[{type:'message',role:'user',text:'Hello'},{type:'message',role:'assistant',text:'Balance is 42'},{type:'formSummary',title:'Inspect',status:'submitted'}];
 const history=[{role:'user',content:'Hello'},{role:'assistant',content:null,tool_calls:[{id:'1'}]},{role:'tool',content:'secret',tool_call_id:'1'},{role:'assistant',content:'Balance is 42'}];
 const s=restore(snapshot(events,history,stripSecrets));assert.equal(s.events.length,3);assert.deepEqual(s.history,[{role:'user',content:'Hello'},{role:'assistant',content:'Balance is 42'}]);
});
test('Conversation is restored across recreated extension instance and cleared persistently',async()=>{
 const f=fixture();const p=f.provider();
 try{
  await p.resolveWebviewView(f.view);await p.reload();
  p.post('message',{role:'user',text:'سلام'});p.post('assistantDone',{id:'a',text:'پاسخ'});p.history.push({role:'user',content:'سلام'},{role:'assistant',content:'پاسخ'});p.persist();await p.flush();
  const fresh=f.provider();assert.equal(fresh.timeline.length,2);assert.equal(fresh.history.length,2);
  await fresh.resolveWebviewView(f.view);await fresh.onMessage({type:'ready'});
  assert.ok(f.events.some(e=>e.type==='restore'&&e.events.some(x=>x.role==='assistant'&&x.text==='پاسخ')));
  await fresh.clear();assert.equal(f.provider().timeline.length,0);
  for(const c of fresh.clients)c.stop();
 }finally{f.cleanup(p);}
});
test('Repeated identical form within one user turn produces a single form request and the same answer',async()=>{
 const f=fixture(),p=f.provider();try{
   await p.resolveWebviewView(f.view);
   const args={title:'انتخاب',fields:[{id:'action',label:'Action',type:'select',required:true,options:[{value:'a',label:'A'}]}]};
   const a=p.runTool('abroo_request_form',args,new AbortController().signal),b=p.runTool('abroo_request_form',args,new AbortController().signal);
   const request=await until(()=>f.events.find(e=>e.type==='formRequest'));
   assert.equal(f.events.filter(e=>e.type==='formRequest').length,1);
   await p.onMessage({type:'form',id:request.id,values:{action:'a'}});
   assert.deepEqual(await a,await b);
   assert.equal(f.events.filter(e=>e.type==='formRequest').length,1);
 }finally{f.cleanup(p);}
});
test('Tool settings persist to shared config file and disabled tools leave agent registry',async()=>{
 const f=fixture(),p=f.provider();try{
  await p.resolveWebviewView(f.view);await p.reload();
  await p.onMessage({type:'setToolPolicy',server:'mock',tool:'liara_apply_remediation',policy:'disabled'});
  const updated=JSON.parse(fs.readFileSync(path.join(f.dir,'.abroo','config.json')));
  assert.equal(updated.mcpServers[0].toolPolicies.liara_apply_remediation,'disabled');
  assert.ok(!p.mcpTools().some(x=>x.function.name.endsWith('liara_apply_remediation')));
  await assert.rejects(p.onMessage({type:'setToolPolicy',server:'mock',tool:'liara_apply_remediation',policy:'automatic'}),/not permitted/);
  await p.onMessage({type:'setServerEnabled',server:'mock',enabled:false});
  assert.equal(p.registry.size,0);assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'.abroo','config.json'))).mcpServers[0].enabled,false);
 }finally{f.cleanup(p);}
});
