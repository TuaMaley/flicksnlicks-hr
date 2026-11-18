/**
 * Nex HR live answer acceptance checks (read-only).
 * Run: npx tsx tests/nexhr-answer-accuracy.test.ts
 * Requires NEXHR_TEST_COMPANY_ID and NEXHR_OPENAI_API_KEY in env/.env.
 * Optional NEXHR_EXPECTED_LEAVE, NEXHR_EXPECTED_BENEFITS,
 * NEXHR_EXPECTED_APPROVER: exact short answer phrases verified by HR
 * against the current approved policy (do not guess these values).
 * Optional NEXHR_TEST_REPEAT=3 (default 2, maximum 5).
 * Calls the actual answer generation service; may incur OpenAI API charges.
 * Does not modify the database or production code.
 */
import assert from 'node:assert/strict';

async function main(){
 try{process.loadEnvFile('.env')}catch{}
 const id=process.env.NEXHR_TEST_COMPANY_ID;
 if(!id)throw Error('Set NEXHR_TEST_COMPANY_ID to the database Company.id.');
 if(!process.env.NEXHR_OPENAI_API_KEY)throw Error('Set NEXHR_OPENAI_API_KEY to run live answer checks.');
 const [{db},{retrieve,answerWithSources,REFUSAL}]=await Promise.all([import('../lib/db'),import('../lib/nexhr-chat')]);
 let passed=0,skipped=0;
 const check=(label:string,value:boolean)=>{assert.ok(value,label);console.log('PASS',label);passed++};
 const repeat=Math.min(5,Math.max(1,Number(process.env.NEXHR_TEST_REPEAT)||2));
 const cases=[
  {label:'Threats second occurrence',question:'What is the second occurrence sanction for threats or intimidation?',expected:'Suspension',page:7},
  {label:'Wrong orders third occurrence',question:'What is the third occurrence sanction for wrong orders due to negligence?',expected:'Final written warning',page:6},
  {label:'Unauthorized discounts first occurrence',question:'What is the first occurrence sanction for unauthorized discounts/free items?',expected:'Written warning',page:7},
  {label:'Annual leave',question:'What is the annual leave entitlement?',expected:process.env.NEXHR_EXPECTED_LEAVE},
  {label:'Benefits eligibility',question:'Who is eligible for employee benefits?',expected:process.env.NEXHR_EXPECTED_BENEFITS},
  {label:'Leave approver',question:'Who approves leave requests?',expected:process.env.NEXHR_EXPECTED_APPROVER},
 ];
 try{
  const company=await db.company.findUnique({where:{id},select:{id:true}});
  check('Company exists',!!company);
  const now=new Date();
  const docs=await db.nexHrDocument.findMany({where:{companyId:id,status:'APPROVED',OR:[{effectiveAt:null},{effectiveAt:{lte:now}}],AND:[{OR:[{expiresAt:null},{expiresAt:{gt:now}}]}]},select:{id:true,title:true,version:true,visibility:true},take:500});
  const authorized=new Set(docs.filter(d=>d.visibility==='ALL_EMPLOYEES').map(d=>d.id));
  check('Eligible employee-visible document exists',authorized.size>0);
  const employee={companyId:id,user:{id:'read-only-accuracy-test'},can:(_permission:string)=>false,keys:new Set<string>()} as any;
  for(const item of cases){
   if(!item.expected){console.log('SKIP',item.label,'— HR-verified expected answer not configured');skipped++;continue}
   for(let i=0;i<repeat;i++){
    const evidence=await retrieve(employee,item.question);
    check(`${item.label} attempt ${i+1}: evidence available`,evidence.length>0);
    check(`${item.label} attempt ${i+1}: evidence authorized`,evidence.every(e=>authorized.has(e.documentId)));
    const result=await answerWithSources(item.question,evidence);
    check(`${item.label} attempt ${i+1}: non-refusal`,result.mode!=='refusal'&&result.text!==REFUSAL);
    check(`${item.label} attempt ${i+1}: expected fact`,result.text.toLowerCase().includes(item.expected.toLowerCase()));
    check(`${item.label} attempt ${i+1}: citation present`,result.usedEvidence.length>0);
    check(`${item.label} attempt ${i+1}: citations are retrieved evidence`,result.usedEvidence.every(e=>evidence.some(x=>x.documentId===e.documentId&&x.page===e.page&&x.excerpt===e.excerpt)));
    if(item.page!==undefined)check(`${item.label} attempt ${i+1}: expected page`,result.usedEvidence.some(e=>e.page===item.page));
    // Print only status, never full policy text or personal information.
    console.log(`RESULT ${item.label}: mode=${result.mode}, citations=${result.usedEvidence.length}`);
   }
  }
  // No evidence must produce a refusal without invented citations.
  const noEvidence=await answerWithSources('What is the leave entitlement?',[]);
  check('No evidence: refusal',noEvidence.mode==='refusal'&&noEvidence.text===REFUSAL);
  check('No evidence: no citations',noEvidence.usedEvidence.length===0);
  console.log(`\nPASS: ${passed} live answer acceptance checks. SKIPPED: ${skipped} cases without HR-verified expectations.`);
  console.log('LIMITATION: Phrase matching is not semantic correctness; HR must review complete answers and policy context.');
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error('FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1});
