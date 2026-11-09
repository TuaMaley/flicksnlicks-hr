import {access} from '../../../../../../lib/auth';
import {db} from '../../../../../../lib/db';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
/** HR download of the latest résumé submitted for a candidate from the Employee app (EssJobSubmission). Needs recruitment.view. */
export async function GET(_req:Request,ctx:{params:Promise<{id:string}>}){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Select an authorized company'},{status:403});
 if(!a.can('recruitment.view'))return NextResponse.json({error:'Forbidden'},{status:403});
 const {id}=await ctx.params;
 const doc=await db.essJobSubmission.findFirst({where:{companyId:a.companyId,resumeName:{not:''},applicationId:{in:(await db.recruitmentApplication.findMany({where:{candidateId:id,companyId:a.companyId},select:{id:true}})).map(x=>x.id)}},orderBy:{createdAt:'desc'}});
 if(!doc||!doc.resumeData.length)return NextResponse.json({error:'No résumé on file for this candidate'},{status:404});
 const bytes=Buffer.from(doc.resumeData);
 return new NextResponse(bytes,{status:200,headers:{'Content-Type':doc.resumeMime||'application/octet-stream','Content-Length':String(bytes.length),'Content-Disposition':`attachment; filename="${doc.resumeName.replace(/[^\w.\- ]/g,'_')}"`,'Cache-Control':'private, no-store'}});
}
