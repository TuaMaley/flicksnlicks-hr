import {inflateRawSync} from 'node:zlib';
// Dependency-free reader for ordinary Excel .xlsx worksheets. Rejects encrypted and unusual ZIPs.
function entries(buf:Buffer):Map<string,Buffer>{
 const out=new Map<string,Buffer>(); let end=-1;
 for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--)if(buf.readUInt32LE(i)===0x06054b50){end=i;break}
 if(end<0)throw Error('Invalid XLSX ZIP structure');
 const count=buf.readUInt16LE(end+10),start=buf.readUInt32LE(end+16);if(count>150)throw Error('Spreadsheet has too many internal files');
 let pos=start,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>buf.length||buf.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid spreadsheet archive');
  const method=buf.readUInt16LE(pos+10),packed=buf.readUInt32LE(pos+20),unpacked=buf.readUInt32LE(pos+24),nl=buf.readUInt16LE(pos+28),extra=buf.readUInt16LE(pos+30),comment=buf.readUInt16LE(pos+32),off=buf.readUInt32LE(pos+42),name=buf.subarray(pos+46,pos+46+nl).toString('utf8');pos+=46+nl+extra+comment;
  if(unpacked>2_000_000||packed>2_000_000||(total+=unpacked)>8_000_000)throw Error('Spreadsheet exceeds safe limits');
  if(!['xl/worksheets/sheet1.xml','xl/sharedStrings.xml'].includes(name))continue;
  if(off+30>buf.length||buf.readUInt32LE(off)!==0x04034b50)throw Error('Invalid XLSX member');
  const loc=off+30+buf.readUInt16LE(off+26)+buf.readUInt16LE(off+28);if(loc+packed>buf.length)throw Error('Truncated XLSX member');
  if(method!==0&&method!==8)throw Error('Unsupported XLSX compression');
  const raw=buf.subarray(loc,loc+packed),data=method===0?raw:inflateRawSync(raw,{maxOutputLength:2_000_001});
  if(data.length!==unpacked)throw Error('Corrupted XLSX worksheet');out.set(name,data);
 }
 return out;
}
function unescape(s:string){return s.replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
export type UploadRow={row:number;employeeId:string;employeeNo:string;method:string;recipient:string;destination:string;amount:string;batchId:string};
export function readPaymentXlsx(buf:Buffer):UploadRow[]{
 const files=entries(buf);const xml=files.get('xl/worksheets/sheet1.xml')?.toString('utf8');if(!xml)throw Error('Worksheet 1 missing. Use the provided template.');
 const shared:string[]=[];const strings=files.get('xl/sharedStrings.xml')?.toString('utf8')||'';
 for(const match of strings.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g))shared.push(unescape([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join('')));
 const rows:string[][]=[];
 for(const match of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  const cells=Array(7).fill('');for(const c of match[1].matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g)){
   const ref=/\br="([A-Z]+)\d+"/.exec(c[1])?.[1];if(!ref)continue;let col=0;for(const x of ref)col=col*26+x.charCodeAt(0)-64;col--;if(col<0||col>=7)continue;
   const inner=c[2]||'',type=/\bt="([^"]+)"/.exec(c[1])?.[1];let val='';
   if(type==='inlineStr')val=[...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>m[1]).join('');else val=/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]||'';
   cells[col]=type==='s'?shared[Number(val)]||'':unescape(val);
  }rows.push(cells);if(rows.length>1002)throw Error('Maximum 1000 employee rows per upload');
 }
 const expected=['Employee ID','Employee Number','Payment Method','Recipient Name','Account / MoMo / Cash ID','Approved Net Salary (GHS)','Payroll Batch ID'];
 if(rows.length<2||expected.some((h,i)=>rows[0][i]?.trim()!==h))throw Error('Template columns do not match. Download a fresh template.');
 return rows.slice(1).map((r,i)=>({row:i+2,employeeId:r[0].trim(),employeeNo:r[1].trim(),method:r[2].trim().toUpperCase(),recipient:r[3].trim(),destination:r[4].trim(),amount:r[5].trim(),batchId:r[6].trim()})).filter(r=>Object.values(r).some(v=>v!=='')) as UploadRow[];
}
function crc32(b:Buffer){let crc=0xffffffff;for(const n of b){crc^=n;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
export function makePaymentXlsx(rows:string[][]):Buffer{
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,i)=>`<row r="${i+1}">`+row.map((v,j)=>{let col=j+1,label='';while(col){col--;label=String.fromCharCode(65+col%26)+label;col=Math.floor(col/26)}return `<c r="${label}${i+1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`}).join('')+'</row>').join('')+'</sheetData></worksheet>';
 const files:[string,string][]=[['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],['_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml','<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Payments" sheetId="1" r:id="rId1"/></sheets></workbook>'],['xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',xml]];
 const parts:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,content] of files){const n=Buffer.from(name),data=Buffer.from(content),crc=crc32(data);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);parts.push(local,n,data);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=local.length+n.length+data.length;}
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...parts,cd,end]);
}
