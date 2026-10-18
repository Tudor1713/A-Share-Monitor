'use strict';
const {EventEmitter}=require('node:events');
const {parseRelease,parseRepository}=require('./update-core.cjs');
class UpdateService extends EventEmitter {
  constructor({currentVersion,repo,settings={},getRelease,persist=()=>{},clock=()=>Date.now(),intervalHours=6}) {
    super();if(!parseRepository(repo))throw new Error('无效的更新仓库');
    this.settings=settings;this.getRelease=getRelease;this.persist=persist;this.clock=clock;this.pending=null;
    this.intervalMs=Math.max(1,Math.min(24,intervalHours))*3600000;
    this.state={status:'idle',currentVersion,repo,latest:null,progress:0,lastChecked:settings.lastChecked||null,autoCheck:settings.autoCheck!==false,message:''};
  }
  snapshot(){return structuredClone(this.state);}
  update(patch){Object.assign(this.state,patch);this.emit('state',this.snapshot());return this.snapshot();}
  save(){this.persist({...this.settings});}
  setAutoCheck(value){this.settings.autoCheck=!!value;this.save();return this.update({autoCheck:!!value});}
  check({manual=false}={}) {
    if(this.pending)return this.pending;
    if(!manual&&(!this.state.autoCheck||(this.state.lastChecked&&this.clock()-this.state.lastChecked<this.intervalMs)))return Promise.resolve(this.snapshot());
    this.update({status:'checking',message:'正在检查 GitHub 最新版本…',manual});
    this.pending=(async()=>{
      try {
        const raw=await this.getRelease(this.state.repo);
        const latest=parseRelease(raw,this.state.currentVersion,this.state.repo);
        this.settings.lastChecked=this.clock();this.save();
        this.update({status:latest?'available':'current',latest,lastChecked:this.settings.lastChecked,message:latest?`发现新版本 ${latest.version}`:'当前已是最新正式版本。'});
        if(latest&&this.settings.notifiedVersion!==latest.version){this.settings.notifiedVersion=latest.version;this.save();this.emit('notify',latest);}
      } catch {
        this.update({status:'error',message:'暂时无法检查更新，请确认网络连接后重试。'});
      } finally {this.pending=null;}
      return this.snapshot();
    })();
    return this.pending;
  }
}
module.exports={UpdateService};
