const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('ESS photo update uses linked employee and tenant',()=>{const s=read('app/api/self-service/profile/photo/route.ts');assert.match(s,/a\.user\.employeeId/);assert.match(s,/companyId:a\.companyId/);assert.match(s,/selfservice\.edit/)});
test('HR photo update requires permission and tenant',()=>{const s=read('app/api/employees/[id]/photo/route.ts');assert.match(s,/employees\.edit/);assert.match(s,/employeeWhere\(a\)/);assert.match(s,/companyId:a\.companyId/)});
test('photo upload checks format, size and file signatures',()=>{const s=read('lib/employeePhoto.ts');assert.match(s,/150\*1024/);assert.match(s,/file\.type/);assert.match(s,/RIFF/);assert.match(s,/PNG|png/)});
