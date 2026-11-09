import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
/**
 * Employee self-service: apply for a published vacancy, or refer someone.
 * Writes the SAME records HR's /api/recruitment/applications creates (RecruitmentCandidate + RecruitmentApplication),
 * so submissions appear in HR's "Candidates & Applications" pipeline immediately. Needs only selfservice.edit.
 * Each submission (and its optional PDF/Word résumé, ≤3 MB) is also recorded in EssJobSubmission.
 *
 * POST { vacancyId, mode:'self'|'referral', candidate?:{firstName,lastName,email,phone,qualification,experience}, note?, resume?:{fileName,mimeType,base64} }
 * GET  → the signed-in employee's own applications and referrals.
 */
const MAX_RESUME=3*1024*1024; const MIMES=['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const marker=(employeeId:string)=>`[ESS:${employeeId}]`;
export async function GET(){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company context required'},{status:403});
 if(!a.can('selfservice.view'))return NextResponse.json({error:'Permission denied'},{status:403});
 if(!a.user.employeeId)return NextResponse.json({error:'Your login is not linked to an employee record'},{status:404});
 const emp=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{id:true,email:true}});
 if(!emp)return NextResponse.json({error:'Linked employee record not found'},{status:404});
 const rows=await db.recruitmentApplication.findMany({
  where:{companyId:a.companyId,OR:[{candidate:{email:emp.email.toLowerCase()}},{notes:{contains:marker(emp.id)}}]},
  orderBy:{createdAt:'desc'},take:100,
  select:{id:true,status:true,notes:true,createdAt:true,updatedAt:true,vacancy:{select:{id:true,title:true,branch:{select:{name:true}}}},candidate:{select:{firstName:true,lastName:true,email:true}}},
 });
 const applications=rows.map(r=>({id:r.id,status:r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,vacancyId:r.vacancy.id,vacancyTitle:r.vacancy.title,branch:r.vacancy.branch.name,
  mode:r.candidate.email.toLowerCase()===emp.email.toLowerCase()?'self':'referral',candidateName:`${r.candidate.firstName} ${r.candidate.lastName}`,notes:r.notes}));
 return NextResponse.json({applications});
}
export async function POST(request:Request){
 const a=await access();
 if(!a.user)return NextResponse.json({error:'Authentication required'},{status:401});
 if(!a.companyId)return NextResponse.json({error:'Company context required'},{status:403});
 if(!a.can('selfservice.edit'))return NextResponse.json({error:'Permission denied'},{status:403});
 if(!a.user.employeeId)return NextResponse.json({error:'Your login is not linked to an employee record'},{status:404});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 const mode=body?.mode==='referral'?'referral':body?.mode==='self'?'self':null;
 if(!mode||typeof body.vacancyId!=='string')return NextResponse.json({error:'Invalid request'},{status:400});
 const emp=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{id:true,employeeNo:true,firstName:true,lastName:true,email:true,phone:true,position:true,department:true}});
 if(!emp)return NextResponse.json({error:'Linked employee record not found'},{status:404});
 const vacancy=await db.recruitmentVacancy.findFirst({where:{id:body.vacancyId,status:'PUBLISHED',OR:[{companyId:a.companyId},{companyId:null,requisition:{companyId:a.companyId}}]},select:{id:true,title:true}});
 if(!vacancy)return NextResponse.json({error:'This vacancy is no longer open'},{status:404});
 const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
 const note=str(body.note,2000);
 let cand:{firstName:string;lastName:string;email:string;phone:string;qualification:string;experience:string};
 if(mode==='self'){
  cand={firstName:emp.firstName,lastName:emp.lastName,email:emp.email.toLowerCase(),phone:str(body.candidate?.phone,50)||emp.phone||'',qualification:str(body.candidate?.qualification,500),experience:str(body.candidate?.experience,2000)||`Current role: ${emp.position}, ${emp.department} (${emp.employeeNo})`};
 }else{
  const c=body.candidate||{};
  cand={firstName:str(c.firstName,100),lastName:str(c.lastName,100),email:str(c.email,254).toLowerCase(),phone:str(c.phone,50),qualification:str(c.qualification,500),experience:str(c.experience,2000)};
  if(!cand.firstName||!cand.lastName||!/^\S+@\S+\.\S+$/.test(cand.email))return NextResponse.json({error:'Enter the person\'s first name, last name and a valid email'},{status:400});
  if(cand.email===emp.email.toLowerCase())return NextResponse.json({error:'To apply yourself, choose "Apply myself" instead of a referral'},{status:400});
 }
 let resume:{fileName:string;mimeType:string;base64:string}|null=null;
 if(body.resume){
  const r=body.resume; const fileName=str(r.fileName,200)||'resume'; const mimeType=str(r.mimeType,100); const base64=typeof r.base64==='string'?r.base64:'';
  if(!MIMES.includes(mimeType))return NextResponse.json({error:'Résumé must be a PDF or Word document'},{status:400});
  if(!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)||base64.length*0.75>MAX_RESUME)return NextResponse.json({error:'Résumé must be 3 MB or smaller'},{status:413});
  resume={fileName,mimeType,base64:base64.replace(/[\r\n]/g,'')};
 }
 const stamp=mode==='self'
  ?`Internal application via Employee app — ${emp.firstName} ${emp.lastName} (${emp.employeeNo}, ${emp.position}). ${note} ${marker(emp.id)}`.replace(/\s+/g,' ').trim()
  :`Referred via Employee app by ${emp.firstName} ${emp.lastName} (${emp.employeeNo}). ${note?`Referrer's note: ${note}`:''} ${marker(emp.id)}`.replace(/\s+/g,' ').trim();
 const result=await db.$transaction(async tx=>{
  let candidate=await tx.recruitmentCandidate.findUnique({where:{email:cand.email}});
  if(candidate&&candidate.companyId&&candidate.companyId!==a.companyId)return 'CROSS' as const;
  if(!candidate)candidate=await tx.recruitmentCandidate.create({data:{companyId:a.companyId,...cand}});
  else if(mode==='self'&&(cand.phone||cand.qualification||cand.experience))candidate=await tx.recruitmentCandidate.update({where:{id:candidate.id},data:{phone:cand.phone||candidate.phone,qualification:cand.qualification||candidate.qualification,experience:cand.experience||candidate.experience}});
  const prior=await tx.recruitmentApplication.findUnique({where:{vacancyId_candidateId:{vacancyId:vacancy.id,candidateId:candidate.id}}});
  if(prior)return 'DUP' as const;
  const app=await tx.recruitmentApplication.create({data:{companyId:a.companyId,vacancyId:vacancy.id,candidateId:candidate.id,notes:stamp.slice(0,2000)}});
  await tx.essJobSubmission.create({data:{companyId:a.companyId!,vacancyId:vacancy.id,applicationId:app.id,submittedById:a.user!.id,kind:mode==='self'?'SELF':'REFERRAL',candidateName:`${cand.firstName} ${cand.lastName}`,candidateEmail:cand.email,resumeName:resume?.fileName||'',resumeMime:resume?.mimeType||'',resumeData:resume?Buffer.from(resume.base64,'base64'):Buffer.alloc(0),emailStatus:'NOT_REQUIRED'}});
  await tx.auditLog.create({data:{actorId:a.user!.id,companyId:a.companyId!,action:mode==='self'?'ESS_APPLICATION_SUBMITTED':'ESS_REFERRAL_SUBMITTED',entity:'RecruitmentApplication',entityId:app.id,detail:{vacancyId:vacancy.id,candidateId:candidate.id,resume:!!resume}}});
  return app;
 });
 if(result==='CROSS')return NextResponse.json({error:'That email is already registered with another company. Contact HR.'},{status:409});
 if(result==='DUP')return NextResponse.json({error:mode==='self'?'You have already applied for this vacancy':'This person has already been put forward for this vacancy'},{status:409});
 return NextResponse.json({application:{id:result.id,status:result.status}},{status:201});
}
