'use strict';
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const {isReleaseUrl,parseChecksum}=require('./update-core.cjs');
const MAX_INSTALLER=600*1024*1024;
async function readLimited(response,limit) {
  if(!response.ok)throw new Error('服务器返回 HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>limit)throw new Error('响应内容过大');
  const reader=response.body?.getReader();if(!reader)return '';
  let count=0;const parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>limit)throw new Error('响应内容过大');parts.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return Buffer.concat(parts).toString('utf8');
}
async function trustedFetch(url,{fetcher=fetch,timeoutMs=30000}={}) {
  let next=url;
  for(let i=0;i<6;i++){
    const response=await fetcher(next,{redirect:'manual',signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'FuPanTai-Desktop','Accept':'application/octet-stream'}});
    if(![301,302,303,307,308].includes(response.status))return response;
    const target=new URL(response.headers.get('location'),next);
    if(target.protocol!=='https:'||target.username||target.password||target.port||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com'].includes(target.hostname))throw new Error('不可信的下载重定向');
    await response.body?.cancel();next=target.href;
  }
  throw new Error('下载重定向过多');
}
async function downloadVerified(release,{repo,directory,fetcher=fetch,onProgress=()=>{}}) {
  const asset=release?.asset,checksum=release?.checksum;
  if(!release?.downloadable||!asset||!checksum||!/^FuPanTai-Setup-\d+\.\d+\.\d+-x64\.exe$/.test(asset.name)||!isReleaseUrl(asset.url,repo)||!isReleaseUrl(checksum.url,repo))throw new Error('无效或不可信的安装包地址');
  const sum=await readLimited(await trustedFetch(checksum.url,{fetcher}),128*1024);
  const expected=parseChecksum(sum,asset.name);if(!expected)throw new Error('发行文件缺少安装包校验值');
  await fs.mkdir(directory,{recursive:true});
  const target=path.join(directory,asset.name),partial=target+'.partial';let handle;
  try {
    const response=await trustedFetch(asset.url,{fetcher,timeoutMs:10*60*1000});
    if(!response.ok)throw new Error('下载失败 HTTP '+response.status);
    if(Number(response.headers.get('content-length'))>MAX_INSTALLER)throw new Error('安装包过大');
    if(!response.body)throw new Error('安装包内容为空');
    handle=await fs.open(partial,'w');const hash=crypto.createHash('sha256');const reader=response.body.getReader();let size=0,last=-1;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_INSTALLER)throw new Error('安装包过大');hash.update(value);await handle.write(value);const pct=asset.size?Math.min(99,Math.floor(size/asset.size*100)):0;if(pct!==last){last=pct;onProgress(pct);}}}finally{reader.releaseLock();}
    await handle.close();handle=null;
    if(!size||hash.digest('hex')!==expected||(asset.size&&asset.size!==size))throw new Error('安装包校验失败，请重新下载');
    await fs.unlink(target).catch(e=>{if(e.code!=='ENOENT')throw e;});await fs.rename(partial,target);onProgress(100);
    return {path:target,sha256:expected};
  }catch(error){if(handle)await handle.close();await fs.unlink(partial).catch(()=>{});throw error;}
}
module.exports={readLimited,downloadVerified,trustedFetch};
