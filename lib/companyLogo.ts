import {PDFDocument,PDFPage} from 'pdf-lib';
export function validateCompanyLogo(value:unknown):string|null{
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string')throw Error('Invalid company logo');
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match)throw Error('Use a PNG or JPEG logo');
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>250_000||bytes.length<32)throw Error('Logo must be between 32 bytes and 250 KB');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if((match[1]==='png'&&!png)||(match[1]==='jpeg'&&!jpg))throw Error('Invalid image data');
 return value;
}
export async function addCompanyLogo(pdf:PDFDocument,page:PDFPage,data:string|null|undefined,x:number,y:number,maxW=75,maxH=65){
 if(!data)return;
 try{const bytes=Buffer.from(data.split(',')[1],'base64');const img=data.startsWith('data:image/png')?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const scale=Math.min(maxW/img.width,maxH/img.height);page.drawImage(img,{x,y,width:img.width*scale,height:img.height*scale});}
 catch(error){console.error('Unable to embed company logo',error);}
}
