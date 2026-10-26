/* Phase 16.1: isolated demo database seed/preview/delete. No live payment instructions. */
const {PrismaClient}=require('@prisma/client');
const prisma=new PrismaClient();
const TAG='FNL-SYNTH-16-1';
const arg=process.argv[2];
const count=Number(process.argv[3]||40);
function assertDemo(){
 const raw=process.env.DATABASE_URL||'';
 if(!raw)throw Error('DATABASE_URL is missing');
 const u=new URL(raw);
 const db=decodeURIComponent(u.pathname.replace(/^\//,''));
 const isProduction=!/demo|sandbox|staging|test/i.test(db);
 if(isProduction){
   if(process.env.ALLOW_SYNTHETIC_PRODUCTION!=='I_UNDERSTAND')throw Error('Production synthetic seeding disabled. Set ALLOW_SYNTHETIC_PRODUCTION=I_UNDERSTAND only after independent backup and isolation review.');
   if(process.env.CONFIRM_SYNTHETIC_PAYROLL_ISOLATION!=='VERIFIED')throw Error('Production requires independently verified exclusions from payroll processing, exports and statutory filing.');
 }else if(process.env.CONFIRM_DEMO_DATABASE!=='YES')throw Error('Set CONFIRM_DEMO_DATABASE=YES after checking DATABASE_URL.');
 console.log('Target database:',u.hostname+'/'+db,'production:',isProduction);
}

const branches=['East Legon','Haatso','Kingsby','T-Junction','Dansoman','Head Office'];
const jobs=[['Operations','Restaurant Assistant',1900],['Kitchen','Cook',2400],['Customer Service','Service Associate',2100],['Delivery','Delivery Associate',1800],['Operations','Shift Supervisor',3200],['Finance','Accounts Officer',3800],['HR','HR Officer',4000],['Procurement','Stores Officer',2900],['Marketing','Marketing Executive',3400],['IT','IT Support',4200]];
const names=['Ama','Kojo','Abena','Yaw','Akosua','Kofi','Efua','Kwame','Adwoa','Kweku','Nana','Esi','Afia','Fiifi','Adjoa','Selorm'];
const surnames=['Mensah','Owusu','Boateng','Asante','Osei','Addo','Agyeman','Arthur','Darko','Antwi','Opoku','Amoah'];
const dt=s=>new Date(s+'T12:00:00.000Z');
async function findDemo(){return prisma.employee.findMany({where:{employeeNo:{startsWith:TAG}},select:{id:true,employeeNo:true}})}
async function preview(){
 const es=await findDemo(),ids=es.map(x=>x.id);
 const batches=await prisma.payrollCalculationBatch.findMany({where:{createdById:TAG},select:{id:true,period:true,status:true,employeeCount:true,grossAmount:true}});
 const out={demoEmployees:ids.length,leave:await prisma.leaveRequest.count({where:{employeeId:{in:ids}}}),appraisals:await prisma.appraisal.count({where:{employeeId:{in:ids}}}),pips:await prisma.performanceImprovementPlan.count({where:{employeeId:{in:ids}}}),compensation:await prisma.employeeCompensation.count({where:{employeeId:{in:ids}}}),attendance:await prisma.payrollAttendance.count({where:{employeeId:{in:ids}}}),training:await prisma.training.count({where:{description:{startsWith:TAG}}}),vacancies:await prisma.jobOpening.count({where:{title:{startsWith:TAG}}}),payrollDrafts:batches.map(b=>({period:b.period,status:b.status,employees:b.employeeCount,gross:String(b.grossAmount)}))};
 console.log(JSON.stringify(out,null,2));return {ids,batches};
}
async function seed(){
 if(!Number.isInteger(count)||count<30||count>50)throw Error('Employee count must be 30–50');
 if((await findDemo()).length)throw Error('Existing synthetic employees detected. Preview/delete before reseeding.');
 if(await prisma.payrollCalculationBatch.count({where:{createdById:TAG}}))throw Error('Existing synthetic payroll drafts detected. Delete before reseeding.');
 const b=await Promise.all(branches.map(name=>prisma.branch.upsert({where:{name},update:{},create:{name}})));
 const staff=[];
 for(let i=0;i<count;i++){
  const [department,position,basic]=jobs[(i*7+Math.floor(i/6))%jobs.length];
  const firstName=names[i%names.length],lastName=surnames[(i*5+Math.floor(i/12))%surnames.length];
  const employee=await prisma.employee.create({data:{employeeNo:`${TAG}-${String(i+1).padStart(3,'0')}`,email:`synthetic16_1_${i+1}@example.invalid`,firstName,lastName,branchId:b[i%6].id,department,position,status:i%17===0?'ON_LEAVE':'ACTIVE',hireDate:dt('2025-01-15'),notes:`${TAG} synthetic record; excluded from real payroll`}});
  staff.push({employee,basic});
  await prisma.employeeCompensation.create({data:{employeeId:employee.id,effectiveDate:dt('2026-05-01'),basicSalary:basic,allowances:[{name:'Transport (DEMO)',amount:100}],deductions:[],benefits:[],status:'DRAFT',createdById:TAG,reason:`${TAG} SIMULATION ONLY — not approved for payroll`}});
  await prisma.appraisal.create({data:{employeeId:employee.id,title:`${TAG} Quarterly Performance`,period:'2026-Q3',score:2.8+(i%18)/10,status:i%5===0?'SUBMITTED':'APPROVED'}});
  if(i%2===0)await prisma.leaveRequest.create({data:{employeeId:employee.id,type:'ANNUAL',startDate:dt(i%4===0?'2026-10-25':'2026-11-10'),endDate:dt(i%4===0?'2026-10-27':'2026-11-12'),days:3,status:i%3===0?'PENDING':'APPROVED',reason:`${TAG} synthetic leave`}});
  if(i%8===0)await prisma.performanceImprovementPlan.create({data:{employeeId:employee.id,title:`${TAG} Skills Development`,reason:'Synthetic coaching scenario',goals:[{goal:'Complete service quality training'}],status:i%16===0?'ACTIVE':'COMPLETED',startDate:dt('2026-09-01'),dueDate:dt('2026-11-30'),createdById:TAG}});
  for(let day=1;day<=5;day++)await prisma.payrollAttendance.create({data:{employeeId:employee.id,workDate:dt(`2026-10-${String(day+4).padStart(2,'0')}`),clockIn:'09:00',clockOut:'18:00',breakMinutes:60,regularMinutes:480,overtimeMinutes:i%5===0?60:0,status:'DRAFT',submittedById:TAG,notes:`${TAG} synthetic attendance`}});
 }
 for(let i=0;i<8;i++)await prisma.training.create({data:{title:`${TAG} Training ${i+1}`,description:`${TAG} synthetic training program`,status:i%3===0?'PLANNED':'COMPLETED'}});
 for(let i=0;i<5;i++)await prisma.jobOpening.create({data:{title:`${TAG} Vacancy ${i+1}`,branchId:b[i].id,status:'OPEN'}});
 // Synthetic DRAFT snapshots only: no PAYE, SSNIT, approvals, payslips or payments.
 for(let m=5;m<=10;m++){
  const period=`2026-${String(m).padStart(2,'0')}`;
  const lines=staff.map(({employee,basic},i)=>({employeeId:employee.id,employeeNo:employee.employeeNo,employeeName:`${employee.firstName} ${employee.lastName}`,branch:b[i%6].name,basicSalary:basic,allowances:100,gross:basic+100,netBeforeStatutory:basic+100,simulation:true,statutoryComplete:false}));
  const gross=lines.reduce((s,l)=>s+l.gross,0);
  await prisma.payrollCalculationBatch.create({data:{period,status:'DRAFT',currency:'GHS',employeeCount:staff.length,grossAmount:gross,netBeforeStatutory:gross,lineItems:lines,createdById:TAG}});
 }
 console.log(`Created ${count} synthetic employees and 6 DRAFT payroll simulations. No approved payroll or payments created.`);
 await preview();
}
async function remove(){
 const {ids,batches}=await preview();
 if(process.env.CONFIRM_DELETE_DEMO!=='DELETE')throw Error('Preview only. Set CONFIRM_DELETE_DEMO=DELETE to delete the demo records.');
 for(const batch of batches){if(batch.status!=='DRAFT')throw Error('REFUSED: a demo batch is no longer DRAFT');const n=await prisma.payrollPayment.count({where:{batchId:batch.id}});if(n)throw Error('REFUSED: demo batch has payment records');const a=await prisma.payrollApprovalEvent.count({where:{batchId:batch.id}});if(a)throw Error('REFUSED: demo batch has approval events');}
 if(await prisma.user.count({where:{employeeId:{in:ids}}}))throw Error('REFUSED: demo employees linked to login accounts');
 if(await prisma.appraisalReview.count({where:{employeeId:{in:ids}}}))throw Error('REFUSED: demo employees have appraisal reviews outside seed scope');
 if(await prisma.payrollPayment.count({where:{employeeId:{in:ids}}}))throw Error('REFUSED: demo employees linked to payments');
 await prisma.$transaction(async tx=>{
  await tx.payrollCalculationBatch.deleteMany({where:{createdById:TAG,status:'DRAFT'}});
  await tx.payrollAttendance.deleteMany({where:{employeeId:{in:ids},submittedById:TAG}});
  await tx.employeeCompensation.deleteMany({where:{employeeId:{in:ids},createdById:TAG}});
  await tx.performanceImprovementPlan.deleteMany({where:{employeeId:{in:ids},createdById:TAG}});
  await tx.leaveRequest.deleteMany({where:{employeeId:{in:ids},reason:{startsWith:TAG}}});
  await tx.appraisal.deleteMany({where:{employeeId:{in:ids},title:{startsWith:TAG}}});
  await tx.jobOpening.deleteMany({where:{title:{startsWith:TAG}}});
  await tx.training.deleteMany({where:{description:{startsWith:TAG}}});
  await tx.employee.deleteMany({where:{id:{in:ids},employeeNo:{startsWith:TAG}}});
 },{timeout:60000});
 console.log('Synthetic seed records deleted. Existing branches preserved.');
}
(async()=>{assertDemo();if(arg==='preview')await preview();else if(arg==='seed')await seed();else if(arg==='delete')await remove();else throw Error('Usage: node scripts/demo-data.cjs seed [30-50] | preview | delete')})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
