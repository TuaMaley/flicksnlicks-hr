/**
 * Nex HR policy safety / regression contract checks.
 * Run from project root: npx tsx tests/nexhr-policy-contracts.test.ts
 *
 * These checks exercise production sanctions matching and verify that key
 * policy retrieval, governance, inventory and access safeguards still exist.
 * Static checks are guardrails, NOT live database, PDF or LLM tests.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifiedMatrixSanction} from '../lib/nexhr-sanctions';

const read=(p:string)=>readFileSync(p,'utf8');
const chat=read('lib/nexhr-chat.ts');
const api=read('app/api/nex-hr/chat/route.ts');
const docs=read('app/api/nex-hr/documents/route.ts');
const access=read('lib/nexhr.ts');
const analytics=read('app/api/nex-hr/analytics/route.ts');
let checks=0;
function check(name:string,condition:boolean){
 assert.ok(condition,name);
 checks++;
 console.log('PASS',name);
}
function contains(name:string,source:string,pattern:RegExp){
 check(name,pattern.test(source));
}

// Live source contracts. Fail loudly if a later change removes a safeguard.
contains('retrieval filters by current company',chat,/companyId\s*:\s*a\.companyId/);
contains('retrieval requires APPROVED status',chat,/status\s*:\s*['"]APPROVED['"]/);
contains('retrieval enforces effective date',chat,/effectiveAt\s*:\s*\{\s*lte\s*:\s*now\s*\}/);
contains('retrieval enforces expiry date',chat,/expiresAt\s*:\s*\{\s*gt\s*:\s*now\s*\}/);
contains('retrieval checks document visibility',chat,/allowedToRead\s*\(\s*a\s*,\s*d\s*\)/);
contains('retrieval keeps source document IDs',chat,/documentId\s*:\s*d\.id/);
contains('retrieval keeps page citations',chat,/page\s*:\s*part\.page/);
contains('policy text is extracted from PDF',chat,/pdf-parse/);
contains('DOCX text extraction remains available',chat,/mammoth/);
contains('refusal response remains available',chat,/export const REFUSAL\s*=/);
contains('chat requires authentication gate',api,/await gate\s*\(/);
contains('chat thread lookup scoped to user',api,/userId\s*:\s*a\.user!\.id/);
contains('chat thread lookup scoped to company',api,/companyId\s*:\s*a\.companyId!/);
contains('chat retains source citations',api,/citations\s*:\s*cited/);
contains('document list scoped to company',docs,/companyId\s*:\s*a\.companyId!/);
contains('document list filters visibility',docs,/\.filter\s*\(\s*d\s*=>\s*allowedToRead\s*\(\s*a\s*,\s*d\s*\)\s*\)/);
contains('upload requires manage permission',docs,/gate\s*\(\s*['"]nexhr\.manage['"]\s*\)/);
contains('upload validates effective/expiry ordering',docs,/expiresAt\s*<=\s*effectiveAt/);
contains('regular employees only read approved documents',access,/d\.status\s*===\s*['"]APPROVED['"]/);
contains('analytics scoped to company',analytics,/companyId\s*:\s*a\.companyId/);

// Exact deterministic sanction checks using representative synthetic rows.
// The suite intentionally makes no claim about the actual approved PDF.
const evidence=[
 {documentId:'d1',title:'Synthetic sanctions',version:1,page:7,score:1,excerpt:'Sanctions matrix row: Offence / Issue: Workplace Violence Threats or intimidation; 1st Occurrence: Final written warning; 2nd Occurrence: Suspension; 3rd Occurrence / Severe Case: Termination.'},
 {documentId:'d2',title:'Synthetic sanctions',version:1,page:6,score:1,excerpt:'Sanctions matrix row: Offence / Issue: Customer Service Wrong orders due to negligence; 1st Occurrence: Verbal warning; 2nd Occurrence: Written warning; 3rd Occurrence / Severe Case: Final written warning.'},
 {documentId:'d3',title:'Synthetic sanctions',version:1,page:7,score:1,excerpt:'Sanctions matrix row: Offence / Issue: Theft & Fraud Unauthorized discounts/free items; 1st Occurrence: Written warning; 2nd Occurrence: Final written warning; 3rd Occurrence / Severe Case: Termination.'}
];
for(const [q,want,page] of [
 ['What is the second occurrence sanction for threats or intimidation?','Suspension',7],
 ['What is the third occurrence sanction for wrong orders due to negligence?','Final written warning',6],
 ['What is the first occurrence sanction for unauthorized discounts/free items?','Written warning',7]
] as const){
 const result=verifiedMatrixSanction(q,evidence);
 check('deterministic sanction: '+q,!!result&&result.text.endsWith('is '+want+'.')&&result.usedEvidence[0].page===page);
}
check('ambiguous sanction question must not guess',verifiedMatrixSanction('What is the second occurrence sanction?',evidence)===null);
console.log(`\n${checks} Nex HR source-contract and sanctions checks passed.`);
