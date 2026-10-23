'use strict';
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {EventEmitter} = require('node:events');

// MCP stdio is newline-delimited JSON-RPC. Child stderr is diagnostic only.
class McpProcess extends EventEmitter {
  constructor(config){super();this.config=config;this.seq=0;this.pending=new Map();this.buffer='';this.proc=null;this.tools=[];this.manualStop=false;this.lastStderr='';this.state='idle';}
  async start(){
    const c=this.config;
    this.manualStop=false;this.state='connecting';this.buffer='';this.lastStderr='';
    let child;
    try{child=spawn(c.command,c.args||[],{cwd:c.cwd,env:{...process.env,...c.env},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});}
    catch(e){this.state='error';throw new Error(`${c.name}: Cannot launch '${c.command}': ${e.message}`);}
    this.proc=child;
    child.stdout.setEncoding('utf8');child.stdout.on('data',s=>this.receive(s));
    child.stderr.setEncoding('utf8');child.stderr.on('data',s=>{
      this.lastStderr=(this.lastStderr+String(s)).slice(-2000);
      this.emit('log',String(s).slice(0,800));
    });
    child.stdin.on('error',err=>this.processEnded(new Error(`MCP stdin failed: ${err.message}`)));
    child.on('error',err=>this.processEnded(new Error(`Failed to start '${c.command}': ${err.message}`)));
    child.on('close',(code,signal)=>{
      if(this.manualStop)return;
      const info=code===null?`signal ${signal||'unknown'}`:`exit code ${code}`;
      const context=this.lastStderr.trim()?` | stderr: ${this.lastStderr.trim().slice(-550)}`:'';
      this.processEnded(new Error(`${c.name} MCP stopped unexpectedly (${info})${context}`));
    });
    try{
      const initialized=await this.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'abroo-vscode',version:'0.2.0'}},15000);
      if(!initialized?.protocolVersion)throw new Error('MCP initialize returned no protocolVersion');
      this.notify('notifications/initialized',{});
      this.tools=[];let cursor;
      for(let n=0;n<20;n++){
        const res=await this.request('tools/list',cursor?{cursor}:{},20000);
        this.tools.push(...(res.tools||[]));
        if(!res.nextCursor)break;
        cursor=res.nextCursor;
      }
      this.state='ready';this.emit('ready',this.tools);return this.tools;
    }catch(e){const details=this.lastStderr.trim()?` — server stderr: ${this.lastStderr.slice(-450)}`:'';this.stop();throw new Error(`${c.name}: ${e.message}${details}`);}
  }
  processEnded(err){if(this.manualStop||this.state==='error')return;this.state='error';this.failAll(err);this.emit('disconnected',err.message);}
  receive(s){
    this.buffer+=s;
    if(this.buffer.length>8*1024*1024){this.processEnded(new Error('MCP message buffer limit exceeded'));this.stop();return;}
    while(this.buffer.includes('\n')){
      const idx=this.buffer.indexOf('\n'),line=this.buffer.slice(0,idx).trim();this.buffer=this.buffer.slice(idx+1);
      if(!line)continue;
      let m;try{m=JSON.parse(line);}catch{this.emit('log','Non-JSON MCP stdout: '+line.slice(0,180));continue;}
      if(m.id!==undefined && (m.result!==undefined||m.error!==undefined)){
        const p=this.pending.get(String(m.id));if(!p)continue;
        clearTimeout(p.timer);this.pending.delete(String(m.id));
        if(m.error)p.reject(new Error(m.error.message||JSON.stringify(m.error)));else p.resolve(m.result);
      }else if(m.id!==undefined && m.method==='ping')this.write({jsonrpc:'2.0',id:m.id,result:{}});
      else if(m.id!==undefined && m.method)this.write({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:`Unsupported MCP request: ${m.method}`}});
      else this.emit('notification',m);
    }
  }
  write(m){if(!this.proc||this.proc.stdin.destroyed||this.manualStop)throw new Error('MCP process not running');this.proc.stdin.write(JSON.stringify(m)+'\n');}
  notify(method,params){this.write({jsonrpc:'2.0',method,params});}
  request(method,params={},timeoutMs=120000){
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(String(id));reject(new Error(`MCP ${method} timed out after ${timeoutMs} ms. Check server stdout/stderr and entrypoint.`));},timeoutMs);
      this.pending.set(String(id),{resolve,reject,timer});
      try{this.write({jsonrpc:'2.0',id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(String(id));reject(e);}
    });
  }
  async call(name,args){return this.request('tools/call',{name,arguments:args||{}},Number(this.config.timeoutMs)||120000);}
  failAll(err){for(const [,p] of this.pending){clearTimeout(p.timer);p.reject(err);}this.pending.clear();}
  stop(){this.manualStop=true;this.state='stopped';this.failAll(new Error('MCP stopped intentionally'));if(this.proc){const child=this.proc;this.proc=null;try{child.kill();}catch{}}}
}
function toolRegistry(clients){
  const registry=new Map(),used=new Set();
  for(const client of clients)for(const t of client.tools){
    if(client.config.includeTools?.length&&!client.config.includeTools.includes('*')&&!client.config.includeTools.includes(t.name))continue;
    let id=(client.config.name+'__'+t.name).replace(/[^a-zA-Z0-9_]/g,'_').slice(0,64);
    if(used.has(id))id=(id.slice(0,54)+'_'+randomUUID().slice(0,8));
    used.add(id);registry.set(id,{client,tool:t});
  }
  return registry;
}
module.exports={McpProcess,toolRegistry};
