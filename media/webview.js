(function(){
'use strict';
const vscode=acquireVsCodeApi();
const $=id=>document.getElementById(id);
const messageArea=$('messages');let busy=false,assistantNodes=new Map(),direction='auto',followBottom=true,toolSettings={servers:[]};
const scrollButton=$('scrollBottom');
messageArea.addEventListener('scroll',()=>{followBottom=messageArea.scrollHeight-messageArea.scrollTop-messageArea.clientHeight<85;scrollButton.hidden=followBottom;});
scrollButton.onclick=()=>{followBottom=true;messageArea.scrollTop=messageArea.scrollHeight;scrollButton.hidden=true;};
const send=(type,data={})=>vscode.postMessage({type,...data});
const elem=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
const scroll=()=>{if(followBottom){messageArea.scrollTop=messageArea.scrollHeight;scrollButton.hidden=true;}else{scrollButton.hidden=false;}};
function hideWelcome(){messageArea.querySelector('.welcome')?.remove();}
function setDir(x){if(!x)return;const s=x.textContent||'';const first=s.match(/[\u0600-\u06ff]|[A-Za-z]/);x.dir=direction==='auto'?(first&&/[\u0600-\u06ff]/.test(first[0])?'rtl':'ltr'):direction;}
function inlineMarkdown(root,str){
  const re=/(\*\*([^*]+)\*\*|`([^`]+)`)/g;let last=0,m;
  while((m=re.exec(str))){if(m.index>last)root.appendChild(document.createTextNode(str.slice(last,m.index)));
    const el=elem(m[3]?'code':'strong','',m[3]||m[2]);root.appendChild(el);last=m.index+m[0].length;
  }
  if(last<str.length)root.appendChild(document.createTextNode(str.slice(last)));
}
function formatMessage(bubble,text){
  bubble.replaceChildren();const lines=String(text||'').split('\n');let code=false,pre=null,list=null;
  for(const line of lines){
    if(line.trimStart().startsWith('```')){if(!code){pre=elem('pre');const c=elem('code');pre.appendChild(c);bubble.appendChild(pre);}code=!code;list=null;continue;}
    if(code){pre.querySelector('code').appendChild(document.createTextNode(line+'\n'));continue;}
    if(/^\s*[-*]\s+/.test(line)) {if(!list){list=elem('ul');bubble.appendChild(list);}const li=elem('li');inlineMarkdown(li,line.replace(/^\s*[-*]\s+/,''));list.appendChild(li);continue;}
    list=null;
    if(!line.trim()){bubble.appendChild(elem('p','markdown-line',''));continue;}
    let node;
    if(/^\s*#{1,3}\s+/.test(line)){node=elem('h3');inlineMarkdown(node,line.replace(/^\s*#{1,3}\s+/,''));}
    else{node=elem('p','markdown-line');inlineMarkdown(node,line);}
    setDir(node);bubble.appendChild(node);
  }
}
function bubble(role,text,id){
  hideWelcome();const wrapper=elem('div','msg '+role);const who=elem('span','who',role==='user'?'You':'Abroo');wrapper.appendChild(who);
  const b=elem('div','bubble');formatMessage(b,text);wrapper.appendChild(b);messageArea.appendChild(wrapper);scroll();
  if(id)assistantNodes.set(id,b);return wrapper;
}
function note(text,error=false){hideWelcome();const n=elem('div','note'+(error?' error':''),text);setDir(n);messageArea.appendChild(n);scroll();}
function activity(title){hideWelcome();const w=elem('section','activity');const h=elem('div','activity-header',title);setDir(h);w.appendChild(h);messageArea.appendChild(w);scroll();return w;}
const activeRequests=new Set();
function approval(m){if(activeRequests.has(m.id))return;activeRequests.add(m.id);const w=activity('🔐 تأیید اجرای ابزار / Tool approval');
  const t=elem('p','',`${m.server}  →  ${m.tool}`);t.dir='ltr';w.appendChild(t);
  const explanation=elem('p','details','این درخواست توسط مدل پیشنهاد شده است و تا پیش از تأیید شما اجرا نمی‌شود. آرگومان‌ها را بررسی کنید.');w.appendChild(explanation);
  const pre=elem('pre','',JSON.stringify(m.args??{},null,2));w.appendChild(pre);
  const bar=elem('div','buttons');const no=elem('button','secondary','رد کردن / Deny');const yes=elem('button','primary','تأیید و اجرا / Approve');bar.append(no,yes);w.appendChild(bar);
  function finish(approved){no.disabled=yes.disabled=true;const v=elem('p',approved?'good':'bad',approved?'اجازهٔ اجرا داده شد؛ منتظر نتیجه…':'درخواست رد شد');w.appendChild(v);send('approval',{id:m.id,approved});}
  no.onclick=()=>finish(false);yes.onclick=()=>finish(true);w.dataset.requestId=m.id;scroll();
}
function form(m){if(activeRequests.has(m.id))return;activeRequests.add(m.id);const w=activity('▤ '+(m.title||'Interactive form'));
  if(m.description)w.appendChild(elem('p','details',m.description));
  const controls=new Map();
  for(const f of m.fields||[]){const container=elem('div','field'),label=elem('label','',f.label+(f.required?' *':''));container.appendChild(label);let control;
    if(f.type==='select'){control=elem('select');control.appendChild(new Option('— انتخاب کنید / Select —',''));for(const o of f.options||[])control.appendChild(new Option(o.label,o.value));}
    else if(f.type==='radio'){control=elem('div');for(const o of f.options||[]){const row=elem('label','field-row');const input=document.createElement('input');input.type='radio';input.name=m.id+'_'+f.id;input.value=o.value;row.append(input,document.createTextNode(o.label));control.appendChild(row);}}
    else if(f.type==='checkbox'){control=document.createElement('input');control.type='checkbox';}
    else if(f.type==='textarea'){control=elem('textarea');control.rows=3;control.placeholder=f.placeholder||'';}
    else{control=elem('input');control.type=f.type==='number'?'number':'text';control.placeholder=f.placeholder||'';}
    if(f.type==='select'||f.type==='text'||f.type==='number'||f.type==='textarea')control.dir=f.type==='number'?'ltr':'auto';
    container.appendChild(control);w.appendChild(container);controls.set(f.id,{control,field:f});
  }
  const feedback=elem('div','bad small');w.appendChild(feedback);
  const bar=elem('div','buttons'),cancel=elem('button','secondary','انصراف / Cancel'),submit=elem('button','primary','ثبت انتخاب / Submit');bar.append(cancel,submit);w.appendChild(bar);
  function disable(){submit.disabled=cancel.disabled=true;for(const {control} of controls.values()){control.disabled=true;control.querySelectorAll?.('input').forEach(e=>e.disabled=true);}}
  cancel.onclick=()=>{disable();send('form',{id:m.id,cancelled:true});w.appendChild(elem('p','details','Cancelled'));};
  submit.onclick=()=>{
    const values={};feedback.textContent='';
    for(const [id,{control,field:f}] of controls){
      let v=f.type==='checkbox'?control.checked:f.type==='radio'?control.querySelector('input:checked')?.value||'':f.type==='number'?control.value===''?'':Number(control.value):control.value;
      if(f.required&&(v===''||v===null||v===undefined)){feedback.textContent='لطفاً فیلدهای ضروری را تکمیل کنید.';return;}
      values[id]=v;
    }
    disable();w.appendChild(elem('p','good','انتخاب ثبت شد / Submitted'));send('form',{id:m.id,values});
  };
  w.dataset.requestId=m.id;scroll();
}
const colors=['#42beb2','#729bfa','#f2bb65','#d58af0','#f37d89','#8fc46a'];
const NS='http://www.w3.org/2000/svg';
function svg(tag,attrs={}){const x=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))x.setAttribute(k,String(v));return x;}
function chart(data){
  const w=elem('section','chart');const top=elem('div','chart-top'),name=elem('div','chart-title',data.title||'Chart'),choice=elem('select');
  [['all','All'],['10','Last 10'],['30','Last 30'],['100','Last 100']].forEach(([v,t])=>choice.appendChild(new Option(t,v)));top.append(name,choice);w.appendChild(top);
  const viewport=elem('div','chart-viewport'),canvas=svg('svg',{viewBox:'0 0 360 190',role:'img','aria-label':data.title||'Chart'});viewport.appendChild(canvas);w.appendChild(viewport);
  const legend=elem('div','legend'),enabled=data.series.map(()=>true),tip=elem('div','tip');
  data.series.forEach((s,i)=>{const label=elem('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;check.onchange=()=>{enabled[i]=check.checked;render()};const color=elem('span','', '●');color.style.color=colors[i%colors.length];label.append(check,color,document.createTextNode(s.name));legend.appendChild(label);});w.append(legend,tip);choice.onchange=render;
  function render(){
    canvas.replaceChildren();const maxCount=choice.value==='all'?data.labels.length:Number(choice.value),start=Math.max(0,data.labels.length-maxCount),labels=data.labels.slice(start),series=data.series.map((s,i)=>({...s,values:s.values.slice(start),i})).filter(s=>enabled[s.i]);
    const numbers=series.flatMap(s=>s.values.filter(x=>typeof x==='number'&&Number.isFinite(x)));
    if(!numbers.length){tip.textContent='No finite values';return;}
    let lo=Math.min(...numbers),hi=Math.max(...numbers);if(lo===hi){lo-=1;hi+=1;}
    const left=49,right=346,top=12,bottom=153,dx=right-left,height=bottom-top;
    const x=i=>left+dx*(labels.length===1?.5:i/(labels.length-1));const y=v=>bottom-(v-lo)/(hi-lo)*height;
    for(let k=0;k<=4;k++){
      const v=lo+(hi-lo)*k, yy=y(v);canvas.appendChild(svg('line',{x1:left,x2:right,y1:yy,y2:yy,stroke:'var(--line)', 'stroke-width':.6}));const t=svg('text',{x:left-5,y:yy+3,'text-anchor':'end'});t.textContent=(Math.abs(v)>=1000?v.toFixed(0):v.toFixed(2));canvas.appendChild(t);
    }
    [0,Math.floor((labels.length-1)/2),labels.length-1].filter((v,i,a)=>a.indexOf(v)===i).forEach(i=>{const t=svg('text',{x:x(i),y:171,'text-anchor':'middle'});const label=labels[i]||'';t.textContent=label.length>15?label.slice(0,12)+'…':label;canvas.appendChild(t);});
    for(const s of series){const color=colors[s.i%colors.length];
      if(data.chartType==='bar'){
        const width=Math.max(1,dx/Math.max(labels.length,1)*0.7/Math.max(series.length,1));let group=series.findIndex(z=>z.i===s.i);
        s.values.forEach((v,i)=>{if(v===null) return;const bottomZero=Math.max(top,Math.min(bottom,y(Math.max(lo,Math.min(hi,0)))));const vY=y(v);const rect=svg('rect',{x:x(i)-(series.length*width)/2+group*width,y:Math.min(vY,bottomZero),width,height:Math.max(1,Math.abs(bottomZero-vY)),fill:color,opacity:.8});canvas.appendChild(rect);});
      }else{
        let d='';s.values.forEach((v,i)=>{if(v===null){d+=' ';return;}d+=(i===0||s.values[i-1]===null?'M':'L')+x(i)+' '+y(v)+' ';});canvas.appendChild(svg('path',{d,fill:'none',stroke:color,'stroke-width':2,'stroke-linejoin':'round'}));
      }
    }
    const hit=svg('rect',{x:left,y:top,width:dx,height,fill:'transparent'});
    hit.addEventListener('pointermove',e=>{
      const p=canvas.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const c=canvas.getScreenCTM();if(!c)return;const coord=p.matrixTransform(c.inverse());const ix=Math.max(0,Math.min(labels.length-1,Math.round((coord.x-left)/dx*(labels.length-1))));
      tip.textContent=labels[ix]+'  ·  '+series.map(s=>s.name+': '+(s.values[ix]===null?'—':s.values[ix])+(data.unit||'')).join('  |  ');
    });canvas.appendChild(hit);
    tip.textContent=labels.length+' observations · '+(data.unit||'');
  }
  render();hideWelcome();messageArea.appendChild(w);scroll();
}
$('send').onclick=()=>{const text=$('prompt').value.trim();if(!text||busy)return;followBottom=true;$('prompt').value='';send('send',{text});scroll();};
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('send').click();}};
$('stop').onclick=()=>send('stop');$('new').onclick=()=>send('new');$('settings').onclick=()=>showPanel('tools');$('reconnect').onclick=()=>send('reconnect');$('model').onchange=()=>send('selectModel',{name:$('model').value});
$('backToChat').onclick=()=>showPanel('chat');$('openJson').onclick=()=>send('openConfig');$('reconnectTools').onclick=()=>send('reconnect');$('searchTools').oninput=renderToolSettings;
function showPanel(name){$('chatPanel').hidden=name!=='chat';$('toolsPanel').hidden=name!=='tools';if(name==='chat')scroll();else renderToolSettings();}
function renderToolSettings(){
  const root=$('toolsList');root.replaceChildren();const filter=$('searchTools').value.trim().toLowerCase();
  for(const server of toolSettings.servers||[]){
    const section=elem('section','server-card');
    const header=elem('div','server-head');const serverTitle=elem('strong','',server.name);serverTitle.dir='ltr';
    const status=elem('span','server-state '+(server.state==='ready'?'good':'muted'),server.state||'unknown');
    const serverToggle=document.createElement('input');serverToggle.type='checkbox';serverToggle.checked=server.enabled!==false;serverToggle.setAttribute('aria-label','Enable server '+server.name);
    serverToggle.onchange=()=>send('setServerEnabled',{server:server.name,enabled:serverToggle.checked});
    header.append(serverTitle,status,serverToggle);section.appendChild(header);
    const items=(server.tools||[]).filter(t=>!filter||(t.name+' '+t.description+' '+server.name).toLowerCase().includes(filter));
    section.appendChild(elem('p','muted small',`${server.tools.length} tools · ${server.state==='ready'?'Connected':server.enabled?'Disconnected':'Disabled'}`));
    for(const tool of items){
      const row=elem('div','tool-row');const summary=elem('div','tool-summary');
      const code=elem('code','',tool.name);const desc=elem('p','muted small',tool.description||'');summary.append(code,desc);
      const select=elem('select','policy');select.setAttribute('aria-label','Tool policy '+tool.name);
      for(const [value,label] of [['automatic','Automatic'],['ask','Ask First'],['disabled','Disabled']]){
        const option=new Option(label,value);if(value==='automatic'&&!tool.canAuto)option.disabled=true;select.appendChild(option);
      }
      select.value=tool.policy||'ask';select.onchange=()=>send('setToolPolicy',{server:server.name,tool:tool.name,policy:select.value});
      row.append(summary,select);section.appendChild(row);
    }
    if(filter&&!items.length)continue;
    if(server.state!=='ready')section.appendChild(elem('p','bad small','For connection errors, open Output → Abroo MCP.'));
    root.appendChild(section);
  }
  if(!root.childElementCount)root.appendChild(elem('p','muted','ابزاری پیدا نشد. / No matching tools.'));
}

$('direction').onclick=()=>{direction=direction==='auto'?'rtl':direction==='rtl'?'ltr':'auto';document.body.dataset.dir=direction;$('direction').title='Direction: '+direction;send('direction',{value:direction});};
window.addEventListener('message',event=>{
  const m=event.data;if(!m||!m.type)return;
  switch(m.type){
    case 'restore':{
      messageArea.replaceChildren();assistantNodes.clear();activeRequests.clear();followBottom=true;
      const events=Array.isArray(m.events)?m.events:[];
      if(!events.length){messageArea.appendChild(elem('div','welcome','گفت‌وگو را شروع کنید / Start a conversation'));break;}
      for(const e of events){
        if(e.type==='message')bubble(e.role,e.text);
        else if(e.type==='chart')chart(e);
        else if(e.type==='error')note('⚠ '+e.message,true);
        else if(e.type==='mcpStatus')note(e.name+': '+e.message,true);
        else if(e.type==='note')note(e.text);
        else if(e.type==='toolResult')note('✓ '+e.name+' · '+String(e.result||'').slice(0,260));
        else if(e.type==='toolRunning')note('⏳ '+e.name);
        else if(e.type==='formSummary')note('▤ '+e.title+' · '+e.status);
        else if(e.type==='approvalSummary')note('🔐 '+e.title);
      }
      scroll();break;
    }
    case 'toolSettings':toolSettings=m;renderToolSettings();break;
    case 'direction':direction=m.value||'auto';document.body.dataset.dir=direction;break;
    case 'config':{
      const select=$('model');select.replaceChildren();(m.models||[]).forEach(s=>select.appendChild(new Option(s,s)));select.value=m.name||'';
      direction=m.direction||'auto';document.body.dataset.dir=direction;$('direction').title='Direction: '+direction;
      const errors=m.errors||[];$('status').textContent=`MCP: ${m.tools||0} tools${errors.length?' · '+errors.join(' | '):' · ready'}`;$('status').classList.toggle('error',!!errors.length);
      break;
    }
    case 'mcpStatus':note(`${m.name}: ${m.message}`,true);break;
    case 'message':bubble(m.role,m.text);break;
    case 'assistantStart':bubble('assistant','',m.id);break;
    case 'assistantDelta':{const b=assistantNodes.get(m.id);if(b){formatMessage(b,m.text);scroll();}break;}
    case 'assistantDone':{const b=assistantNodes.get(m.id);if(b){formatMessage(b,m.text||'');if(!(m.text||'').trim())b.closest('.msg')?.remove();assistantNodes.delete(m.id);}break;}
    case 'error':note('⚠ '+m.message,true);break;
    case 'note':note(m.text);break;
    case 'toolRunning':note('⏳ Running '+m.name);break;
    case 'toolResult':note('✓ '+m.name+' · '+String(m.result||'').slice(0,260));break;
    case 'approvalRequest':approval(m);break;
    case 'formRequest':form(m);break;
    case 'chart':chart(m);break;
    case 'requestClosed':{activeRequests.delete(m.id);const x=[...document.querySelectorAll('[data-request-id]')].find(e=>e.dataset.requestId===m.id);if(x){x.querySelectorAll('button,input,select,textarea').forEach(c=>c.disabled=true);x.appendChild(elem('div','details','Request closed'));}break;}
    case 'cleared':messageArea.replaceChildren();assistantNodes.clear();activeRequests.clear();followBottom=true;note('New conversation');break;
    case 'busy':busy=m.value;$('send').disabled=busy;$('stop').hidden=!busy;break;
  }
});
send('ready');
})();
