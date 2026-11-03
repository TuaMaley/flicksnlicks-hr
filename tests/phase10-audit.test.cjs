'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {analyze}=require('../scripts/phase10-audit.cjs');
test('unprotected sensitive query is flagged',()=>{const r=analyze('export async function GET(){return db.employee.findMany({})}','/employees');assert.ok(r.flags.includes('REVIEW_AUTH_GUARD'));assert.ok(r.flags.includes('REVIEW_TENANT_SCOPE'))});
test('write without permission signal is flagged',()=>{const r=analyze('export async function POST(){const a=await access();return db.employee.create({data:{companyId:a.companyId}})}','/employees');assert.ok(r.flags.includes('REVIEW_WRITE_PERMISSION'))});
test('guarded tenant-scoped example has no heuristic flags',()=>{const r=analyze("export async function GET(){const a=await access();if(!a.can('employees.view'))return;return db.employee.findMany({where:{companyId:a.companyId}})}",'/employees');assert.deepEqual(r.flags,[])});
test('public health endpoint is not treated as a sensitive endpoint',()=>{const r=analyze('export async function GET(){return {ok:true}}','/health');assert.deepEqual(r.flags,[])});
