import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {fail,ok} from '../../../../lib/http';
import {gate,categories,visibility,allowedToRead,summary,log} from '../../../../lib/nexhr';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const {a,error}=await gate();if(error)return error;
 const status=req.nextUrl.searchParams.get('status');
 const rows=await db.nexHrDocument.findMany({where:{companyId:a.companyId!,...(status&&a.can('nexhr.manage')?{status}:{})},select:{id:true,companyId:true,familyId:true,version:true,title:true,category:true,description:true,fileName:true,mimeType:true,sizeBytes:true,status:true,visibility:true,effectiveAt:true,expiresAt:true,uploadedById:true,reviewedById:true,reviewedAt:true,reviewReason:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'},take:500});
 return ok({documents:rows.filter(d=>allowedToRead(a,d)),permissions:[...a.keys].filter(k=>k.startsWith('nexhr.'))});
}
export async function POST(req:NextRequest){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 try{
 const form=await req.formData();const file=form.get('file');
 if(!(file instanceof File))return fail('Choose a file',400);
 const filename=file.name.slice(0,180);
 const ext=filename.toLowerCase().split('.').pop();
 const types:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
 if(!ext||!types[ext])return fail('Only PDF, DOCX and TXT documents are supported',400);
 if(!file.size||file.size>8*1024*1024)return fail('File must be between 1 byte and 8 MB',400);
 const title=String(form.get('title')||'').trim().slice(0,180);
 const category=String(form.get('category')||'');
 const vis=String(form.get('visibility')||'ALL_EMPLOYEES');
 const description=String(form.get('description')||'').trim().slice(0,2000);
 const replaceId=String(form.get('replaceId')||'');
 if(!title)return fail('Title is required',400);
 if(!categories.includes(category)||!visibility.includes(vis))return fail('Invalid category or visibility',400);
 const bytes=Buffer.from(await file.arrayBuffer());
 if(ext==='pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))return fail('Invalid PDF file',400);
 if(ext==='docx'&&bytes.subarray(0,2).toString()!=='PK')return fail('Invalid DOCX file',400);
 const effectiveRaw=String(form.get('effectiveAt')||'');const expiresRaw=String(form.get('expiresAt')||'');
 const effectiveAt=effectiveRaw?new Date(effectiveRaw):null,expiresAt=expiresRaw?new Date(expiresRaw):null;
 if((effectiveAt&&!Number.isFinite(effectiveAt.getTime()))||(expiresAt&&!Number.isFinite(expiresAt.getTime())))return fail('Invalid date',400);
 if(effectiveAt&&expiresAt&&expiresAt<=effectiveAt)return fail('Expiry must follow effective date',400);
 const result=await db.$transaction(async tx=>{
 let familyId=randomUUID(),version=1;
 if(replaceId){
 const old=await tx.nexHrDocument.findFirst({where:{id:replaceId,companyId:a.companyId!}});
 if(!old)throw Error('Original document not found');
 familyId=old.familyId;
 const last=await tx.nexHrDocument.findFirst({where:{companyId:a.companyId!,familyId},orderBy:{version:'desc'}});
 if(last&&last.status==='PENDING')throw Error('Review the pending version before uploading another');
 version=(last?.version||0)+1;
 }
 const doc=await tx.nexHrDocument.create({data:{companyId:a.companyId!,familyId,version,title,category,description,fileName:filename,mimeType:types[ext],sizeBytes:bytes.length,fileData:bytes,status:'DRAFT',visibility:vis,effectiveAt,expiresAt,uploadedById:a.user!.id}});
 return doc;
 });
 await log(a.companyId!,result.id,a.user!.id,'UPLOADED',{title,version});
 return ok({document:summary(result)},201);
 }catch(e:any){if(e?.code==='P2002')return fail('A new version was uploaded concurrently. Please retry.',409);if(e instanceof SyntaxError)return fail('Invalid form',400);if(e?.message==='Original document not found'||e?.message?.startsWith('Review the pending'))return fail(e.message,409);console.error('Nex HR upload failed',e);return fail('Unable to upload document',500)}
}
