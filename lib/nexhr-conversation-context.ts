/** Bounded, deterministic context resolution. No external model call and no cross-thread history. */
type Message={role:string;content:string};
const privateTopic=/\b(?:salary|salaries|paycheck|payslip|pay slip|wages|gross pay|net pay|bank|account number|deductions|payroll|ssnit|tax id|password|pin)\b/i;
const followUp=/^(?:and\s+)?(?:what about|how about|and|also|then|so|what if|what happens|what is|what's|can i|could i|does it|is it|the first|the second|the third)\b/i;
const leaveTopic=/\b(?:annual leave|sick leave|maternity leave|paternity leave|leave balance|leave request|vacation)\b/i;
const sanctionsTopic=/\b(?:threats? or intimidation|wrong orders due to negligence|unauthorized discounts?|late reporting to work|poor personal hygiene|disciplinary sanction|sanctions?)\b/i;
export function resolveNexHrFollowUp(question:string,history:Message[]):string{
 const q=question.trim();
 if(!history.length||!followUp.test(q)||q.length>220||privateTopic.test(q))return q;
 // Only user-authored turns in the same authenticated thread, never assistant output.
 const prior=history.filter(m=>m.role==='user').slice(-8).reverse().find(m=>{
  const p=m.content.trim();return p.length>=12&&!privateTopic.test(p)&&!followUp.test(p)&&(leaveTopic.test(p)||sanctionsTopic.test(p));
 });
 if(!prior)return q;
 const p=prior.content;
 const topic=p.match(sanctionsTopic)?.[0]||p.match(leaveTopic)?.[0];
 if(!topic)return q;
 const occurrence=q.match(/\b(first|second|third|1st|2nd|3rd)\s+(?:occurrence|offen[cs]e)\b/i);
 if(occurrence&&sanctionsTopic.test(p))return `What is the ${occurrence[1]} occurrence sanction for ${topic}?`;
 // Only expand narrow follow-ups; do not reinterpret new independent topics.
 if(/\b(?:days|entitlement|balance|remaining|left)\b/i.test(q)&&leaveTopic.test(p))return `${q} (regarding ${topic})`;
 if(/\b(?:approval|approve|request|apply|status)\b/i.test(q)&&leaveTopic.test(p))return `${q} (regarding ${topic})`;
 if(/\b(?:sanction|penalty|punishment|warning)\b/i.test(q)&&sanctionsTopic.test(p))return `What is the sanction for ${topic}?`;
 return q;
}
