import {NextRequest,NextResponse} from 'next/server';
import ExcelJS from 'exceljs';
import {compensationAccess,scopedEmployee,db} from '../helpers';

export const runtime='nodejs';
const HEADERS=['Employee ID','Basic Salary','Effective Date','Housing Allowance','Transport Allowance','Meal Allowance','Other Allowances','Recurring Deductions','Benefits','Reason'];
const MAX_BYTES=2*1024*1024;
const MAX_ROWS=200;
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
function dateString(value:unknown):string{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);
  if(typeof value==='number'&&Number.isFinite(value)){
    const ms=Math.round((value-25569)*86400000);const d=new Date(ms);
    if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
  }
  return String(value??'').trim();
}
function textValue(value:unknown):string{
  if(value===null||value===undefined)return '';
  if(typeof value==='object'){
    const v=value as {text?:string;result?:unknown;richText?:Array<{text:string}>};
    if(typeof v.text==='string')return v.text.trim();
    if(v.result!==undefined)return String(v.result??'').trim();
    if(Array.isArray(v.richText))return v.richText.map(x=>x.text).join('').trim();
  }
  return String(value).trim();
}
function amount(value:unknown,name:string,row:number):number{
  const s=textValue(value).replace(/,/g,'');
  if(!s)return 0;
  if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error(`Row ${row}: ${name} must be a nonnegative amount with at most 2 decimals`);
  const n=Number(s);
  if(!Number.isFinite(n)||n>1e9)throw Error(`Row ${row}: ${name} is out of range`);
  return n;
}
function validDate(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(`${s}T00:00:00.000Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s}
async function permission(){const {a,canEdit}=await compensationAccess();return {a,canEdit}}
export async function GET(){
  try{
    const {a,canEdit}=await permission();
    if(!a.user)return json({error:'Unauthorized'},401);
    if(!canEdit)return json({error:'HR edit permission required'},403);
    const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Compensation');
    sheet.addRow(HEADERS);sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC91B26'}};
    sheet.columns=[{width:19},{width:17},{width:19},{width:21},{width:22},{width:19},{width:20},{width:23},{width:16},{width:38}];
    sheet.getColumn(3).numFmt='yyyy-mm-dd';sheet.views=[{state:'frozen',ySplit:1}];
    const instructions=book.addWorksheet('Instructions');
    instructions.addRow(['Employee ID must match an existing HRMS employee number (e.g., FNL-00001).']);
    instructions.addRow(['Basic Salary and Effective Date are required. Enter dates as YYYY-MM-DD.']);
    instructions.addRow(['All amounts are monthly GHS, nonnegative, and up to two decimal places.']);
    instructions.addRow(['Optional allowance, deduction and benefit columns create labeled items.']);
    instructions.addRow(['All uploaded records are DRAFTS and require separate submission and approval.']);
    instructions.getColumn(1).width=110;
    const buffer=await book.xlsx.writeBuffer();
    return new NextResponse(buffer as BodyInit,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Nexora_Compensation_Template.xlsx"','Cache-Control':'private, no-store'}});
  }catch(e){console.error('[compensation bulk template]',e);return json({error:'Unable to generate template'},500)}
}
export async function POST(req:NextRequest){
  try{
    const {a,canEdit}=await permission();
    if(!a.user)return json({error:'Unauthorized'},401);
    if(!canEdit)return json({error:'HR edit permission required'},403);
    const form=await req.formData();const file=form.get('file');const mode=form.get('mode');
    if(mode!=='preview'&&mode!=='commit')return json({error:'Invalid upload mode'},400);
    if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx')||file.size===0||file.size>MAX_BYTES)return json({error:'Upload an .xlsx file smaller than 2 MB'},400);
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as any);
    const sheet=workbook.worksheets[0];if(!sheet)return json({error:'Spreadsheet has no worksheet'},400);
    const actual=HEADERS.map((_,i)=>textValue(sheet.getRow(1).getCell(i+1).value));
    if(actual.some((v,i)=>v!==HEADERS[i]))return json({error:'Template columns do not match. Download and use the official Excel template.'},400);
    const records:Array<{row:number;employeeNo:string;basicSalary:number;effectiveDate:string;allowances:Array<{label:string;amount:number}>;deductions:Array<{label:string;amount:number}>;benefits:Array<{label:string;amount:number}>;reason:string}>=[];
    const errors:string[]=[];
    for(let i=2;i<=sheet.rowCount;i++){
      const row=sheet.getRow(i);if(HEADERS.every((_,j)=>!textValue(row.getCell(j+1).value)))continue;
      if(records.length+errors.length>=MAX_ROWS){errors.push(`Maximum ${MAX_ROWS} rows per upload`);break}
      try{
        const employeeNo=textValue(row.getCell(1).value).toUpperCase();
        if(!employeeNo)throw Error(`Row ${i}: Employee ID is required`);
        if(!textValue(row.getCell(2).value))throw Error(`Row ${i}: Basic Salary is required`);
        const basicSalary=amount(row.getCell(2).value,'Basic Salary',i);
        const effectiveDate=dateString(row.getCell(3).value);
        if(!validDate(effectiveDate))throw Error(`Row ${i}: Effective Date must be YYYY-MM-DD`);
        const allowances=[['Housing Allowance',4],['Transport Allowance',5],['Meal Allowance',6],['Other Allowances',7]].map(([label,col])=>({label:String(label),amount:amount(row.getCell(Number(col)).value,String(label),i)})).filter(x=>x.amount>0);
        const deduction=amount(row.getCell(8).value,'Recurring Deductions',i);
        const benefit=amount(row.getCell(9).value,'Benefits',i);
        const reason=textValue(row.getCell(10).value).slice(0,1000);
        records.push({row:i,employeeNo,basicSalary,effectiveDate,allowances,deductions:deduction?[{label:'Recurring deductions',amount:deduction}]:[],benefits:benefit?[{label:'Benefits',amount:benefit}]:[],reason});
      }catch(e){errors.push(e instanceof Error?e.message:`Row ${i}: Invalid data`)}
    }
    if(!records.length)errors.push('No valid employee rows found');
    const unique=new Set<string>();
    for(const r of records){const key=`${r.employeeNo}|${r.effectiveDate}`;if(unique.has(key))errors.push(`Row ${r.row}: Duplicate Employee ID and Effective Date in file`);unique.add(key)}
    const employees=await db.employee.findMany({where:{AND:[scopedEmployee(a),{employeeNo:{in:records.map(r=>r.employeeNo)}}]},select:{id:true,employeeNo:true,firstName:true,lastName:true}});
    const byNo=new Map(employees.map(e=>[e.employeeNo.toUpperCase(),e]));
    for(const r of records)if(!byNo.has(r.employeeNo))errors.push(`Row ${r.row}: Employee ${r.employeeNo} not found or outside your scope`);
    const rows=records.map(r=>({employeeNo:r.employeeNo,employeeName:byNo.has(r.employeeNo)?`${byNo.get(r.employeeNo)!.firstName} ${byNo.get(r.employeeNo)!.lastName}`:'Not found',basicSalary:r.basicSalary,effectiveDate:r.effectiveDate,allowances:r.allowances.reduce((s,x)=>s+x.amount,0),deductions:r.deductions.reduce((s,x)=>s+x.amount,0)}));
    if(errors.length)return json({valid:false,mode,count:records.length,errors,rows},422);
    if(mode==='preview')return json({valid:true,mode,count:records.length,rows,errors:[]});
    await db.$transaction(async tx=>{
      for(const r of records){
        const employee=byNo.get(r.employeeNo)!;
        // Verify the employee is still in scope at commit time.
        const inScope=await tx.employee.findFirst({where:{AND:[scopedEmployee(a),{id:employee.id}]},select:{id:true}});
        if(!inScope)throw Error(`Employee ${r.employeeNo} is no longer available`);
        await tx.employeeCompensation.create({data:{employeeId:employee.id,basicSalary:r.basicSalary.toFixed(2),effectiveDate:new Date(`${r.effectiveDate}T00:00:00.000Z`),allowances:r.allowances,deductions:r.deductions,benefits:r.benefits,reason:r.reason,createdById:a.user!.id}});
      }
    },{timeout:30000});
    return json({valid:true,mode,created:records.length,count:records.length});
  }catch(e){console.error('[compensation bulk]',e);return json({error:e instanceof Error?e.message:'Unable to process bulk compensation file'},400)}
}
