import {strict as assert} from 'node:assert';
import {detectHrIntent} from '../lib/nexhr-actions-intent';
const personal=[
 'how much am i being paid','what is my pay check','what is my paycheck','what is my salary',
 'show me my payslip','download my pay slip','what is my net pay','how much was I paid',
 'when will I be paid','have I been paid','what are my deductions',
 'show my payment history','what is my gross salary','how much is my bonus',
 'show me everyone’s salaries','show another employee salary',
];
const policy=['what is the minimum wage policy?','what are the payroll rules?',
 'how is statutory pension calculated?','what is the salary policy?',
 'what is the company policy on employee benefits?'];
for(const q of personal){const actual=detectHrIntent(q);assert.equal(actual,'sensitive_payroll',q+' => '+actual);console.log('PASS personal/private: '+q)}
for(const q of policy){const actual=detectHrIntent(q);assert.equal(actual,null,q+' => '+actual);console.log('PASS policy: '+q)}
console.log('PASS: '+(personal.length+policy.length)+' payroll intent checks');
