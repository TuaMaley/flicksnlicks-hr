const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('security validation runner is installed',()=>{
 const f=path.join(process.cwd(),'scripts','phase10-security-validation.cjs');
 assert.ok(fs.existsSync(f),'Expected scripts/phase10-security-validation.cjs');
 const s=fs.readFileSync(f,'utf8');
 assert.ok(s.includes('NEXORA_TEST_BASE_URL'));
 assert.ok(!/method:\s*['"](POST|PATCH|PUT|DELETE)/.test(s),'Runner must not issue mutating requests');
});
