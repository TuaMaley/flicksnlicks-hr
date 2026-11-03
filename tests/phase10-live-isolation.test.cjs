const {test}=require('node:test');
const assert=require('node:assert/strict');
const {findList}=require('../scripts/phase10-live-isolation.cjs');
test('extracts named collection',()=>assert.deepEqual(findList({branches:[{id:'a'}]},'branches'),[{id:'a'}]));
test('extracts sole collection',()=>assert.deepEqual(findList({plans:[{id:'p'}]},null),[{id:'p'}]));
test('does not infer ambiguous collections',()=>assert.equal(findList({a:[],b:[]},null),null));
test('ignores module arrays',()=>assert.equal(findList({modules:[]},null),null));
