'use strict';
const {app,BrowserWindow,Menu,ipcMain,shell,dialog,Notification,session}=require('electron');
const fs=require('node:fs');const fsp=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');const {pathToFileURL}=require('node:url');
const {UpdateService}=require('./update-service.cjs');const {readLimited,downloadVerified}=require('./download.cjs');const {parseRepository}=require('./update-core.cjs');
const source=require('../release-source.json');
const SMOKE=process.argv.includes('--smoke-test');
if(SMOKE&&process.env.FUPANTAI_TEST_PROFILE)app.setPath('userData',path.resolve(process.env.FUPANTAI_TEST_PROFILE));
app.setName('复盘台');app.setAppUserModelId('io.github.tudor1713.fupantai');
let win,updater,timer,startTimer,downloadPromise,downloaded=null;
const html=path.join(__dirname,'../app/dashboard.html'),fileUrl=pathToFileURL(html).href;
const repo=parseRepository(source.repository);if(!repo)throw new Error('Invalid release repository configuration');
function readSettings(){try{const s=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'desktop-settings.json'),'utf8'));return s&&typeof s==='object'?s:{};}catch{return {};}}
function saveSettings(value){const target=path.join(app.getPath('userData'),'desktop-settings.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',JSON.stringify(value,null,2));fs.renameSync(target+'.tmp',target);}
async function getRelease(repository){
  if(SMOKE&&process.env.FUPANTAI_TEST_RELEASE)return JSON.parse(process.env.FUPANTAI_TEST_RELEASE);
  const response=await fetch(`https://api.github.com/repos/${repository}/releases/latest`,{headers:{'Accept':'application/vnd.github+json','User-Agent':'FuPanTai-Desktop/'+app.getVersion(),'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});
  if(response.status===404)return null;
  return JSON.parse(await readLimited(response,2*1024*1024));
}
function validSender(event){if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==fileUrl)throw new Error('Unsupported sender');}
function showUpdates(){if(!win)return;if(win.isMinimized())win.restore();win.show();win.focus();win.webContents.send('updates:open');}
function sendState(){if(win&&!win.isDestroyed())win.webContents.send('updates:state',updater.snapshot());}
function setupIpc(){
  ipcMain.handle('updates:get',e=>{validSender(e);return updater.snapshot();});
  ipcMain.handle('updates:check',async e=>{validSender(e);if(downloadPromise)return updater.snapshot();return updater.check({manual:true});});
  ipcMain.handle('updates:auto',(e,enabled)=>{validSender(e);if(typeof enabled!=='boolean')throw new Error('Invalid preference');return updater.setAutoCheck(enabled);});
  ipcMain.handle('updates:release',async e=>{validSender(e);await shell.openExternal(updater.state.latest?.pageUrl||`https://github.com/${repo}/releases/latest`);});
  ipcMain.handle('updates:download',async e=>{
    validSender(e);if(downloadPromise)return downloadPromise;
    const release=updater.snapshot().latest;if(!release?.downloadable)throw new Error('该版本没有提供可校验的安装包，请打开版本页面。');
    updater.update({status:'downloading',progress:0,message:'正在下载新版安装包…'});
    downloadPromise=(async()=>{
      try{downloaded=await downloadVerified(release,{repo,directory:path.join(app.getPath('userData'),'updates'),onProgress:progress=>updater.update({progress})});updater.update({status:'downloaded',progress:100,message:'安装包已下载并通过 SHA-256 校验。'});}
      catch(error){downloaded=null;updater.update({status:'download-error',message:/校验|不可信|过大|HTTP/.test(error.message)?error.message:'下载失败，请检查网络后重试。'});}
      finally{downloadPromise=null;}
      return updater.snapshot();
    })();return downloadPromise;
  });
  ipcMain.handle('updates:install',async e=>{
    validSender(e);if(!downloaded||updater.state.status!=='downloaded')throw new Error('尚无已校验的安装包');
    const answer=await dialog.showMessageBox(win,{type:'question',title:'安装复盘台更新',message:`安装复盘台 ${updater.state.latest.version}？`,detail:'软件会退出并打开 Windows 安装程序。你的自选与本机缓存会保留。',buttons:['安装并退出','稍后'],defaultId:1,cancelId:1,noLink:true});
    if(answer.response!==0)return false;
    const data=await fsp.readFile(downloaded.path);if(crypto.createHash('sha256').update(data).digest('hex')!==downloaded.sha256)throw new Error('安装包校验失败，请重新下载');
    const error=await shell.openPath(downloaded.path);if(error)throw new Error('无法启动安装程序，请打开版本页面下载。');app.quit();return true;
  });
}
function setupMenu(){Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'软件',submenu:[{label:'检查更新…',accelerator:'CmdOrCtrl+Shift+U',click:()=>{showUpdates();if(!downloadPromise)updater.check({manual:true});}},{type:'separator'},{label:'打开 GitHub 开源仓库',click:()=>shell.openExternal(`https://github.com/${repo}`)},{type:'separator'},{label:'退出',role:'quit'}]},
  {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
  {label:'视图',submenu:[{role:'reload',label:'重新载入页面'},{type:'separator'},{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{type:'separator'},{role:'togglefullscreen',label:'全屏'}]},
  {label:'帮助',submenu:[{label:'关于复盘台',click:()=>dialog.showMessageBox(win,{type:'info',title:'关于复盘台',message:`复盘台 ${app.getVersion()}`,detail:'择时 · 择股 · 大势 · 资讯\n开源协议：MIT\n更新来源：'+repo+'\n启动后与运行期间检查新版，软件关闭时不接收通知。'})},{label:'反馈问题',click:()=>shell.openExternal(`https://github.com/${repo}/issues`)}]}
]));}
async function createWindow(){
  win=new BrowserWindow({width:1440,height:950,minWidth:1040,minHeight:680,backgroundColor:'#f4f6f8',title:'复盘台',icon:path.join(__dirname,'../assets/icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false}});
  win.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password)shell.openExternal(u.href);}catch{}return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==fileUrl)event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.once('ready-to-show',()=>win.show());
  win.on('closed',()=>{win=null;});
  await win.loadFile(html);
}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
app.whenReady().then(async()=>{
  const settings=readSettings();if(settings.autoCheck===undefined)settings.autoCheck=source.autoCheck!==false;
  const currentVersion=SMOKE&&process.env.FUPANTAI_TEST_VERSION||app.getVersion();
  updater=new UpdateService({currentVersion,repo,settings,getRelease,persist:saveSettings,intervalHours:source.checkIntervalHours});
  updater.on('state',sendState);
  updater.on('notify',latest=>{if(Notification.isSupported()){const n=new Notification({title:'复盘台有新版本',body:`${latest.version} 已发布，点击查看更新说明。`,icon:path.join(__dirname,'../assets/icon.png')});n.on('click',showUpdates);n.show();}});
  session.defaultSession.setPermissionRequestHandler((_wc,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
  session.defaultSession.setPermissionCheckHandler((_wc,permission)=>permission==='clipboard-sanitized-write');
  setupIpc();setupMenu();await createWindow();
  startTimer=setTimeout(()=>updater.check(),SMOKE?500:10000);timer=setInterval(()=>updater.check(),source.checkIntervalHours*3600000);
}).catch(error=>{dialog.showErrorBox('复盘台启动失败','请重新安装软件，或在 GitHub Issues 反馈。\n'+error.message);app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{clearInterval(timer);clearTimeout(startTimer);});
}
