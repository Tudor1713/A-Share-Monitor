const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),target=path.join(root,'app/dashboard.html');
let html=fs.readFileSync(process.argv[2]||target,'utf8');
if(/data-rd="(?:reviews|research|system)"|24-review\.js|复盘档案|今日复盘|研报库|交易系统/.test(html))throw new Error('输入文件仍包含已删除的板块，拒绝打包或公开。');
html=html.replace(/<meta id="desktop-csp"[^>]*>\s*/,'');
if(fs.existsSync(path.join(root,'assets/icon.png'))){const png=fs.readFileSync(path.join(root,'assets/icon.png')).toString('base64');html=html.replace(/<link rel="icon"[^>]*>/,'<link rel="icon" type="image/png" href="data:image/png;base64,'+png+'">');}
const scripts=Array.from(html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)).filter(m=>!/type="application\/json"/.test(m[1]));
const hashes=scripts.map(m=>"'sha256-"+crypto.createHash('sha256').update(m[2]).digest('base64')+"'");
const hosts=new Set();for(const script of scripts)for(const m of script[2].matchAll(/(?:https?:)?\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?=[/:'"`?\s])/g))hosts.add('https://'+m[1]);
const csp=["default-src 'none'",`script-src 'self' ${hashes.join(' ')} ${Array.from(hosts).sort().join(' ')}`,"style-src 'self' 'unsafe-inline'","connect-src https:","img-src 'self' data: https:","font-src 'self' data:","base-uri 'none'","object-src 'none'","frame-src 'none'","form-action 'none'"].join('; ');
html=html.replace('</head>',`<meta id="desktop-csp" http-equiv="Content-Security-Policy" content="${csp}">\n</head>`);
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);
console.log(JSON.stringify({output:'app/dashboard.html',scriptHashes:hashes.length,scriptHosts:Array.from(hosts).sort(),sha256:crypto.createHash('sha256').update(html).digest('hex')},null,2));
