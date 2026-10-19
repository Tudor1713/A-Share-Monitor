'use strict';
// No Node or IPC objects are exposed to the dashboard's main world.
const {ipcRenderer}=require('electron');
window.addEventListener('DOMContentLoaded',async()=>{
  const style=document.createElement('style');style.textContent=`
  .fp-version{display:block;width:100%;text-align:left;color:#b8cecb;font:11px/1.8 'Segoe UI','Microsoft YaHei UI',sans-serif;padding:7px 0;border:0;background:none;cursor:pointer}.fp-version:hover{color:#effaf6}
  .fp-overlay{position:fixed;inset:0;z-index:500;display:grid;place-items:center;padding:24px;background:rgb(10 23 25 / .45);backdrop-filter:blur(4px)}
  .fp-panel{width:min(570px,95vw);max-height:88vh;overflow:auto;border:1px solid var(--line);border-radius:16px;padding:26px;background:var(--panel);color:var(--ink);box-shadow:var(--shadow-2);font:14px/1.7 var(--f-sans)}
  .fp-panel header{display:flex;align-items:center;justify-content:space-between;gap:16px}.fp-panel h2{font-size:22px;line-height:1.4;letter-spacing:0}.fp-panel p{margin:10px 0;color:var(--ink3)}.fp-panel .fp-state{font-size:16px;font-weight:600;color:var(--ink);margin:20px 0 10px}
  .fp-notes{white-space:pre-wrap;overflow-wrap:anywhere;max-height:250px;overflow:auto;font-size:13px;line-height:1.9;padding:15px;background:var(--panel3);border-radius:9px;margin:14px 0}.fp-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:18px}.fp-auto{display:flex;align-items:center;gap:9px;margin-top:20px;font-size:12px;color:var(--ink2)}.fp-auto input{accent-color:var(--accent);width:16px;height:16px}.fp-panel .fp-tip{font-size:11px;line-height:1.8;margin:10px 0 0}
  .fp-progress{width:100%;accent-color:var(--accent);height:10px;margin-top:10px}.fp-banner{position:fixed;z-index:490;right:24px;bottom:24px;width:360px;max-width:calc(100vw - 32px);padding:19px 21px;border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px;background:var(--panel);color:var(--ink);box-shadow:var(--shadow-2);font:13px/1.7 var(--f-sans)}.fp-banner b{font-size:15px}.fp-banner p{color:var(--ink3);margin:6px 0 12px}.fp-banner .fp-row{margin-top:0}
  `;document.head.appendChild(style);
  let state=await ipcRenderer.invoke('updates:get'),overlay=null,trigger=null,previous=null,appWasInert=false,dismissedVersion='';
  function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,run,primary=false){const b=el('button',text,'btn'+(primary?' primary':''));b.type='button';b.dataset.action=text;b.addEventListener('click',event=>{if(event.isTrusted)Promise.resolve(run()).catch(()=>{state={...state,status:'error',message:'操作未完成，请稍后重试或打开版本页面。'};paint();});});return b;}
  function close(){if(!overlay)return;overlay.remove();overlay=null;const app=document.querySelector('.app');if(app)app.inert=appWasInert;if(previous?.isConnected)previous.focus({preventScroll:true});}
  function open(){if(!overlay){previous=document.activeElement;const app=document.querySelector('.app');appWasInert=app?.inert||false;if(app)app.inert=true;overlay=el('div',null,'fp-overlay');overlay.addEventListener('click',event=>{if(event.target===overlay)close();});document.body.appendChild(overlay);}paint();overlay.querySelector('button')?.focus();}
  function banner(){document.querySelector('.fp-banner')?.remove();if(!state.latest||!['available','downloaded','download-error'].includes(state.status)||dismissedVersion===state.latest.version||overlay)return;
    const n=el('aside',null,'fp-banner');n.setAttribute('aria-label','软件更新提醒');n.append(el('b','复盘台 '+state.latest.version+' 已发布'),el('p','查看更新内容，按需下载并安装新版本。'));const row=el('div',null,'fp-row');row.append(button('查看更新',open,true),button('稍后',()=>{dismissedVersion=state.latest.version;n.remove();}));n.append(row);document.body.appendChild(n);}
  function paint(){
    if(trigger)trigger.textContent=state.latest?'有新版本 · '+state.latest.version:'v'+state.currentVersion+' · 检查更新';
    if(!overlay){banner();return;}
    document.querySelector('.fp-banner')?.remove();
    const focused=overlay.contains(document.activeElement)?document.activeElement?.dataset.action:null;
    overlay.replaceChildren();const panel=el('section',null,'fp-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','fp-update-title');
    const head=el('header');const title=el('h2','软件更新');title.id='fp-update-title';const x=button('关闭',close);x.setAttribute('aria-label','关闭更新面板');head.append(title,x);panel.append(head,el('p','当前版本 v'+state.currentVersion+' · Windows x64'));
    const status=el('div',state.message||'检查是否有可用的新版本。','fp-state');status.setAttribute('role','status');panel.append(status);
    if(state.latest){panel.append(el('div',state.latest.name,'strong'),el('div',state.latest.notes,'fp-notes'));}
    if(state.status==='downloading'){const bar=el('progress',null,'fp-progress');bar.max=100;bar.value=state.progress;bar.setAttribute('aria-label','安装包下载进度');panel.append(bar,el('p',state.progress+'%'));}
    const row=el('div',null,'fp-row');const check=button('检查更新',()=>ipcRenderer.invoke('updates:check'));check.disabled=['checking','downloading'].includes(state.status);row.append(check);
    if(state.status==='downloaded')row.append(button('安装并退出',()=>ipcRenderer.invoke('updates:install'),true));
    else if(state.latest?.downloadable){const download=button(state.status==='download-error'?'重新下载':'下载安装包',()=>ipcRenderer.invoke('updates:download'),true);download.disabled=state.status==='downloading';row.append(download);}
    if(state.latest)row.append(button('打开版本页面',()=>ipcRenderer.invoke('updates:release')));
    panel.append(row);const auto=el('label',null,'fp-auto'),input=document.createElement('input');input.type='checkbox';input.checked=state.autoCheck;input.addEventListener('change',event=>{if(event.isTrusted)ipcRenderer.invoke('updates:auto',input.checked).catch(()=>{});});auto.append(input,document.createTextNode('自动检查更新（每 6 小时）'));panel.append(auto,el('p','启动后与运行期间检查 GitHub 正式版。关闭软件时不会接收提醒。','fp-tip'));overlay.append(panel);
    if(focused)overlay.querySelector(`[data-action="${focused}"]`)?.focus();
  }
  const foot=document.querySelector('.rail-foot');if(foot){trigger=button('v'+state.currentVersion+' · 检查更新',()=>{open();return ipcRenderer.invoke('updates:check');});trigger.className='fp-version';foot.append(trigger);}
  ipcRenderer.on('updates:state',(_event,next)=>{state=next;paint();});ipcRenderer.on('updates:open',open);
  window.addEventListener('keydown',event=>{if(!overlay)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab'){const nodes=Array.from(overlay.querySelectorAll('button:not(:disabled),input'));const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}},true);
  paint();
});
