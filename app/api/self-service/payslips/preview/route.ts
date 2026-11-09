import {addCompanyLogo} from '../../../../../lib/companyLogo';
import {NextRequest,NextResponse} from 'next/server';
import {PDFDocument,PDFFont,PDFPage,StandardFonts,rgb} from 'pdf-lib';
import {access} from '../../../../../lib/auth';
import {db} from '../../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/**
 * GET /api/self-service/payslips/preview?batchId=
 * The employee's own payslip as a PDF laid out exactly like the HR "Payslip preview" (app/payroll/payslips):
 * company header with CALCULATED stamp, meta grid, Earnings / Employee deductions panels, employer pension line,
 * Official Payslip Declaration, document references and footer. Same eligibility checks as payslips/pdf.
 * Used by the employee app for both "Print / Save as PDF" and "Download PDF". No amounts are recalculated.
 */
const clean=(v:unknown)=>String(v??'').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—−]/g,'-').replace(/·/g,'-').replace(/[^\x20-\x7E]/g,'');
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
export async function GET(req:NextRequest){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.companyId||!a.can('selfservice.view')||!a.user.employeeId)return NextResponse.json({error:'Forbidden'},{status:403});
  const batchId=req.nextUrl.searchParams.get('batchId');
  if(!batchId)return NextResponse.json({error:'Missing payroll batch'},{status:400});
  const batch=await db.payrollCalculationBatch.findFirst({where:{id:batchId,companyId:a.companyId,status:'APPROVED'},select:{id:true,period:true,currency:true,lineItems:true,approvals:{select:{action:true}}}});
  if(!batch||!batch.approvals.some(x=>x.action==='finance_approve'))return NextResponse.json({error:'Payslip not finalized'},{status:404});
  const payment=await db.payrollPayment.findFirst({where:{companyId:a.companyId,employeeId:a.user.employeeId,batchId:batch.id,status:'PAID',confirmedAt:{not:null}},select:{id:true}});
  if(!payment)return NextResponse.json({error:'Payment not yet confirmed'},{status:404});
  const items=Array.isArray(batch.lineItems)?batch.lineItems:[];
  const index=items.findIndex(x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&(x as Record<string,unknown>).employeeId===a.user!.employeeId);
  if(index<0)return NextResponse.json({error:'Payslip not found'},{status:404});
  const x=items[index] as Record<string,unknown>;
  const required=['basic','allowances','overtimePay','gross','absenceDeduction','incomeTax','employeeSSNIT','tier3Employee','otherDeductions','net'];
  if(!required.every(k=>num(x[k])!==null))return NextResponse.json({error:'Incomplete statutory payroll breakdown; contact HR'},{status:409});
  const company=await db.company.findUnique({where:{id:a.companyId},select:{name:true,logoDataUrl:true}});
  if(!company)return NextResponse.json({error:'Company not found'},{status:404});

  const doc=await PDFDocument.create();const page=doc.addPage([595,842]);
  const normal=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.08,.14,.23),muted=rgb(.39,.45,.55),slate=rgb(.28,.33,.41),red=rgb(.78,.13,.2),redDark=rgb(.62,.09,.14),green=rgb(.09,.4,.2),greenLine=rgb(.53,.94,.67),border=rgb(.89,.91,.94),soft=rgb(.97,.98,.99),faint=rgb(.95,.96,.98);
  const L=46,R=549,W=R-L;
  const cur=clean(batch.currency||'GHS');
  const money=(v:number|null)=>v===null?'-':cur+' '+v.toLocaleString('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const draw=(t:string,xx:number,yy:number,size:number,font:PDFFont,color=ink)=>page.drawText(clean(t),{x:xx,y:yy,size,font,color});
  const right=(t:string,xr:number,yy:number,size:number,font:PDFFont,color=ink)=>{const s=clean(t);page.drawText(s,{x:xr-font.widthOfTextAtSize(s,size),y:yy,size,font,color})};
  const wrap=(t:string,font:PDFFont,size:number,max:number)=>{const words=clean(t).split(/\s+/);const lines:string[]=[];let cur2='';for(const w of words){const t2=cur2?cur2+' '+w:w;if(font.widthOfTextAtSize(t2,size)>max&&cur2){lines.push(cur2);cur2=w}else cur2=t2}if(cur2)lines.push(cur2);return lines};
  const para=(t:string,xx:number,yy:number,size:number,font:PDFFont,max:number,lead:number,color=ink)=>{for(const ln of wrap(t,font,size,max)){page.drawText(ln,{x:xx,y:yy,size,font,color});yy-=lead}return yy};
  const rect=(xx:number,yy:number,w:number,h:number,o:{fill?:ReturnType<typeof rgb>;stroke?:ReturnType<typeof rgb>;width?:number})=>page.drawRectangle({x:xx,y:yy,width:w,height:h,color:o.fill,borderColor:o.stroke,borderWidth:o.stroke?(o.width??.8):0});

  // ---- Brand header ----
  let y=842-50;
  const hasLogo=!!company.logoDataUrl;let tx=L;
  if(hasLogo){await addCompanyLogo(doc,page,company.logoDataUrl,L,y-52,58,52);tx=L+70}
  draw(company.name,tx,y-22,21,bold,red);
  draw('OFFICIAL EMPLOYEE PAYSLIP',tx,y-40,10.5,normal,muted);
  const stamp='CALCULATED';const sw=bold.widthOfTextAtSize(stamp,9)+18;
  rect(R-sw,y-38,sw,24,{stroke:greenLine,width:1});draw(stamp,R-sw+9,y-30,9,bold,green);
  y-=64;page.drawLine({start:{x:L,y},end:{x:R,y},thickness:2.4,color:red});

  // ---- Meta grid ----
  y-=26;const colW=W/2;
  const meta:[string,string,string][]=[['Employee',String(x.name||''),String(x.employeeNo||'Employee number unavailable')],['Payroll month',batch.period,'Branch: '+String(x.branch||'-')],['Position / category',String(x.position||'-'),String(x.category||'-')],['Batch reference',batch.period+' payroll',cur+' - Saved payroll snapshot']];
  meta.forEach((m,i)=>{const cx=L+(i%2)*colW,cy=y-Math.floor(i/2)*50;draw(m[0],cx,cy,8.5,normal,muted);draw(m[1],cx,cy-15,11.5,bold);draw(m[2],cx,cy-29,9.5,normal,muted)});
  y-=50*2+6;

  // ---- Earnings / Deductions panels ----
  const gap=18,pw=(W-gap)/2,rowH=24,headH=30;
  const panel=(px:number,title:string,rows:[string,string][],sub:[string,string])=>{
    const h=headH+rowH*(rows.length+1);const top=y;
    rect(px,top-h,pw,h,{fill:rgb(1,1,1),stroke:border});
    rect(px,top-headH,pw,headH,{fill:soft});draw(title,px+12,top-20,12.5,bold);
    let ry=top-headH;
    for(const [lbl,val] of rows){page.drawLine({start:{x:px,y:ry},end:{x:px+pw,y:ry},thickness:.6,color:faint});draw(lbl,px+12,ry-16,9.5,normal);right(val,px+pw-12,ry-16,9.5,bold);ry-=rowH}
    rect(px,ry-rowH,pw,rowH,{fill:soft});page.drawLine({start:{x:px,y:ry},end:{x:px+pw,y:ry},thickness:.6,color:faint});draw(sub[0],px+12,ry-16,11,normal);right(sub[1],px+pw-12,ry-16,11.5,bold);
    rect(px,top-h,pw,h,{stroke:border});
    return h;
  };
  const absence=num(x.absenceDeduction);
  const h1=panel(L,'Earnings',[['Basic salary',money(num(x.basic))],['Allowances',money(num(x.allowances))],['Overtime ('+(num(x.overtimeDays)??'-')+' approved days)',money(num(x.overtimePay))],['Unpaid absence adjustment',absence===null?'-':'- '+money(absence)]],['Gross earnings',money(num(x.gross))]);
  const h2=panel(L+pw+gap,'Employee deductions',[['PAYE',money(num(x.incomeTax))],['Employee SSNIT',money(num(x.employeeSSNIT))],['Tier 3 pension',money(num(x.tier3Employee))],['Other deductions',money(num(x.otherDeductions))]],['Net salary',money(num(x.net))]);
  y-=Math.max(h1,h2)+16;

  // ---- Employer pension ----
  rect(L,y-34,W,34,{fill:soft});draw('Employer pension contribution (not deducted from net salary)',L+12,y-21,10,normal);right(money(num(x.employerPension)),R-12,y-21,11,bold);
  y-=34+20;

  // ---- Declaration ----
  const dTop=y;const dx=L+18,dMax=W-36;let dy=dTop-20;
  const declParas=[['FRAUD PREVENTION NOTICE: ','Any unauthorized alteration, falsification or fraudulent use of this payslip is prohibited. Suspected alterations or misuse must be reported immediately to '+company.name+' Management for investigation and appropriate action.']];
  const p1='This payslip is an official document issued by '+company.name+" and records the employee's earnings, statutory deductions and net salary for the payroll period shown above.";
  const p3='This is a system-generated document and does not require a physical signature.';
  // measure
  const lead=12.5,ps=8.5;
  const measure=()=>{let n=wrap(p1,normal,ps,dMax).length;n+=wrap(declParas[0][0]+declParas[0][1],normal,ps,dMax).length;n+=wrap(p3,bold,ps,dMax).length;return 20+14+n*lead+3*6+10};
  const dh=measure();
  rect(L,dTop-dh,W,dh,{fill:soft,stroke:rgb(.8,.84,.88)});rect(L,dTop-dh,3.5,dh,{fill:redDark});
  draw('OFFICIAL PAYSLIP DECLARATION',dx,dy-2,9.5,bold,redDark);dy-=18;
  dy=para(p1,dx,dy,ps,normal,dMax,lead)-6;
  {const [lead1,rest]=declParas[0];const lines=wrap(lead1+rest,normal,ps,dMax);lines.forEach((ln,i)=>{if(i===0){draw(lead1,dx,dy,ps,bold);draw(ln.slice(lead1.length),dx+bold.widthOfTextAtSize(clean(lead1),ps),dy,ps,normal)}else draw(ln,dx,dy,ps,normal);dy-=lead});dy-=6}
  dy=para(p3,dx,dy,ps,bold,dMax,lead);
  y=dTop-dh-18;

  // ---- Document meta + footer ----
  const generated=new Date().toLocaleDateString('en-GB');
  const dm:[string,string][]=[['Payroll period: ',batch.period],['Batch reference: ',batch.id],['Statement reference: ',batch.id+':'+index],['Generated: ',generated]];
  dm.forEach((m,i)=>{const cx=L+(i%2)*colW,cy=y-Math.floor(i/2)*14;draw(m[0],cx,cy,7.5,bold,slate);draw(m[1],cx+bold.widthOfTextAtSize(m[0],7.5),cy,7.5,normal,slate)});
  y-=14*2+14;
  para('Generated from a saved Finance-approved payroll batch. This document is not evidence of payment. Confirm all applicable statutory and employment-law requirements before disbursement.',L,y,8,normal,W,11.5,slate);

  const bytes=await doc.save();
  return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Payslip-'+batch.period+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error('ESS payslip preview PDF',e);return NextResponse.json({error:'Unable to generate payslip'},{status:500})}
}
