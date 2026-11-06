export function employeeIdentityFields(data:Record<string,unknown>){
 const fields:Record<string,string|null>={};
 for(const key of ['sex','residentialAddress','location','ghanaCardNo']){
  if(data[key]===undefined)continue;
  if(data[key]!==null&&typeof data[key]!=='string')throw new Error('Invalid '+key);
  const value=String(data[key]??'').trim();
  if(value.length>(key==='residentialAddress'?300:120))throw new Error(key+' is too long');
  if(key==='sex'&&value&&!['MALE','FEMALE','OTHER'].includes(value))throw new Error('Invalid sex');
  if(key==='ghanaCardNo'&&value&&!/^GHA-\d{9}-\d$/.test(value.toUpperCase()))throw new Error('Ghana Card must use GHA-123456789-0 format');
  fields[key]=value?(key==='ghanaCardNo'?value.toUpperCase():value):null;
 }
 return fields;
}
