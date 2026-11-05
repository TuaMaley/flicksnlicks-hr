import {NextResponse} from 'next/server';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {randomUUID} from 'crypto';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.companyId)return NextResponse.json({error:'Company context required'},{status:403});
  if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});
  if(!a.user.employeeId)return NextResponse.json({error:'Account not linked to an employee'},{status:403});
  const e=await db.employee.findFirst({where:{id:a.user.employeeId,companyId:a.companyId},select:{id:true,employeeNo:true,firstName:true,lastName:true,hireDate:true,status:true,position:true,department:true,branch:{select:{name:true}}}});
  if(!e||e.status!=='ACTIVE')return NextResponse.json({error:'Only active employees may generate a letter'},{status:403});
  const c=await db.employeeCompensation.findFirst({where:{employeeId:e.id,companyId:a.companyId,status:'APPROVED',effectiveDate:{lte:new Date()}},orderBy:[{effectiveDate:'desc'},{createdAt:'desc'}],select:{basicSalary:true,currency:true,allowances:true,effectiveDate:true}});
  if(!c)return NextResponse.json({error:'No effective approved basic salary found. Contact HR.'},{status:409});
  const company=await db.company.findUnique({where:{id:a.companyId},select:{name:true,email:true,phone:true}});
  if(!company)return NextResponse.json({error:'Company record not found'},{status:409});
  const allowances=Array.isArray(c.allowances)?c.allowances.flatMap((v:unknown)=>{
   if(!v||typeof v!=='object')return [];
   const item=v as Record<string,unknown>;
   const amount=Number(item.amount);
   return typeof item.label==='string'&&Number.isFinite(amount)&&amount>=0?[{label:item.label,amount}]:[];
  }):[];
  const basic=Number(c.basicSalary);
  const monthlyGross=basic+allowances.reduce((sum,item)=>sum+item.amount,0);
  const amount=(value:number)=>c.currency+' '+new Intl.NumberFormat('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const ref='EVL-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+randomUUID().slice(0,8).toUpperCase();
  const date=(d:Date)=>d.toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
  const name=e.firstName+' '+e.lastName;
  const doc=await PDFDocument.create();const p=doc.addPage([595,842]);const regular=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const safe=(s:string)=>s.replace(/[^\\x20-\\x7E]/g,'-');
  const write=(s:string,y:number,size=10,isBold=false,x=52)=>p.drawText(safe(s),{x,y,size,font:isBold?bold:regular,color:rgb(.12,.16,.22)});
  const wrap=(s:string,max=88)=>{const result:string[]=[];let line='';for(const word of s.split(/\\s+/)){if((line+' '+word).trim().length>max){if(line)result.push(line);line=word}else line=(line+' '+word).trim()}if(line)result.push(line);return result};
  write(company.name,785,19,true);
  if(company.email)write('Email: '+company.email,765,9);
  if(company.phone)write('Phone: '+company.phone,750,9);
  p.drawLine({start:{x:52,y:735},end:{x:543,y:735},thickness:1.5,color:rgb(.22,.36,.55)});
  write('EMPLOYMENT & SALARY CONFIRMATION',707,14,true);
  write('Issued: '+date(new Date()),684);
  write('Reference: '+ref,666,9);
  write('TO WHOM IT MAY CONCERN',635,11,true);
  let y=607;
  for(const line of wrap('This letter confirms that '+name+' is employed by '+company.name+'.')){write(line,y);y-=17}
  y-=12;
  const details=[
   ['Employee name',name],['Employee ID',e.employeeNo],['Job title',e.position||'Not recorded'],
   ['Department',e.department||'Not recorded'],['Branch',e.branch?.name||'Not recorded'],
   ['Employment start date',date(e.hireDate)],['Employment status','Active']
  ];
  for(const [label,value] of details){write(label+':',y,10,true);write(value,y,10,false,215);y-=22}
  y-=10;
  write('MONTHLY COMPENSATION',y,11,true);y-=26;
  write('Basic monthly salary',y);write(amount(basic),y,10,true,350);y-=22;
  for(const item of allowances){for(const line of wrap(item.label,40)){write(line,y);y-=16}write(amount(item.amount),y+16,10,false,350);y-=6}
  y-=8;
  p.drawLine({start:{x:52,y:y+13},end:{x:543,y:y+13},thickness:.7,color:rgb(.7,.75,.8)});
  write('Gross monthly salary',y,10,true);write(amount(monthlyGross),y,10,true,350);y-=25;
  write('Gross annual salary',y,10,true);write(amount(monthlyGross*12),y,10,true,350);y-=30;
  if(y<145)return NextResponse.json({error:'Compensation has too many items to fit on the letter. Contact HR.'},{status:409});
  for(const line of wrap('This letter was generated at the employee\'s request using the company\'s current approved compensation record.')){write(line,y,9);y-=15}
  write('Yours faithfully,',125);write('Human Resources Department',107,10,true);write(company.name,90,10);
  p.drawLine({start:{x:52,y:67},end:{x:543,y:67},thickness:.7,color:rgb(.7,.75,.8)});
  write('Electronically generated by Nexora HRMS | '+ref,52,8);
  const bytes=await doc.save();
  await db.employeeHRRequest.create({data:{companyId:a.companyId,employeeId:e.id,category:'EMPLOYMENT_VERIFICATION_LETTER',subject:'Employment verification letter - '+ref,details:JSON.stringify({issuedAt:new Date().toISOString(),reference:ref,companyId:a.companyId,employeeId:e.id,compensationEffectiveDate:c.effectiveDate.toISOString(),currency:c.currency,basicSalary:basic,allowances,grossMonthly:monthlyGross,grossAnnual:monthlyGross*12}),status:'COMPLETED',response:'Document reference: '+ref}});
  return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Employment-Verification-'+ref+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){console.error('ESS letter generation',error);return NextResponse.json({error:'Unable to generate verification letter. Contact HR.'},{status:500});}
}
