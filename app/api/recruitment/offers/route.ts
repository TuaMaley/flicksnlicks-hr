import {NextRequest} from 'next/server';
import {db} from '../../../../lib/db';
import {access,employeeWhere} from '../../../../lib/auth';
import {fail,ok} from '../../../../lib/http';
const scoped=(a:Awaited<ReturnType<typeof access>>)=>({vacancy:{branch:{employees:{some:employeeWhere(a)}}}});
export async function GET(){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.view'))return fail('Forbidden',403);
 const offers=await db.recruitmentOffer.findMany({where:{application:scoped(a)},include:{application:{include:{candidate:{select:{firstName:true,lastName:true,email:true}},vacancy:{select:{title:true,branch:{select:{name:true}}}}}}},orderBy:{createdAt:'desc'},take:300});return ok({offers});
 }catch(e){console.error('Recruitment offers GET',e);return fail('Unable to load offers',500)}}
export async function POST(req:NextRequest){try{const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.can('recruitment.create'))return fail('Forbidden',403);const b=await req.json();
 const applicationId=String(b.applicationId||''),salary=Number(b.salaryGhs),startDate=new Date(String(b.startDate||'')+'T12:00:00.000Z'),offerTerms=String(b.offerTerms||'').trim();
 if(!applicationId||!Number.isFinite(salary)||salary<=0||salary>100000000||!Number.isFinite(startDate.getTime())||offerTerms.length<10||offerTerms.length>5000)return fail('Valid candidate, salary, start date and offer terms required',400);
 const application=await db.recruitmentApplication.findFirst({where:{id:applicationId,status:'INTERVIEW',...scoped(a)},include:{interview:{include:{assessments:{select:{id:true}}}}}});
 if(!application||application.interview?.status!=='COMPLETED'||!application.interview.assessments.length)return fail('Completed and assessed interview required',409);
 const existing=await db.recruitmentOffer.findUnique({where:{applicationId}});if(existing)return fail('An offer already exists for this application',409);
 const offer=await db.$transaction(async tx=>{const created=await tx.recruitmentOffer.create({data:{applicationId,salaryGhs:salary,startDate,offerTerms,createdById:a.user!.id}});await tx.auditLog.create({data:{actorId:a.user!.id,action:'RECRUITMENT_OFFER_CREATED',entity:'RecruitmentOffer',entityId:created.id,detail:{applicationId}}});return created});return ok({offer},201);
 }catch(e){console.error('Recruitment offer POST',e);return fail('Unable to create offer (check whether offer already exists)',500)}}
