/**
 * Nex HR leave and benefits policy validation and governance (read-only).
 * Run: npx tsx --env-file=.env tests/nexhr-leave-benefits-governance.test.ts
 * Requires NEXHR_TEST_COMPANY_ID. Optional NEXHR_TEST_REPEAT=2.
 * Calls OpenAI through the existing Nex HR answer service when configured; may incur charges.
 * Never writes to the database. Does not make policy decisions for HR.
 */
import assert from 'node:assert/strict';

const POLICY_ID='cmwlk10oi0005o80xkn6atz96';
const normalize=(s:string)=>s.toLowerCase().replace(/\s+/g,' ');
const checks=[
 {name:'Annual leave',question:'What is the annual leave entitlement and number of days?',
  evidence:/at least\s+15\s+working\s+days/i,
  answer:/\b15\s+working\s+days\b/i},
 {name:'Benefits eligibility',question:'Who is eligible for employee benefits and what exclusions apply?',
  evidence:/mandatory benefits apply as required by law|statutory benefits apply irrespective|discretionary benefits apply only after written approval/i,
  answer:/\b(statutory|mandatory|discretionary|eligible|eligibility)\b/i},
 {name:'Leave approval',question:'Who approves annual leave requests?',
  evidence:/authorized approver confirms/i,
  answer:/\b(authorized approver|authorized management|final approv|approver)\b/i},
 {name:'Sick leave',question:'Is there a fixed number of paid sick leave days?',
  evidence:/no fixed paid sick.day cap/i,
  answer:/\b(no fixed|not specified|not establish|depends on|subject to)\b/i},
 {name:'Paternity leave conditional',question:'Is paternity leave an unconditional statutory entitlement of three paid days?',
  evidence:/proposed discretionary benefit:\s*3 paid working days/i,
  answer:/\b(discretionary|management approval|not (a |an )?statutory|subject to|conditional)\b/i},
];
async function main(){
 try{process.loadEnvFile('.env')}catch{}
 const companyId=process.env.NEXHR_TEST_COMPANY_ID;
 if(!companyId)throw Error('Set NEXHR_TEST_COMPANY_ID to the actual Company.id.');
 const [{db},{retrieve,answerWithSources,REFUSAL}]=await Promise.all([import('../lib/db'),import('../lib/nexhr-chat')]);
 let passed=0,failed=0;
 const check=(name:string,ok:boolean)=>{console.log(ok?'PASS':'FAIL',name);ok?passed++:failed++};
 try{
  const doc=await db.nexHrDocument.findFirst({where:{id:POLICY_ID,companyId},select:{id:true,title:true,status:true,visibility:true,effectiveAt:true,expiresAt:true}});
  check('Approved policy exists in chosen company',!!doc);
  if(!doc)throw Error('Policy document ID not found for chosen company. Confirm the company ID and current policy version.');
  const now=new Date();
  check('Policy database status APPROVED',doc.status==='APPROVED');
  check('Policy currently effective',(!doc.effectiveAt||doc.effectiveAt<=now)&&(!doc.expiresAt||doc.expiresAt>now));
  check('Policy visible to employee',doc.visibility==='ALL_EMPLOYEES');
  const access={companyId,user:{id:'read-only-governance-test'},can:()=>false,keys:new Set<string>()} as any;
  const repeat=Math.min(5,Math.max(1,Number(process.env.NEXHR_TEST_REPEAT)||2));
  const aiReady=!!process.env.NEXHR_OPENAI_API_KEY;
  for(const item of checks){
   const evidence=await retrieve(access,item.question);
   check(`${item.name}: source is approved policy`,evidence.some(e=>e.documentId===doc.id));
   check(`${item.name}: all evidence authorized`,evidence.every(e=>e.documentId===doc.id));
   check(`${item.name}: source supports expected rule`,evidence.some(e=>item.evidence.test(normalize(e.excerpt))));
   if(!aiReady){console.log('SKIP live AI answer:',item.name,'(NEXHR_OPENAI_API_KEY missing)');continue}
   for(let i=0;i<repeat;i++){
    const result=await answerWithSources(item.question,evidence);
    check(`${item.name} attempt ${i+1}: generated answer`,result.mode==='openai'&&result.text!==REFUSAL);
    check(`${item.name} attempt ${i+1}: answer contains expected fact`,item.answer.test(normalize(result.text)));
    check(`${item.name} attempt ${i+1}: source citations`,result.usedEvidence.length>0&&result.usedEvidence.every(e=>evidence.some(x=>x.documentId===e.documentId&&x.excerpt===e.excerpt)));
    console.log('RESULT',item.name,`attempt=${i+1}`,`mode=${result.mode}`,`citations=${result.usedEvidence.length}`);
   }
  }
  const refusal=await answerWithSources('Unsupported request',[]);
  check('Unsupported request refuses without citations',refusal.mode==='refusal'&&refusal.text===REFUSAL&&refusal.usedEvidence.length===0);
  console.log(`\n${failed?'FAIL':'PASS'}: ${passed} checks passed; ${failed} failed.`);
  console.log('Governance note: approved database status does not remove historical DRAFT wording from document content. Update and reupload the signed policy when available.');
  console.log('LIMITATION: Keyword checks do not establish complete factual accuracy. HR must review full generated answers.');
  if(failed)process.exitCode=1;
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error('FAIL:',e instanceof Error?e.message:String(e));process.exitCode=1});
