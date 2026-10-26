/* Phase 16.1 production employee-only generator. No compensation, payroll, payments, or approvals. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PREFIX='FNL-SYN-16-1-';
const action=process.argv[2]||'preview';
const count=Number(process.argv[3]||40);
function guardWrite(){
  if (process.env.CONFIRM_PRODUCTION_EMPLOYEE_INSERT !== 'INSERT_40') {
    throw new Error('WRITE REFUSED: explicitly set CONFIRM_PRODUCTION_EMPLOYEE_INSERT=INSERT_40 to authorize production employee-only insertion.');
  }
  if (process.env.CONFIRM_NO_PAYROLL !== 'YES') {
    throw new Error('WRITE REFUSED: set CONFIRM_NO_PAYROLL=YES to acknowledge these are SUSPENDED employee-only records.');
  }
}

const jobs=[['Operations','Restaurant Assistant'],['Kitchen','Cook'],['Customer Service','Service Associate'],['Delivery','Delivery Associate'],['Operations','Shift Supervisor'],['Finance','Accounts Officer'],['HR','HR Officer'],['Procurement','Stores Officer'],['Marketing','Marketing Executive'],['IT','IT Support']];
const first=['Ama','Kojo','Abena','Yaw','Akosua','Kofi','Efua','Kwame','Adwoa','Kweku','Nana','Esi','Afia','Fiifi','Adjoa','Selorm'];
const last=['Mensah','Owusu','Boateng','Asante','Osei','Addo','Agyeman','Arthur','Darko','Antwi','Opoku','Amoah'];
async function main(){
 const rows=await prisma.employee.findMany({where:{employeeNo:{startsWith:PREFIX}},select:{id:true,employeeNo:true,branchId:true,status:true}});
 const branches=await prisma.branch.findMany({select:{id:true,name:true},orderBy:{name:'asc'}});
 console.log(JSON.stringify({action,employeesTotal:await prisma.employee.count(),syntheticEmployees:rows.length,branches:branches.map(b=>b.name),syntheticPreview:rows.slice(0,5)},null,2));
 if(action==='preview')return;
 guardWrite();
 if(action==='seed'){
   if(!Number.isInteger(count)||count<30||count>50)throw Error('Count must be between 30 and 50.');
   if(rows.length)throw Error('Existing synthetic employees detected; refusing duplicate generation.');
   if(branches.length!==6)throw Error('Expected exactly six existing branches; refusing to create or modify branches.');
   const distribution=[8,7,7,6,6,6];
   if(count!==40)throw Error('Stage one supports exactly 40 employees; other counts need an explicit branch distribution.');
   const byName=new Map(branches.map(b=>[b.name.toLowerCase(),b]));
   const names=['East Legon','Haatso','Kingsby','T-Junction','Dansoman','Head Office'];
   if(names.some(n=>!byName.has(n.toLowerCase())))throw Error('Branch names differ from expected values; review names before generating.');
   const data=[];let i=0;
   for(let b=0;b<names.length;b++)for(let k=0;k<distribution[b];k++){
      const [department,position]=jobs[(i*7+Math.floor(i/6))%jobs.length];
      data.push({employeeNo:PREFIX+String(i+1).padStart(3,'0'),email:`synthetic16_1_${i+1}@example.invalid`,firstName:first[i%first.length],lastName:last[(i*5+Math.floor(i/12))%last.length],department,position,branchId:byName.get(names[b].toLowerCase()).id,status:'SUSPENDED',notes:'SYNTHETIC TEST RECORD — NO PAYROLL, NO PAYMENT, NOT A REAL EMPLOYEE'});
      i++;
   }
   const result=await prisma.$transaction(async tx=>{
     if(await tx.employee.count({where:{employeeNo:{startsWith:PREFIX}}}))throw Error('Concurrent synthetic records detected.');
     return tx.employee.createMany({data,skipDuplicates:false});
   });
   console.log('CREATED '+result.count+' SUSPENDED synthetic employees; no payroll or HR dependent records.');
 } else if(action==='delete'){
   throw Error('Production deletion is disabled in this package.');
/*
   if(process.env.CONFIRM_DELETE_DEMO!=='DELETE')throw Error('Deletion requires CONFIRM_DELETE_DEMO=DELETE.');
   if(!rows.length){console.log('Nothing to delete.');return;}
   const ids=rows.map(x=>x.id);
   await prisma.$transaction(async tx=>{
     const models=['user','employeeCompensation','payrollAttendance','leaveRequest','appraisal','appraisalReview','performanceImprovementPlan','payrollPayment','ghanaPayrollAdjustment','leaveEntitlement','onboardingCase','disciplinaryCase','recognition'];
     for(const model of models){if(tx[model]&&await tx[model].count({where:{employeeId:{in:ids}}}))throw Error('DELETE REFUSED: related records found in '+model+'.');}
     const deleted=await tx.employee.deleteMany({where:{id:{in:ids},employeeNo:{startsWith:PREFIX}}});
     if(deleted.count!==ids.length)throw Error('DELETE REFUSED: count mismatch.');
   });
   console.log('Deleted '+ids.length+' staging synthetic employees.');
 */
} else throw Error('Usage: node scripts/synthetic-employees-production.cjs preview | seed 40');
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
