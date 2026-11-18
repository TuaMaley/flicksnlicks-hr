/**
 * Nex HR regression suite. Run: npx --yes tsx tests/nexhr-reliability.test.ts
 * Uses synthetic approved-policy excerpts only; no database, API key or network.
 * This validates deterministic sanction matching, not end-to-end PDF extraction.
 */
import assert from 'node:assert/strict';
import {verifiedMatrixSanction,isOccurrenceSanctionQuestion} from '../lib/nexhr-sanctions';

type Evidence={documentId:string;title:string;version:number;page:number|null;score:number;excerpt:string};
const rows:Evidence[]=[
 ['Attendance & Late reporting to Timekeeping work','Verbal warning','Written warning','Final written warning / Suspension',6],
 ['Food Safety & Poor personal Hygiene hygiene','Verbal warning','Written warning','Suspension',6],
 ['Customer Service Wrong orders due to negligence','Verbal warning','Written warning','Final written warning',6],
 ['Workplace Violence Threats or intimidation','Final written warning','Suspension','Termination',7],
 ['Theft & Fraud Unauthorized discounts/free items','Written warning','Final written warning','Termination',7]
].map(([off,first,second,third,page],i)=>({
 documentId:'test-'+i,title:'Sanctions Guide',version:1,page:Number(page),score:1,
 excerpt:`Sanctions matrix row: Offence / Issue: ${off}; 1st Occurrence: ${first}; 2nd Occurrence: ${second}; 3rd Occurrence / Severe Case: ${third}.`
}));

const cases:[string,string,number][]=[
 ['What is the second-occurrence sanction for threats or intimidation?','Suspension',7],
 ['Third occurrence of wrong orders due to negligence','Final written warning',6],
 ['First occurrence of unauthorized discounts/free items','Written warning',7],
 ['Second occurrence of late reporting to work','Written warning',6],
 ['First occurrence of poor personal hygiene','Verbal warning',6],
 ['Third occurrence of poor personal hygiene','Suspension',6]
];
let count=0;
for(const [question,want,page] of cases){
 for(let attempt=0;attempt<5;attempt++){
  // Reordering unrelated evidence must not change the result.
  const evidence=attempt%2?[...rows].reverse():rows;
  const got=verifiedMatrixSanction(question,evidence);
  assert.ok(got,`Missing verified answer: ${question} (attempt ${attempt+1})`);
  assert.ok(got.text.endsWith('is '+want+'.'),`Wrong sanction: ${question} => ${got.text}`);
  assert.equal(got.usedEvidence.length,1,`Ambiguous citation: ${question}`);
  assert.equal(got.usedEvidence[0].page,page,`Wrong source page: ${question}`);
  count++;
 }
}
for(const question of [
 'What is the second-occurrence sanction?',
 'What is the second-occurrence sanction for threats and wrong orders?',
 'What is the second-occurrence sanction for threats or intimidation and poor hygiene?'
]){
 assert.equal(verifiedMatrixSanction(question,rows),null,`Unsafe answer to ambiguous question: ${question}`);
 count++;
}
assert.ok(isOccurrenceSanctionQuestion('What is the second-occurrence sanction for threats or intimidation?'));
count++;
console.log(`PASS: ${count} deterministic sanction checks, including repeated questions, citation pages and ambiguous-question refusals.`);
