'use strict';
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {EventEmitter} = require('node:events');

// MCP stdio transports delimit JSON-RPC messages with a single newline.
class McpProcess extends EventEmitter {
  constructor(config) { super(); this.config=config; this.seq=0; this.pending=new Map(); this.buffer=''; this.proc=null; this.tools=[]; }
  async start() {
    const c=this.config;
    this.proc=spawn(c.command,c.args||[],{cwd:c.cwd,env:{...process.env,...c.env},shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.proc.stdout.setEncoding('utf8'); this.proc.stdout.on('data',s=>this.receive(s));
    this.proc.stderr.setEncoding('utf8'); this.proc.stderr.on('data',s=>this.emit('log',String(s).slice(0,800)));
    this.proc.on('error',err=>this.failAll(err));
    this.proc.on('close',(code)=>this.failAll(new Error(`${c.name} MCP exited (${code})`)));
    try {
      await this.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'abroo-vscode',version:'0.1.0'}},20000);
      this.notify('notifications/initialized',{});
      this.tools=[]; let cursor;
      for (let n=0;n<20;n++) {
        const res=await this.request('tools/list',cursor?{cursor}:{},20000);
        this.tools.push(...(res.tools||[]));
        if (!res.nextCursor) break;
        cursor=res.nextCursor;
      }
      this.emit('ready',this.tools);
      return this.tools;
    } catch(e) { this.stop(); throw e; }
  }
  receive(s) {
    this.buffer+=s;
    if(this.buffer.length>8*1024*1024) {this.failAll(new Error('MCP message buffer limit exceeded')); this.stop();return;}
    while(this.buffer.includes('\n')) {
      const idx=this.buffer.indexOf('\n'), line=this.buffer.slice(0,idx).trim(); this.buffer=this.buffer.slice(idx+1);
      if(!line)continue;
      let m;try{m=JSON.parse(line)}catch{this.emit('log','Non-JSON MCP stdout: '+line.slice(0,180));continue;}
      if(m.id !== undefined && (m.result!==undefined || m.error!==undefined)) {
        const p=this.pending.get(String(m.id));if(!p)continue;
        clearTimeout(p.timer);this.pending.delete(String(m.id));
        if(m.error) p.reject(new Error(m.error.message||JSON.stringify(m.error)));else p.resolve(m.result);
      } else if(m.method==='ping' && m.id!==undefined) this.write({jsonrpc:'2.0',id:m.id,result:{}});
      else this.emit('notification',m);
    }
  }
  write(m){if(!this.proc || this.proc.stdin.destroyed) throw new Error('MCP process not running'); this.proc.stdin.write(JSON.stringify(m)+'\n');}
  notify(method,params){this.write({jsonrpc:'2.0',method,params});}
  request(method,params={},timeoutMs=120000) {
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(String(id));reject(new Error(`MCP ${method} timed out`));},timeoutMs);
      this.pending.set(String(id),{resolve,reject,timer});
      try{this.write({jsonrpc:'2.0',id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(String(id));reject(e);}
    });
  }
  async call(name,args){return this.request('tools/call',{name,arguments:args||{}},Number(this.config.timeoutMs)||120000);}
  failAll(err){for(const [,p] of this.pending){clearTimeout(p.timer);p.reject(err);}this.pending.clear();this.emit('disconnected',err.message);}
  stop(){ if(this.proc){this.proc.kill();this.proc=null;} this.failAll(new Error('MCP stopped'));}
}
function toolRegistry(clients){
  const registry=new Map(); const used=new Set();
  for(const client of clients){
    for(const t of client.tools){
      if(client.config.includeTools?.length && !client.config.includeTools.includes('*') && !client.config.includeTools.includes(t.name)) continue;
      let id=(client.config.name+'__'+t.name).replace(/[^a-zA-Z0-9_]/g,'_').slice(0,64);
      if(used.has(id))id=(id.slice(0,54)+'_'+randomUUID().slice(0,8));
      used.add(id);registry.set(id,{client,tool:t});
    }
  }
  return registry;
}
module.exports={McpProcess,toolRegistry};
