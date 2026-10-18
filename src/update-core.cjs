'use strict';
function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!m) return null;
  const parts=m.slice(1,4).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function isNewer(candidate,current) {
  const a=parseVersion(candidate), b=parseVersion(current);
  if(!a||!b)return false;
  for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}
  return false;
}
function parseRepository(value) {
  if(typeof value!=='string')return null;
  let text=value.trim().replace(/^https:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/\/$/,'');
  const match=/^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})$/.exec(text);
  return match&&match[2]!=='.'&&match[2]!=='..' ? text : null;
}
function isReleaseUrl(value,repo) {
  if(typeof value!=='string'||!parseRepository(repo))return false;
  try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.startsWith('/'+repo+'/releases/download/')&&u.pathname.split('/').length===7&&!u.pathname.includes('..');}catch{return false;}
}
function parseRelease(raw,current,repo) {
  if(!parseRepository(repo)||!raw||raw.draft||raw.prerelease||!isNewer(raw.tag_name,current))return null;
  const version=parseVersion(raw.tag_name).join('.');
  const filename=`FuPanTai-Setup-${version}-x64.exe`;
  const assets=Array.isArray(raw.assets)?raw.assets:[];
  const find=name=>{const a=assets.find(x=>x&&x.name===name&&isReleaseUrl(x.browser_download_url,repo));return a&&Number.isFinite(a.size)&&a.size>0&&a.size<600*1024*1024?{name:a.name,url:a.browser_download_url,size:a.size}:null;};
  const asset=find(filename),checksum=find('SHA256SUMS.txt');
  let pageUrl=`https://github.com/${repo}/releases/latest`;
  try{const u=new URL(raw.html_url);if(u.protocol==='https:'&&u.hostname==='github.com'&&u.pathname.startsWith('/'+repo+'/releases/tag/')&&!u.username&&!u.password)pageUrl=u.href;}catch{}
  return {version,name:String(raw.name||`复盘台 ${version}`).slice(0,180),notes:String(raw.body||'此版本没有填写更新说明。').slice(0,12000),pageUrl,asset,checksum,downloadable:!!(asset&&checksum)};
}
function parseChecksum(text,filename) {
  if(typeof text!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]*\.exe$/.test(filename))return null;
  for(const line of text.split(/\r?\n/)){
    const m=/^([a-fA-F0-9]{64})\s+\*?([^\s]+)\s*$/.exec(line);
    if(m&&m[2]===filename)return m[1].toLowerCase();
  }
  return null;
}
module.exports={parseVersion,isNewer,parseRepository,parseRelease,parseChecksum,isReleaseUrl};
