/**
 * Read-only HR review of approved leave/benefits evidence.
 * Run: npx tsx --env-file=.env tests/nexhr-hr-policy-review.test.ts
 * Set NEXHR_TEST_COMPANY_ID to the actual Company.id.
 * Outputs local source excerpts for HUMAN review; no AI answers or writes.
 * Do not share the output publicly: it may contain internal policy text.
 */
import {writeFileSync} from 'node:fs';

async function main(){
 const companyId=process.env.NEXHR_TEST_COMPANY_ID;
 if(!companyId)throw Error('Set NEXHR_TEST_COMPANY_ID to your actual database Company.id');
 const [{db},{retrieve}]=await Promise.all([import('../lib/db'),import('../lib/nexhr-chat')]);
 const company=await db.company.findUnique({where:{id:companyId},select:{id:true,name:true}});
 if(!company)throw Error('Company not found in connected database');
 const user={companyId,user:{id:'policy-review-readonly'},can:(_permission:string)=>false,keys:new Set<string>()} as any;
 const topics=[
  {name:'Annual leave entitlement',question:'What is the annual leave entitlement and number of days?'},
  {name:'Benefits eligibility',question:'Who is eligible for employee benefits and what exclusions apply?'},
  {name:'Leave approval authority',question:'Who approves annual leave requests?'},
  {name:'Sick leave',question:'What are the sick leave entitlement and conditions?'},
  {name:'Maternity and paternity leave',question:'What are the maternity and paternity leave entitlements?'},
 ];
 const lines=[`# Nex HR policy evidence review`, `Company: ${company.name}`,`Generated: ${new Date().toISOString()}`, '', 'Review these excerpts against the original approved documents. An excerpt is NOT a verified answer.', ''];
 for(const topic of topics){
  const evidence=await retrieve(user,topic.question);
  lines.push(`## ${topic.name}`,`Question: ${topic.question}`,`Retrieved excerpts: ${evidence.length}`,'');
  if(!evidence.length)lines.push('NO EVIDENCE FOUND — do not set an expected answer.','');
  for(const e of evidence.slice(0,5)){
   lines.push(`Source: ${e.title} v${e.version}, page ${e.page??'not specified'}, document ${e.documentId}`);
   lines.push('```',e.excerpt.slice(0,1500).replace(/```/g,'[code fence]'),'```','');
  }
  lines.push('HR-verified expected answer: [complete only after checking source]','');
 }
 const path='nexhr-hr-policy-evidence-review.md';
 writeFileSync(path,lines.join('\n'),'utf8');
 console.log(`Created ${path} for ${company.name}. Review privately before configuring expected-answer tests.`);
 console.log('No database records were modified and no AI answer-generation call was made.');
}
main().catch(e=>{console.error('FAIL:',e?.message??e);process.exitCode=1});
