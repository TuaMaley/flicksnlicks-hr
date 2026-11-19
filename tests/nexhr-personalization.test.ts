import {strict as assert} from 'node:assert';
import {detectPersonalProfileIntent as detect} from '../lib/nexhr-personalization';
const cases:[string,ReturnType<typeof detect>][]=[
 ['What is my department?','department'],['Which branch am I assigned to?','branch'],
 ['What is my job title?','position'],['Who is my reporting manager?','manager'],
 ['What is my employment type?','employment_type'],['Show my work profile','profile'],
 ['How much is my salary?',null],['Show my payslip',null],
 ['What is the annual leave entitlement?',null],['What department is the CEO in?',null],
 ['Show another employee profile',null],['What is my bank account?',null]
];
for(const [question,expected] of cases){assert.equal(detect(question),expected,question);console.log('PASS',question)}
console.log(`PASS ${cases.length} intent-routing checks`);
