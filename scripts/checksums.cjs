const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.join(__dirname,'../dist');
const files=fs.readdirSync(dir).filter(n=>/^FuPanTai-Setup-.*\.exe$/.test(n));
if(!files.length)throw new Error('No Windows installer found');
fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),files.map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')+'  '+name).join('\n')+'\n');
console.log(fs.readFileSync(path.join(dir,'SHA256SUMS.txt'),'utf8'));
