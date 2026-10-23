// Minimal MCP JSON-RPC test double. It never contacts a cloud service.
let buffer='';process.stdin.setEncoding('utf8');
process.stdin.on('data',text=>{buffer+=text;let index;while((index=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(!line.trim())continue;const m=JSON.parse(line);if(m.id===undefined)continue;let result={};if(m.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'mock',version:'1'}};
else if(m.method==='tools/list')result={tools:[{name:'liara_diagnose_app',description:'Mock diagnostics',inputSchema:{type:'object',properties:{app:{type:'string'}}}},{name:'liara_apply_remediation',description:'Mock mutation',inputSchema:{type:'object',properties:{planId:{type:'string'}}}}]};
else if(m.method==='tools/call')result={content:[{type:'text',text:JSON.stringify({observed:'mock',args:m.params.arguments})}]};
else {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Not found'}})+'\n');continue;}
process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n');}
});
