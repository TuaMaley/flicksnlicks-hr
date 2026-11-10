import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../../lib/db';
import {fail,ok} from '../../../../../lib/http';
import {gate,allowedToRead,summary,log} from '../../../../../lib/nexhr';
export const runtime='nodejs';
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {a,error}=await gate();if(error)return error;
 const {id}=await params;const doc=await db.nexHrDocument.findFirst({where:{id,companyId:a.companyId!}});
 if(!doc||!allowedToRead(a,doc))return fail('Document not found',404);
 await log(a.companyId!,id,a.user!.id,'DOWNLOADED');
 return new NextResponse(new Uint8Array(doc.fileData),{headers:{'Content-Type':doc.mimeType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 const {id}=await params;const doc=await db.nexHrDocument.findFirst({where:{id,companyId:a.companyId!}});
 if(!doc)return fail('Document not found',404);
 if(doc.status!=='DRAFT'&&doc.status!=='REJECTED')return fail('Only draft or rejected documents may be submitted',409);
 const updated=await db.nexHrDocument.updateMany({where:{id,companyId:a.companyId!,status:doc.status},data:{status:'PENDING',reviewReason:null}});
 if(updated.count!==1)return fail('Document changed; refresh',409);
 await log(a.companyId!,id,a.user!.id,'SUBMITTED');return ok({status:'PENDING'});
}
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {a,error}=await gate('nexhr.manage');if(error)return error;
 const {id}=await params;const doc=await db.nexHrDocument.findFirst({where:{id,companyId:a.companyId!}});
 if(!doc)return fail('Document not found',404);
 if(doc.status!=='DRAFT'&&doc.status!=='REJECTED')return fail('Only draft or rejected documents may be deleted',409);
 await db.nexHrDocument.deleteMany({where:{id,companyId:a.companyId!,status:doc.status}});
 await log(a.companyId!,id,a.user!.id,'DELETED',{title:doc.title});return ok({deleted:true});
}
