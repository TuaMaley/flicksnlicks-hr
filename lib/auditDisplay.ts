import {db} from './db';

type AuditRow={entity:string;entityId:string|null;companyId?:string|null;detail:unknown};
type Label={label:string;subtitle?:string};
const unique=(values:(string|null|undefined)[])=>[...new Set(values.filter((v):v is string=>!!v))];
const isIdKey=(key:string)=>/^(?:id|.*Id)$/i.test(key);

/** Display-only enrichment. Never modifies persisted audit evidence. */
export async function auditDisplay(rows:AuditRow[], companyScope?:string){
 const ids=unique(rows.flatMap(r=>[r.entityId,...collectIds(r.detail)]));
 if(!ids.length)return rows.map(r=>({recordLabel:r.entity,detailDisplay:sanitize(r.detail,new Map())}));
 const [users,employees,companies]=await Promise.all([
  db.user.findMany({where:{id:{in:ids},...(companyScope?{companyMemberships:{some:{companyId:companyScope}}}:{})},select:{id:true,name:true,email:true}}),
  db.employee.findMany({where:{id:{in:ids},...(companyScope?{companyId:companyScope}:{})},select:{id:true,firstName:true,lastName:true,employeeNo:true}}),
  db.company.findMany({where:{id:{in:ids},...(companyScope?{id:companyScope}:{})},select:{id:true,name:true,code:true}})
 ]);
 const labels=new Map<string,Label>();
 for(const u of users)labels.set(u.id,{label:u.name||u.email,subtitle:u.email});
 for(const e of employees)labels.set(e.id,{label:`${e.firstName} ${e.lastName}`.trim(),subtitle:e.employeeNo});
 for(const c of companies)labels.set(c.id,{label:c.name,subtitle:c.code});
 return rows.map(r=>{
  const match=r.entityId?labels.get(r.entityId):undefined;
  return {recordLabel:match?.label||friendlyEntity(r.entity),recordSubtitle:match?.subtitle||undefined,detailDisplay:sanitize(r.detail,labels)};
 });
}
function collectIds(value:unknown):string[]{
 if(!value||typeof value!=='object')return [];
 if(Array.isArray(value))return value.flatMap(collectIds);
 return Object.entries(value).flatMap(([k,v])=>isIdKey(k)&&typeof v==='string'?[v]:collectIds(v));
}
function friendlyEntity(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2')||'Record';}
function sanitize(value:unknown,labels:Map<string,Label>,depth=0):unknown{
 if(depth>6)return 'Additional details omitted';
 if(Array.isArray(value))return value.slice(0,100).map(v=>sanitize(v,labels,depth+1));
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|secret|token|hash|logoDataUrl)/i.test(k)).map(([k,v])=>{
  if(isIdKey(k))return [k.replace(/Id$/,'').replace(/([a-z])([A-Z])/g,'$1 $2')||'Record',typeof v==='string'?(labels.get(v)?.label||'Recorded reference'):v==null?'—':'Recorded reference'];
  return [k,sanitize(v,labels,depth+1)];
 }));
}
