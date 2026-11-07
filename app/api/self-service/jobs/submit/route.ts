import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
import {NextResponse} from 'next/server';
const json=(error:string,status:number)=>NextResponse.json({error},{status});
export async function POST(req:Request){
 const a=await access();if(!a.user)return json('Unauthorized',401);
 if(!a.companyId||!a.user.employeeId||!a.can('selfservice.view'))return json('Employee access required',403);
 const employee=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId}});if(!employee)return json('Employee not found',403);
 const form=await req.formData().catch(()=>null);if(!form)return json('Invalid submission',400);
 const vacancyId=String(form.get('vacancyId')||''),kind=String(form.get('kind')||'');
 if(!['APPLY','REFER'].includes(kind))return json('Invalid submission type',400);
 const vacancy=await db.recruitmentVacancy.findFirst({where:{id:vacancyId,companyId:a.companyId,status:'PUBLISHED',branch:{companyId:a.companyId}}});if(!vacancy)return json('Vacancy not available',404);
 const file=form.get('resume');if(!(file instanceof File)||file.size===0||file.size>5*1024*1024)return json('Upload a résumé up to 5 MB',400);
 const mime=file.type;const bytes=Buffer.from(await file.arrayBuffer());
 const pdf=bytes.subarray(0,5).toString()==='%PDF-';const docx=bytes.length>4&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===0x03&&bytes[3]===0x04;
 if(!(pdf||docx)||!(file.name.toLowerCase().endsWith('.pdf')||file.name.toLowerCase().endsWith('.docx')))return json('Only valid PDF or DOCX résumés are accepted',400);
 const name=kind==='APPLY'?`${employee.firstName} ${employee.lastName}`:String(form.get('name')||'').trim();
 const email=kind==='APPLY'?employee.email:String(form.get('email')||'').trim().toLowerCase();
 if(name.length<2||name.length>160||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return json('Valid candidate name and email required',400);
 if(kind==='REFER'&&form.get('consent')!=='yes')return json('Confirm the candidate has agreed to share their résumé',400);
 const existing=await db.recruitmentCandidate.findUnique({where:{email}});
 if(existing&&existing.companyId!==a.companyId)return json('Candidate email is registered with another tenant. HR must resolve the legacy global email constraint.',409);
 try{
 const result=await db.$transaction(async tx=>{
  let candidate=existing;
  if(!candidate){const parts=name.split(/\s+/);candidate=await tx.recruitmentCandidate.create({data:{companyId:a.companyId,firstName:parts[0],lastName:parts.slice(1).join(' ')||'-',email}})}
  const prior=await tx.recruitmentApplication.findUnique({where:{vacancyId_candidateId:{vacancyId,candidateId:candidate.id}}});if(prior)return null;
  const application=await tx.recruitmentApplication.create({data:{companyId:a.companyId,vacancyId,candidateId:candidate.id}});
  const submission=await tx.essJobSubmission.create({data:{companyId:a.companyId!,vacancyId,applicationId:application.id,submittedById:a.user!.id,kind,candidateName:name,candidateEmail:email,resumeName:file.name.slice(0,200),resumeMime:pdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',resumeData:bytes,emailStatus:kind==='REFER'?'PENDING':'NOT_REQUIRED'}});
  await tx.auditLog.create({data:{actorId:a.user!.id,action:kind==='REFER'?'ESS_JOB_REFERRAL':'ESS_JOB_APPLICATION',entity:'RecruitmentApplication',entityId:application.id,detail:{vacancyId,submissionId:submission.id}}});return submission;
 });
 if(!result)return json('This candidate already has an application for this vacancy',409);
 let emailStatus=result.emailStatus;
 if(kind==='REFER'){
  const key=process.env.RESEND_API_KEY;
  if(key){try{const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:'HR@nexora-hrms.com',to:[email],subject:`Application received — ${vacancy.title}`,text:`Dear ${name},\n\nAn employee has referred you for the ${vacancy.title} position. We have received your details and résumé. Our HR team will review them and contact you if appropriate. If you did not authorize this referral, please contact the recruiting company to request removal of your information.\n\nKind regards,\nHuman Resources\nPowered by Nexora HRMS`})});emailStatus=sent.ok?'SENT':'FAILED'}catch{emailStatus='FAILED'}}else emailStatus='NOT_CONFIGURED';
  await db.essJobSubmission.update({where:{id:result.id},data:{emailStatus}});
 }
 return NextResponse.json({success:true,emailStatus}, {status:201});
 }catch(e){console.error('ESS job submission',e);return json('Unable to submit application',500)}
}
