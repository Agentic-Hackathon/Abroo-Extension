'use strict';
function endpoint(apiBase){const b=apiBase.replace(/\/+$/,'');return /\/chat\/completions$/.test(b)?b:b+'/chat/completions';}
function parseToolArguments(s){try{return JSON.parse(s||'{}')}catch{return {__invalid_tool_json:s||''}}}
async function chatCompletion(model, apiKey, messages, tools, opts={}) {
  const body={model:model.model,messages,temperature:model.temperature??0.2,stream:model.stream!==false};
  if(tools?.length){body.tools=tools;if(opts.toolChoice)body.tool_choice=opts.toolChoice;}
  const controller=new AbortController();
  if(opts.signal){if(opts.signal.aborted)controller.abort();else opts.signal.addEventListener('abort',()=>controller.abort(),{once:true});}
  const timer=setTimeout(()=>controller.abort(),Number(opts.timeoutMs)||120000);
  try{
    const headers={'Content-Type':'application/json'};
    if(apiKey)headers.Authorization=`Bearer ${apiKey}`;
    const res=await fetch(endpoint(model.apiBase),{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal});
    if(!res.ok){const t=(await res.text()).slice(0,600);throw new Error(`LLM HTTP ${res.status}: ${t}`);}
    if(model.stream===false || !res.headers.get('content-type')?.includes('text/event-stream')) {
      const data=await res.json();
      if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
      return data.choices?.[0]?.message || {role:'assistant',content:''};
    }
    if(!res.body)throw new Error('Empty LLM response body');
    const reader=res.body.getReader(), decoder=new TextDecoder();let pending='', content='', toolMap=new Map();
    function consume(part){
      for(const event of part.split(/\r?\n\r?\n/)){
        const data=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
        if(!data || data==='[DONE]')continue;
        let obj;try{obj=JSON.parse(data)}catch{continue;}
        if(obj.error)throw new Error(obj.error.message||'LLM stream error');
        const delta=obj.choices?.[0]?.delta||{};
        if(typeof delta.content==='string'){content+=delta.content;opts.onText?.(content);}
        for(const t of delta.tool_calls||[]) {
          const key=t.index??0, x=toolMap.get(key)||{id:'',type:'function',function:{name:'',arguments:''}};
          if(t.id)x.id=t.id;
          if(t.function?.name)x.function.name+=t.function.name;
          if(t.function?.arguments)x.function.arguments+=t.function.arguments;
          toolMap.set(key,x);
        }
      }
    }
    while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});
      const mark=/\r?\n\r?\n/g;let last=0,m,limit=0;
      while((m=mark.exec(pending))){limit=m.index+m[0].length;}
      if(limit){consume(pending.slice(0,limit));pending=pending.slice(limit);}
      if(pending.length>1e6)throw new Error('SSE event too large');
    }
    if(pending.trim())consume(pending+'\n\n');
    return {role:'assistant',content:content||null,...(toolMap.size?{tool_calls:[...toolMap.entries()].sort((a,b)=>a[0]-b[0]).map(([,v])=>v)}:{})};
  } finally {clearTimeout(timer);}
}
module.exports={chatCompletion,endpoint,parseToolArguments};
