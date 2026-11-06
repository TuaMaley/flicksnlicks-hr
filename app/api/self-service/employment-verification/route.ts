import {addCompanyLogo} from '../../../../lib/companyLogo';
import {NextResponse} from 'next/server';
import {PDFDocument,StandardFonts,rgb,PDFFont} from 'pdf-lib';
import {randomUUID} from 'crypto';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function printable(value:unknown):string {
  // Built-in PDF Helvetica supports WinAnsi, not arbitrary Unicode.
  // Transliterate accented letters and normalize punctuation without corrupting ASCII text.
  return String(value ?? '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[\u201c\u201d]/g,'"')
    .replace(/[\u2013\u2014]/g,'-')
    .replace(/\u00a0/g,' ')
    .replace(/[^\x20-\x7E]/g,'');
}

function wrapText(value:string,font:PDFFont,size:number,maxWidth:number):string[] {
  const lines:string[]=[];
  let line='';
  for(const word of printable(value).split(/\s+/).filter(Boolean)){
    const next=line?line+' '+word:word;
    if(font.widthOfTextAtSize(next,size)<=maxWidth){line=next;continue;}
    if(line)lines.push(line);
    line='';
    // Prevent unusually long names/labels from running off the page.
    for(const char of word){
      if(font.widthOfTextAtSize(line+char,size)>maxWidth&&line){lines.push(line);line=char;}
      else line+=char;
    }
  }
  if(line)lines.push(line);
  return lines;
}

export async function POST(){
 try{
  const a=await access();
  if(!a.user)return NextResponse.json({error:'Unauthenticated'},{status:401});
  if(!a.companyId)return NextResponse.json({error:'Company context required'},{status:403});
  if(!a.can('selfservice.view'))return NextResponse.json({error:'Forbidden'},{status:403});
  if(!a.user.employeeId)return NextResponse.json({error:'Account not linked to an employee'},{status:403});

  const employee=await db.employee.findFirst({
    where:{id:a.user.employeeId,companyId:a.companyId},
    select:{id:true,employeeNo:true,firstName:true,lastName:true,hireDate:true,status:true,position:true,department:true,branch:{select:{name:true}}}
  });
  if(!employee||employee.status!=='ACTIVE')return NextResponse.json({error:'Only active employees may generate this letter'},{status:403});

  const compensation=await db.employeeCompensation.findFirst({
    where:{employeeId:employee.id,companyId:a.companyId,status:'APPROVED',effectiveDate:{lte:new Date()}},
    orderBy:[{effectiveDate:'desc'},{createdAt:'desc'}],
    select:{basicSalary:true,currency:true,allowances:true,effectiveDate:true}
  });
  if(!compensation)return NextResponse.json({error:'No effective approved compensation package is available. Contact HR.'},{status:409});

  const company=await db.company.findUnique({
    where:{id:a.companyId},select:{name:true,email:true,phone:true,logoDataUrl:true}
  });
  if(!company)return NextResponse.json({error:'Company record not found'},{status:409});

  const allowances=Array.isArray(compensation.allowances)
    ? compensation.allowances.flatMap((raw:unknown)=>{
        if(!raw||typeof raw!=='object'||Array.isArray(raw))return [];
        const item=raw as Record<string,unknown>;
        const label=typeof item.label==='string'?item.label:typeof item.name==='string'?item.name:'';
        const value=Number(item.amount);
        return label.trim()&&Number.isFinite(value)&&value>=0?[{label:label.trim(),amount:value}]:[];
      })
    : [];
  const basic=Number(compensation.basicSalary);
  if(!Number.isFinite(basic)||basic<0)return NextResponse.json({error:'Invalid approved salary data. Contact HR.'},{status:409});
  const grossMonthly=basic+allowances.reduce((sum,row)=>sum+row.amount,0);
  const grossAnnual=grossMonthly*12;
  const money=(value:number)=>printable(compensation.currency)+' '+new Intl.NumberFormat('en-GH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const date=(value:Date)=>value.toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
  const name=[employee.firstName,employee.lastName].filter(Boolean).join(' ');
  const ref='EVL-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+randomUUID().slice(0,8).toUpperCase();

  const pdf=await PDFDocument.create();
  const page=pdf.addPage([595.28,841.89]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.11,.16,.25),muted=rgb(.35,.41,.49),rule=rgb(.83,.86,.9);
  const left=51,right=544,width=right-left;
  const draw=(value:unknown,x:number,y:number,size=10,heavy=false,color=ink)=>{
    const font=heavy?bold:regular;
    page.drawText(printable(value),{x,y,size,font,color});
  };
  const paragraph=(value:string,startY:number,size=10.2,lineHeight=15.5)=>{
    let y=startY;
    for(const line of wrapText(value,regular,size,width)){
      draw(line,left,y,size);y-=lineHeight;
    }
    return y;
  };
  const separator=(y:number)=>page.drawLine({start:{x:left,y},end:{x:right,y},thickness:.8,color:rule});

  await addCompanyLogo(pdf,page,company.logoDataUrl,470,753,74,65);
  draw(company.name.toUpperCase(),left,788,18,true);
  let headerY=768;
  if(company.email){draw('Email: '+company.email,left,headerY,9,false,muted);headerY-=14;}
  if(company.phone){draw('Telephone: '+company.phone,left,headerY,9,false,muted);headerY-=14;}
  separator(Math.min(741,headerY-5));
  draw('EMPLOYMENT & SALARY CONFIRMATION',left,706,14,true);
  draw('Date: '+date(new Date()),left,683,9.5);
  draw('Reference No.: '+ref,left,668,9.5);
  draw('TO WHOM IT MAY CONCERN',left,638,10.5,true);
  let y=613;
  y=paragraph('This letter serves to officially confirm that '+name+' is a bona fide employee of '+company.name+', currently employed in the capacity indicated below.',y);
  y-=8;
  y=paragraph('We hereby certify that the employee is duly engaged by our organization and remains in active employment as of the date of issuance of this letter.',y);
  y-=8;
  y=paragraph("The employee's employment and remuneration details, as maintained in our official records, are provided below for your reference and verification.",y);
  y-=18;
  draw('EMPLOYMENT DETAILS',left,y,10.5,true);y-=18;
  const details:[string,string][]=[
    ['Employee Name',name],
    ['Employee ID',employee.employeeNo],
    ['Job Title',employee.position||'Not recorded'],
    ['Department',employee.department||'Not recorded'],
    ['Branch',employee.branch?.name||'Not recorded'],
    ['Date of Employment',date(employee.hireDate)],
    ['Employment Status','Active']
  ];
  for(const [label,value] of details){
    draw(label,left,y,9.4,true);
    const lines=wrapText(value,regular,9.4,300);
    for(const line of lines){draw(line,244,y,9.4);y-=14;}
    y-=4;
  }
  y-=10;
  draw('COMPENSATION DETAILS',left,y,10.5,true);y-=16;
  separator(y+4);
  const salaryRows:[string,number,boolean][]=[
    ['Basic Monthly Salary',basic,false],
    ...allowances.map(item=>[item.label,item.amount,false] as [string,number,boolean]),
    ['Total Gross Monthly Salary',grossMonthly,true],
    ['Total Gross Annual Salary',grossAnnual,true]
  ];
  for(const [label,value,heavy] of salaryRows){
    const labelLines=wrapText(label,heavy?bold:regular,9.2,285);
    const rowHeight=Math.max(20,labelLines.length*13+7);
    if(y-rowHeight<164)return NextResponse.json({error:'Too many compensation items to fit this letter. Contact HR.'},{status:409});
    if(heavy)separator(y+3);
    for(const line of labelLines){draw(line,left,y-12,9.2,heavy);y-=13;}
    const salaryText=money(value);draw(salaryText,right-(heavy?bold:regular).widthOfTextAtSize(salaryText,9.2),y+1,9.2,heavy);
    y-=rowHeight-labelLines.length*13;
  }
  y-=12;
  y=paragraph('We respectfully request that the bearer of this letter be accorded all necessary assistance, consideration, and courtesies to which they may be entitled in connection with the purpose for which this confirmation is presented.',y,9.5,14);
  y-=8;
  y=paragraph("This letter has been issued at the request of the employee for official purposes and confirms their employment status and remuneration based on the company's records as of the date stated above.",y,9.5,14);
  y-=8;
  y=paragraph('Should you require further clarification or verification, please contact the company through its official communication channels.',y,9.5,14);
  if(y<91)return NextResponse.json({error:'Letter content exceeds one page. Contact HR.'},{status:409});
  y-=14;
  draw('Yours faithfully,',left,y,9.5);y-=19;
  draw('For: '+company.name,left,y,9.5,true);y-=17;
  draw('Human Resources Department',left,y,9.5,true);
  separator(51);
  draw('Document Reference: '+ref,left,37,8,false,muted);
  // No system-generated, no-approval disclaimer, and no fictitious signature.
  const bytes=await pdf.save();

  await db.employeeHRRequest.create({data:{
    companyId:a.companyId,employeeId:employee.id,
    category:'EMPLOYMENT_VERIFICATION_LETTER',
    subject:'Employment and salary confirmation - '+ref,
    details:JSON.stringify({issuedAt:new Date().toISOString(),reference:ref,companyId:a.companyId,employeeId:employee.id,compensationEffectiveDate:compensation.effectiveDate.toISOString(),currency:compensation.currency,basicSalary:basic,allowances,grossMonthly,grossAnnual}),
    status:'COMPLETED',response:'Document reference: '+ref
  }});
  return new NextResponse(Buffer.from(bytes),{headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="Employment-Confirmation-'+ref+'.pdf"',
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(error){
  console.error('ESS employment letter generation failed',error);
  return NextResponse.json({error:'Unable to generate employment confirmation letter. Contact HR.'},{status:500});
 }
}
