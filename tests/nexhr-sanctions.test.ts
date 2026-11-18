import {verifiedMatrixSanction,isOccurrenceSanctionQuestion} from '../lib/nexhr-sanctions';
const base={documentId:'d1',title:'Sanctions Guide',version:1,page:6,score:1};
const lines=[
 ['Attendance & Late reporting to Timekeeping work','Verbal warning','Written warning','Final written warning / Suspension'],
 ['Food Safety & Poor personal Hygiene hygiene','Verbal warning','Written warning','Suspension'],
 ['Customer Service Wrong orders due to negligence','Verbal warning','Written warning','Final written warning'],
 ['Workplace Violence Threats or intimidation','Final written warning','Suspension','Termination'],
 ['Theft & Fraud Unauthorized discounts/free items','Written warning','Final written warning','Termination']
];
const evidence=lines.map(([off,a,b,c],i)=>({...base,documentId:'d'+i,excerpt:`Sanctions matrix row: Offence / Issue: ${off}; 1st Occurrence: ${a}; 2nd Occurrence: ${b}; 3rd Occurrence / Severe Case: ${c}.`}));
const tests:[string,string|null][]=[
 ['What is the sanction for a second occurrence of late reporting to work?','Written warning'],
 ['What is the sanction for a first occurrence of poor personal hygiene?','Verbal warning'],
 ['What is the sanction for a third occurrence of wrong orders due to negligence?','Final written warning'],
 ['What is the sanction for a second occurrence of threats or intimidation?','Suspension'],
 ['What is the sanction for a first occurrence of unauthorized discounts or free items?','Written warning'],
 ['What is the sanction for a third occurrence of poor personal hygiene?','Suspension'],
 ['What is the sanction for a second occurrence? ',null],
 ['What is the sanction for a second occurrence of wrong orders and threats? ',null],
 ['What is the sanction for a second occurrence of repeated lateness and poor personal hygiene? ',null],
];
for(const [q,expected] of tests){const result=verifiedMatrixSanction(q,evidence);if(expected===null){if(result)throw Error('Unexpected match: '+q+' => '+result.text)}else if(!result||!result.text.endsWith('is '+expected+'.'))throw Error('Bad match: '+q+' => '+result?.text);}
const successive=['What is the sanction for a first occurrence of poor personal hygiene?','What is the sanction for a third occurrence of wrong orders due to negligence?','What is the sanction for a second occurrence of threats or intimidation?'];
for(const q of successive){if(!verifiedMatrixSanction(q,evidence))throw Error('Failed successive question '+q)}
console.log('Passed',tests.length,'matrix cases and successive-question regression.');
