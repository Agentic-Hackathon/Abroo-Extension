'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const Module=require('node:module');
const vscode={
  workspace:{workspaceFolders:[],getConfiguration:()=>({get:(_key,def)=>def}),isTrusted:true},
  Uri:{file:f=>({fsPath:f})},
  window:{createOutputChannel:()=>({appendLine(){},dispose(){}}),registerWebviewViewProvider:()=>({dispose(){}})},
  commands:{registerCommand:()=>({dispose(){}}),executeCommand:async()=>{}},
};
const originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==='vscode')return vscode;return originalLoad.apply(this,arguments);};
const {AbrooViewProvider}=require('../extension.js');Module._load=originalLoad;
async function until(fn,timeout=3000){const begin=Date.now();while(Date.now()-begin<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Expected event did not arrive');}
function setup(modelBase){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abroo-ext-'));fs.mkdirSync(path.join(dir,'.abroo'));
  const config={models:[{name:'test',provider:'openai-compatible',model:'test',apiBase:modelBase||'http://localhost:9/v1',stream:false}],mcpServers:[{name:'mock',command:process.execPath,args:[path.join(__dirname,'mock-mcp.cjs')],cwd:dir}],ui:{language:'fa'}};
  fs.writeFileSync(path.join(dir,'.abroo','config.json'),JSON.stringify(config));vscode.workspace.workspaceFolders=[{uri:{fsPath:dir}}];
  const state={get:(_name,def)=>def,update:async()=>{}};
  const ctx={extensionPath:path.join(__dirname,'..'),globalState:state,secrets:{get:async()=>''},subscriptions:[]};
  const p=new AbrooViewProvider(ctx);p.output={appendLine(){}};
  const events=[];const webview={onDidReceiveMessage:()=>({dispose(){}}),postMessage:async m=>{events.push(m);return true;},asWebviewUri:u=>`vscode-resource:${u.fsPath}`,cspSource:'vscode-resource:',options:{}};
  const view={webview,onDidDispose:()=>{}};
  return {dir,p,events,view,cleanup:()=>{for(const c of p.clients)c.stop();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('Extension enforces per-call approval and sends form answers back to agent',async()=>{
 const s=setup();try{
   await s.p.resolveWebviewView(s.view);await s.p.reload();
   assert.ok(s.events.some(e=>e.type==='config'&&e.tools===2));
   const denyPromise=s.p.runTool('mock__liara_apply_remediation',{planId:'abc'},new AbortController().signal);
   const denied=await until(()=>s.events.find(e=>e.type==='approvalRequest'));
   const deny=await s.p.onMessage({type:'approval',id:denied.id,approved:false});
   const noResult=await denyPromise;assert.match(noResult.error,/denied/);
   const approvedPromise=s.p.runTool('mock__liara_diagnose_app',{app:'my-mcp-test'},new AbortController().signal);
   const approval=await until(()=>s.events.filter(e=>e.type==='approvalRequest')[1]);
   await s.p.onMessage({type:'approval',id:approval.id,approved:true});
   const yesResult=await approvedPromise;assert.match(yesResult.content[0].text,/my-mcp-test/);
   const formPromise=s.p.runTool('abroo_request_form',{title:'روش اصلاح',fields:[{id:'method',label:'روش',type:'select',required:true,options:[{value:'restart',label:'Restart'},{value:'inspect',label:'Inspect'}]}]},new AbortController().signal);
   const frm=await until(()=>s.events.find(e=>e.type==='formRequest'));
   await s.p.onMessage({type:'form',id:frm.id,values:{method:'inspect'}});
   assert.deepEqual(await formPromise,{cancelled:false,values:{method:'inspect'}});
   const chart=await s.p.runTool('abroo_show_chart',{title:'CPU',type:'line',labels:['t1','t2'],series:[{name:'cpu',values:[5,8]}]},new AbortController().signal);
   assert.equal(chart.status,'displayed');assert.ok(s.events.find(e=>e.type==='chart'));
 }finally{s.cleanup();}
});
test('Extension can complete an LLM tool-calling conversation with explicit human approval',async()=>{
 const server=http.createServer((req,res)=>{let data='';req.on('data',c=>data+=c);req.on('end',()=>{
   const payload=JSON.parse(data),hasToolReply=payload.messages.some(m=>m.role==='tool');
   const message=hasToolReply?{role:'assistant',content:'Diagnostics reviewed.'}:{role:'assistant',content:null,tool_calls:[{id:'call_1',type:'function',function:{name:'mock__liara_diagnose_app',arguments:'{"app":"my-mcp-test"}'}}]};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message}]}));
 });});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const s=setup(`http://127.0.0.1:${server.address().port}/v1`);
 try{
   await s.p.resolveWebviewView(s.view);await s.p.reload();
   const chatPromise=s.p.chat('Diagnose my-mcp-test');
   const req=await until(()=>s.events.find(e=>e.type==='approvalRequest'));
   await s.p.onMessage({type:'approval',id:req.id,approved:true});await chatPromise;
   assert.ok(s.events.some(e=>e.type==='assistantDone'&&e.text==='Diagnostics reviewed.'));
   assert.equal(s.p.history.filter(m=>m.role==='tool').length,1);
 }finally{s.cleanup();await new Promise(r=>server.close(r));}
});
