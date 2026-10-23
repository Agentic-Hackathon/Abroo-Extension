'use strict';
const KEY='abroo.session.v2';
const MAX_EVENTS=100;
const MAX_MESSAGES=60;
const MAX_ENTRY_CHARS=3500;
function sanitizeString(s){return String(s).slice(0,MAX_ENTRY_CHARS);}
function cleanEvent(e,redact){
  if(!e || !['message','note','error','chart','toolRunning','toolResult','mcpStatus','formSummary','approvalSummary'].includes(e.type))return null;
  let out={type:e.type};
  for(const k of ['role','text','message','name','result','title','status'])if(typeof e[k]==='string')out[k]=sanitizeString(redact(e[k]));
  if(e.type==='chart'){
    out.chartType=e.chartType==='bar'?'bar':'line';out.unit=sanitizeString(e.unit||'');out.labels=Array.isArray(e.labels)?e.labels.slice(0,250).map(sanitizeString):[];
    out.series=Array.isArray(e.series)?e.series.slice(0,5).map(s=>({name:sanitizeString(s.name||''),values:Array.isArray(s.values)?s.values.slice(0,250).map(v=>typeof v==='number'&&Number.isFinite(v)?v:null):[]})):[];
  }
  return out;
}
function cleanConversation(conversation, redact){
  // Only complete user / assistant text turns survive reload. Keeping raw tool
  // messages (or orphaned tool_calls) could leak secrets or break OpenAI history.
  const out=[];
  for(const m of conversation.slice(-MAX_MESSAGES)){
    if(!m || !['user','assistant'].includes(m.role) || typeof m.content!=='string' || !m.content.trim())continue;
    out.push({role:m.role,content:sanitizeString(redact(m.content))});
  }
  return out;
}
function restore(data){if(!data||data.version!==2)return {events:[],history:[]};return {events:Array.isArray(data.events)?data.events.slice(-MAX_EVENTS):[],history:Array.isArray(data.history)?data.history.slice(-MAX_MESSAGES):[]};}
function snapshot(events,history,redact){return {version:2,events:events.slice(-MAX_EVENTS).map(e=>cleanEvent(e,redact)).filter(Boolean),history:cleanConversation(history,redact)};}
module.exports={KEY,restore,snapshot,cleanEvent,cleanConversation};
