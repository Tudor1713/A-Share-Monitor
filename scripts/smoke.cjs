const {_electron}=require('playwright');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');
(async()=>{
 const root=path.join(__dirname,'..'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'fupantai-smoke-')),shots=process.env.FUPANTAI_SCREENSHOTS||path.join(root,'test-results');await fs.mkdir(shots,{recursive:true});
 const repo=require('../release-source.json').repository;
 const fixture={tag_name:'v2.0.0',name:'复盘台 2.0.0 · 通知功能验证',body:'这是自动化测试使用的模拟新版本，不是公开发布版本。\n\n• 新版通知会在软件内显示\n• 下载前会校验安装包完整性',assets:[],html_url:`https://github.com/${repo}/releases/tag/v2.0.0`};
 const executablePath=process.env.FUPANTAI_EXE||require('electron');const args=process.env.FUPANTAI_EXE?['--smoke-test']:[root,'--smoke-test'];
 const child=await _electron.launch({executablePath,args,env:{...process.env,FUPANTAI_TEST_PROFILE:profile,FUPANTAI_TEST_RELEASE:JSON.stringify(fixture)},timeout:45000});
 const errors=[];let page;
 try{
   page=await child.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('.fp-version').waitFor({timeout:45000});
   assert.equal(await page.locator('.rail-item').count(),4);assert.equal(await page.evaluate(()=>RD.sections.reduce((n,s)=>n+s.views.length,0)),18);
   assert.deepEqual(await child.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation,sandbox:p.sandbox,webSecurity:p.webSecurity};}),{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true});
   assert.equal(await page.evaluate(()=>typeof window.require),'undefined');assert.equal(await page.evaluate(()=>typeof window.process),'undefined');
   await page.locator('.fp-banner').waitFor({timeout:15000});await page.getByRole('button',{name:'查看更新',exact:true}).click();
   const modal=page.getByRole('dialog',{name:'软件更新',exact:true});await modal.waitFor();assert.match(await modal.innerText(),/2.0.0/);assert.equal(await modal.getByRole('button',{name:'下载安装包',exact:true}).count(),0);
   await page.screenshot({path:path.join(shots,'更新通知-模拟版本.png'),animations:'disabled'});
   await modal.getByRole('checkbox').uncheck();assert.equal(await modal.getByRole('checkbox').isChecked(),false);
   await page.keyboard.press('Escape');assert.equal(await modal.count(),0);
   await page.getByRole('button',{name:'择股',exact:true}).click();await page.getByRole('tab',{name:'百日新高',exact:true}).click();await page.getByRole('button',{name:'择时',exact:true}).click();await page.getByRole('button',{name:'择股',exact:true}).click();assert.match(page.url(),/selection\/newhigh$/);
   await page.getByRole('button',{name:'择时',exact:true}).click();await page.getByRole('tab',{name:'情绪周期',exact:true}).click();
   await page.locator('.fp-banner .btn').last().click().catch(()=>{});
   await page.locator('.emotion-metrics tbody tr').nth(9).waitFor({timeout:45000});
   await page.screenshot({path:path.join(shots,'Windows软件界面.png'),animations:'disabled'});
   assert.equal(errors.length,0,errors.join('\n'));
   console.log(JSON.stringify({executable:executablePath,installed:!!process.env.FUPANTAI_EXE,sections:4,views:18,updateNotice:'pass',autoCheckPreference:'pass',navigation:'pass',sandbox:'pass',pageErrors:errors,screenshotDirectory:shots},null,2));
 }finally{await child.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
