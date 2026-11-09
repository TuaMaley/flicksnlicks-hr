import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
/**
 * Read-only: the signed-in employee's own job applications and referrals (submitted via /api/self-service/jobs/submit),
 * with the current pipeline status of each. Lets the mobile app show "Applied · Screening" on a vacancy.
 * Needs selfservice.view. No writes.
 */
export async function GET(){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company context required'},{status:403});
 if(!a.can('selfservice.view'))return NextResponse.json({error:'Permission denied'},{status:403});
 if(!a.user.employeeId)return NextResponse.json({error:'Your login is not linked to an employee record'},{status:404});
 const subs=await db.essJobSubmission.findMany({where:{companyId:a.companyId,submittedById:a.user.id,applicationId:{not:null}},orderBy:{createdAt:'desc'},take:100,select:{id:true,kind:true,candidateName:true,candidateEmail:true,createdAt:true,applicationId:true,vacancyId:true}});
 const appIds=subs.map(s=>s.applicationId!).filter(Boolean);
 const apps=await db.recruitmentApplication.findMany({where:{id:{in:appIds}},select:{id:true,status:true,updatedAt:true,vacancy:{select:{id:true,title:true,branch:{select:{name:true}}}}}});
 const byId=new Map<string,(typeof apps)[number]>(apps.map(x=>[x.id,x]));
 const applications=subs.flatMap(s=>{const x=byId.get(s.applicationId!);if(!x)return [];return [{id:x.id,status:x.status,createdAt:s.createdAt,updatedAt:x.updatedAt,vacancyId:x.vacancy.id,vacancyTitle:x.vacancy.title,branch:x.vacancy.branch.name,mode:s.kind==='REFER'?'referral':'self',candidateName:s.candidateName,notes:null}]});
 return NextResponse.json({applications},{headers:{'Cache-Control':'private, no-store'}});
}
