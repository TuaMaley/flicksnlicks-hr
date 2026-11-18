/**
 * Nex HR read-only knowledge integration checks.
 * Run from project root: npx tsx tests/nexhr-live-knowledge.test.ts
 * Optional: NEXHR_TEST_COMPANY_ID=<company-id> (otherwise exits with instructions).
 * Optional: NEXHR_TEST_ANSWER=1 to run actual AI answer verification (may incur API charges).
 * Uses ALL_EMPLOYEES visibility, without manager/HR privileges.
 * Never writes database records or sends requests to the deployed web app.
 */
import assert from 'node:assert/strict';

async function main(){
 try { process.loadEnvFile('.env'); } catch { /* environment may be provided by shell */ }
 const companyId=process.env.NEXHR_TEST_COMPANY_ID;
 if(!companyId){
  console.error('Set NEXHR_TEST_COMPANY_ID to the exact company ID to test. No database access was attempted.');
  process.exitCode=2;return;
 }
 const [{db},{retrieve,answerWithSources,REFUSAL}]=await Promise.all([
  import('../lib/db'),import('../lib/nexhr-chat')
 ]);
 let passed=0;
 const check=(name:string,ok:boolean)=>{assert.ok(ok,name);console.log('PASS',name);passed++};
 const now=new Date();
 try {
  const company=await db.company.findUnique({where:{id:companyId},select:{id:true}});
  check('company exists',!!company);
  const docs=await db.nexHrDocument.findMany({where:{companyId},select:{id:true,title:true,version:true,familyId:true,status:true,visibility:true,effectiveAt:true,expiresAt:true},take:500});
  const eligible=docs.filter(d=>d.status==='APPROVED'&&(!d.effectiveAt||d.effectiveAt<=now)&&(!d.expiresAt||d.expiresAt>now)&&d.visibility==='ALL_EMPLOYEES');
  const ineligible=new Set(docs.filter(d=>!eligible.some(e=>e.id===d.id)).map(d=>d.id));
  const mockAccess={companyId,user:{id:'read-only-test-user'},can:(_permission:string)=>false,keys:new Set<string>()} as any;
  console.log(`Found ${docs.length} documents in sampled company metadata; ${eligible.length} approved, effective and employee-visible.`);
  check('document metadata belongs to chosen company',docs.every(d=>d.id&&d.title));
  check('eligible metadata excludes unapproved documents',eligible.every(d=>d.status==='APPROVED'));
  check('eligible metadata excludes expired documents',eligible.every(d=>!d.expiresAt||d.expiresAt>now));
  check('eligible metadata excludes future-effective documents',eligible.every(d=>!d.effectiveAt||d.effectiveAt<=now));
  check('eligible metadata respects ALL_EMPLOYEES visibility',eligible.every(d=>d.visibility==='ALL_EMPLOYEES'));
  const queries=[
   'What is the second occurrence sanction for threats or intimidation?',
   'What is the annual leave entitlement?',
   'Who is eligible for employee benefits?',
   'Who approves leave requests?'
  ];
  for(const question of queries){
   const evidence=await retrieve(mockAccess,question);
   check('retrieval sources authorized: '+question,evidence.every(e=>eligible.some(d=>d.id===e.documentId)));
   check('retrieval excludes ineligible documents: '+question,evidence.every(e=>!ineligible.has(e.documentId)));
   check('retrieval source metadata valid: '+question,evidence.every(e=>!!e.title&&e.version>=1&&e.page!==undefined));
   console.log(`  ${question}: ${evidence.length} authorized evidence excerpt(s)`);
   if(process.env.NEXHR_TEST_ANSWER==='1'){
    const result=await answerWithSources(question,evidence);
    check('answer citations subset of retrieved evidence: '+question,result.usedEvidence.every(e=>evidence.some(s=>s.documentId===e.documentId&&s.page===e.page&&s.excerpt===e.excerpt)));
    check('answer/refusal shape valid: '+question,!!result.text.trim()&&(['openai','extractive','refusal'] as string[]).includes(result.mode));
    if(result.mode==='refusal')check('refusal does not invent citations: '+question,result.text===REFUSAL||result.text.length>0);
    console.log(`  Answer mode: ${result.mode}; citations: ${result.usedEvidence.length}`);
   }
  }
  console.log(`\nPASS: ${passed} live read-only Nex HR integration checks.`);
  if(!eligible.length)console.warn('NOTE: No approved, effective, employee-visible documents found; extraction/answer correctness was not exercised.');
  console.log('LIMITATION: These checks do not prove policy answers are factually correct; review against approved source documents.');
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error('FAIL:',e?.message||e);process.exitCode=1});
