export type Criterion={name:string;weight:number};
const criteria=(items:string[]):Criterion[]=>items.map((name,i)=>({name,weight:i===0?30:i===1?25:i===2?20:i===3?15:10}));
export const DEFAULT_APPRAISAL_TEMPLATES=[
 ['Cashier','Frontline','Entry','Transaction accuracy','Customer service','Cash reconciliation','Attendance','Teamwork'],
 ['Kitchen Assistant','Kitchen','Entry','Food preparation','Hygiene','Speed','Attendance','Teamwork'],
 ['Chef / Cook','Kitchen','Skilled','Food quality','Food safety','Speed','Inventory control','Teamwork'],
 ['Shawarma Station','Kitchen','Skilled','Product consistency','Hygiene','Order accuracy','Speed','Teamwork'],
 ['Customer Service Agent','Customer Service','Entry','Customer satisfaction','Resolution rate','Communication','Response time','Teamwork'],
 ['Call Center Supervisor','Customer Service','Supervisor','Service quality','Coaching','Escalations','Reporting','Teamwork'],
 ['Delivery Rider','Delivery','Entry','On-time delivery','Safety','Order accuracy','Customer care','Attendance'],
 ['Delivery Coordinator','Delivery','Supervisor','Dispatch efficiency','Delivery accuracy','Issue resolution','Reporting','Teamwork'],
 ['Storekeeper','Inventory','Skilled','Stock accuracy','Loss prevention','Recordkeeping','Timely replenishment','Teamwork'],
 ['Procurement Officer','Procurement','Skilled','Cost management','Supplier reliability','Compliance','Timeliness','Teamwork'],
 ['Security Officer','Security','Entry','Incident prevention','Access control','Reporting','Vigilance','Attendance'],
 ['Marketing Officer','Marketing','Skilled','Campaign results','Brand quality','Execution','Analytics','Collaboration'],
 ['Accountant','Finance','Skilled','Financial accuracy','Timely reporting','Controls','Compliance','Collaboration'],
 ['Branch Manager','Operations','Manager','Sales performance','Cost control','People leadership','Customer experience','Compliance'],
 ['Department Head','Leadership','Senior','Department KPIs','Strategy delivery','People development','Risk management','Cross-team collaboration']
].map(([name,category,level,...items])=>({name,category,level,description:`${name} performance scorecard`,criteria:criteria(items)}));
export function weightedScore(criteria:Criterion[],scores:Record<string,number>){if(!criteria.length)return null;let total=0,weight=0;for(const c of criteria){const v=scores[c.name];if(!Number.isFinite(v)||v<1||v>5)return null;total+=v*c.weight;weight+=c.weight}return weight?Math.round(total/weight*100)/100:null}
