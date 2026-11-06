import {NextRequest,NextResponse} from 'next/server';
import {PDFDocument,StandardFonts,rgb,PDFFont} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const clean=(v:unknown)=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E]/g,'');
const asNumber=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.companyId||!a.can('selfservice.view')||!a.user.employeeId)return NextResponse.json({error:'Forbidden'},{status:403});
  const batchId=req.nextUrl.searchParams.get('batchId');
  if(!batchId)return NextResponse.json({error:'Missing payroll batch'},{status:400});
  const batch=await db.payrollCalculationBatch.findFirst({where:{id:batchId,companyId:a.companyId,status:'APPROVED'},select:{id:true,period:true,currency:true,lineItems:true,approvals:{select:{action:true}}}});
  if(!batch||!batch.approvals.some(x=>x.action==='finance_approve'))return NextResponse.json({error:'Payslip not finalized'},{status:404});
  const payment=await db.payrollPayment.findFirst({where:{companyId:a.companyId,employeeId:a.user.employeeId,batchId:batch.id,status:'PAID',confirmedAt:{not:null}},select:{id:true,reference:true,confirmedAt:true}});
  if(!payment)return NextResponse.json({error:'Payment not yet confirmed'},{status:404});
  const raw=(Array.isArray(batch.lineItems)?batch.lineItems:[]).find(x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(x as Record<string,unknown>).employeeId===a.user!.employeeId);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return NextResponse.json({error:'Payslip not found'},{status:404});
  const x=raw as Record<string,unknown>;
  const required=['basic','allowances','overtimePay','gross','absenceDeduction','incomeTax','employeeSSNIT','tier3Employee','otherDeductions','net'];
  if(!required.every(k=>typeof x[k]==='number'&&Number.isFinite(x[k])))return NextResponse.json({error:'Incomplete statutory payroll breakdown; contact HR'},{status:409});
  const company=await db.company.findUnique({where:{id:a.companyId},select:{name:true,email:true,phone:true}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});

  const doc=await PDFDocument.create();
  const page=doc.addPage([595.28,841.89]);
  const normal=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(.11,.16,.24),gray=rgb(.36,.41,.47),red=rgb(.72,.11,.19),pale=rgb(.97,.975,.98),border=rgb(.85,.88,.91),green=rgb(.15,.46,.27);
  const put=(s:unknown,xx:number,yy:number,size=10,font:PDFFont=normal,color=navy)=>page.drawText(clean(s),{x:xx,y:yy,size,font,color});
  const rect=(xx:number,yy:number,w:number,h:number,fill=rgb(1,1,1),stroke=border)=>page.drawRectangle({x:xx,y:yy,width:w,height:h,color:fill,borderColor:stroke,borderWidth:.8});
  const rule=(yy:number)=>page.drawLine({start:{x:48,y:yy},end:{x:547,y:yy},thickness:2,color:red});
  const amount=(v:unknown)=>clean(batch.currency)+' '+asNumber(v).toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const wrap=(value:string,font:PDFFont,size:number,maxWidth:number)=>{
    const words=clean(value).split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
    for(const word of words){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)<=maxWidth){line=next;continue;}if(line)lines.push(line);line=word;}
    if(line)lines.push(line);return lines;
  };
  const paragraph=(value:string,xx:number,yy:number,maxWidth:number,size=8.3,leading=12)=>{
    for(const line of wrap(value,normal,size,maxWidth)){put(line,xx,yy,size);yy-=leading;}return yy;
  };
  // Use the known Flicks & Licks asset only for that company; never brand another tenant with it.
  const isFlicks=/^flicks\s*(?:&|and|n)\s*licks$/i.test(company.name.trim());
  let logo=false;
  if(isFlicks){try{const bytes=await readFile(join(process.cwd(),'public','flicks-licks-logo.png'));const img=await doc.embedPng(bytes);page.drawImage(img,{x:48,y:735,width:76,height:76});logo=true;}catch{ /* company name remains visible */ }}
  const hx=logo?139:48;
  put(company.name.toUpperCase(),hx,783,Math.min(17,company.name.length>23?13:17),bold,red);
  put('OFFICIAL EMPLOYEE PAYSLIP',hx,763,10.5,normal);
  rect(474,769,73,23,rgb(.96,1,.97),rgb(.65,.85,.7));put('PAID',496,777,10,bold,green);
  rule(726);
  const meta=(xx:number,yy:number,label:string,value:unknown,sub?:string)=>{
    put(label,xx,yy,8.6,normal,gray);put(clean(value).slice(0,43),xx,yy-17,10.5,bold);
    if(sub)put(clean(sub).slice(0,52),xx,yy-31,8.5,normal,gray);
  };
  meta(48,704,'Employee',x.name||'Employee',String(x.employeeNo||a.user.employeeId));
  meta(294,704,'Payroll month',batch.period,'Branch: '+String(x.branch||'-'));
  meta(48,644,'Position / category',x.position||'-',String(x.category||'-'));
  meta(294,644,'Batch reference',batch.id.slice(0,22)+'...',clean(batch.currency)+' - Saved payroll snapshot');
  const top=579,cardHeight=231,cardWidth=240;
  const card=(xx:number,title:string,items:{label:string,value:unknown,emphasis?:boolean}[])=>{
    rect(xx,top-cardHeight,cardWidth,cardHeight);
    rect(xx,top-38,cardWidth,38,pale,border);
    put(title,xx+13,top-24,12,bold);
    let y=top-57;
    for(const item of items){
      if(item.emphasis)rect(xx+1,y-17,cardWidth-2,31,pale,pale);
      const labelLines=wrap(item.label,item.emphasis?bold:normal,9,133);
      for(let i=0;i<labelLines.length;i++)put(labelLines[i],xx+12,y-i*11,9,item.emphasis?bold:normal);
      const value=amount(item.value),f=item.emphasis?bold:normal;
      put(value,xx+cardWidth-11-f.widthOfTextAtSize(value,9),y,9,f);
      y-=Math.max(31,labelLines.length*11+15);
    }
  };
  card(48,'Earnings',[
    {label:'Basic salary',value:x.basic},{label:'Allowances',value:x.allowances},
    {label:'Overtime ('+String(x.overtimeDays??0)+' approved days)',value:x.overtimePay},
    {label:'Unpaid absence adjustment',value:-asNumber(x.absenceDeduction)},
    {label:'Gross earnings',value:x.gross,emphasis:true}
  ]);
  card(307,'Employee deductions',[
    {label:'PAYE',value:x.incomeTax},{label:'Employee SSNIT',value:x.employeeSSNIT},
    {label:'Tier 3 pension',value:x.tier3Employee},{label:'Other deductions',value:x.otherDeductions},
    {label:'Net salary',value:x.net,emphasis:true}
  ]);
  rect(48,307,499,32,pale,pale);
  put('Employer pension contribution (not deducted from net salary)',60,319,9.3);
  const pension=amount(x.employerPension),pfont=bold;
  put(pension,536-pfont.widthOfTextAtSize(pension,9.3),319,9.3,pfont);
  rect(48,126,499,169,pale,border);
  page.drawRectangle({x:48,y:126,width:3,height:169,color:red});
  put('OFFICIAL PAYSLIP DECLARATION',63,274,10,bold,red);
  let y=256;
  y=paragraph('This payslip is an official document issued by '+company.name+' and records the employee\'s earnings, statutory deductions and net salary for the payroll period shown above.',63,y,464,8.2,12)-6;
  put('FRAUD PREVENTION NOTICE:',63,y,8.3,bold);
  y-=13;
  y=paragraph('Any unauthorized alteration, falsification or fraudulent use of this payslip is prohibited. Suspected alterations or misuse must be reported immediately to '+company.name+' Management for investigation and appropriate action.',63,y,464,8.2,12)-8;
  put('This is a system-generated document and does not require a physical signature.',63,y,8.5,bold);
  put('Payroll period: '+batch.period,48,104,7.6,normal,gray);
  put('Batch reference: '+batch.id.slice(0,30),295,104,7.6,normal,gray);
  put('Statement reference: '+batch.id.slice(0,22)+'-'+String(x.employeeNo||'EMP'),48,90,7.6,normal,gray);
  put('Generated: '+new Date().toLocaleDateString('en-GB',{timeZone:'UTC'}),295,90,7.6,normal,gray);
  const bytes=await doc.save();
  return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Payslip-'+batch.period+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('ESS payslip PDF',e);return NextResponse.json({error:'Unable to generate payslip'},{status:500});}
}
