const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const helper=fs.readFileSync(path.join(root,'app/api/payroll/compensation/helpers.ts'),'utf8');
test('compensationAccess derives tenant permissions from access()',()=>{
 assert.match(helper,/const a=await access\(\)/);
 assert.match(helper,/a\.companyId/);
 assert.match(helper,/a\.can\('employees\.salary\.view'\)/);
});
for(const file of ['route.ts','bulk/route.ts','[id]/route.ts']){
 test(file+' invokes compensationAccess',()=>{
  const src=fs.readFileSync(path.join(root,'app/api/payroll/compensation',file),'utf8');
  assert.match(src,/await compensationAccess\(\)/);
  assert.match(src,/!a\.user/);
  if(file!=='bulk/route.ts')assert.match(src,/!a\.companyId/);
  else {assert.match(helper,/const tenant=Boolean\(a\.user && a\.companyId\)/); assert.match(src,/companyId:a\.companyId!/);}
 });
}
