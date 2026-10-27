export const statuses=['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'];
const allowedTypes=['MANDATORY','OPTIONAL'];
const methods=['IN_PERSON','VIRTUAL','HYBRID'];
function parseDate(value:unknown){
 if(value===null||value==='')return null;
 if(typeof value!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(value))throw Error('Invalid date');
 const d=new Date(value+'T00:00:00.000Z');
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Invalid date');
 return d;
}
export function trainingData(d:any){
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid request');
 const required=(key:string)=>{if(typeof d[key]!=='string'||!d[key].trim())throw Error(key+' is required');return d[key].trim()};
 const optional=(key:string)=>{if(d[key]===undefined||d[key]===null||d[key]==='')return null;if(typeof d[key]!=='string')throw Error('Invalid '+key);return d[key].trim().slice(0,1000)||null};
 const status=d.status??'PLANNED';if(!statuses.includes(status))throw Error('Invalid status');
 const trainingType=d.trainingType??'OPTIONAL';if(!allowedTypes.includes(trainingType))throw Error('Invalid training type');
 const deliveryMethod=optional('deliveryMethod');if(deliveryMethod&&!methods.includes(deliveryMethod))throw Error('Invalid delivery method');
 const startDate=parseDate(d.startDate),endDate=parseDate(d.endDate);
 if(startDate&&endDate&&endDate<startDate)throw Error('End date must be on or after start date');
 const number=(key:string,min:number,max:number,integer=false)=>{const v=d[key];if(v===undefined||v===null||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error('Invalid '+key);return n};
 const assessmentRequired=d.assessmentRequired===true;
 const passingScore=number('passingScore',0,100);
 if(passingScore!==null&&!assessmentRequired)throw Error('Passing score requires assessment');
 return {title:required('title').slice(0,200),description:optional('description'),status,code:optional('code'),category:optional('category'),trainingType,deliveryMethod,trainer:optional('trainer'),startDate,endDate,durationHours:number('durationHours',0,10000),location:optional('location'),targetAudience:optional('targetAudience'),maxParticipants:number('maxParticipants',1,100000,true),estimatedCost:number('estimatedCost',0,100000000),assessmentRequired,passingScore};
}
