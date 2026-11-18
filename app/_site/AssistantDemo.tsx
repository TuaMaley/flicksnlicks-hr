// Illustration of Nex HR, the HR assistant: a short conversation plus the knowledge-base boundary beside it.
// Static on purpose — it shows how the assistant behaves, it is not a live chat.
import {Bot,FileCheck2,Lock} from 'lucide-react';

export const KB_APPROVED=['Employee handbook','Leave policy','Code of conduct','Benefits guide'];
export const KB_BLOCKED=['Employee records','Salaries and compensation','Payroll'];

export default function AssistantDemo(){
 return <div className="hra" aria-label="Example conversation with Nex HR, the HR assistant">
  <div className="hra-chat">
   <div className="hra-top"><span className="hra-av"><Bot size={18} aria-hidden="true"/></span><div><b>Nex HR</b><small>Answers from your company’s approved HR documents</small></div></div>
   <div className="hra-msgs">
    <p className="me">How many days of annual leave can I carry over to next year?</p>
    <div className="bot"><p>You can carry over up to 5 unused days. They must be taken by 31 March, or they lapse.</p></div>
    <p className="me">What does my manager earn?</p>
    <div className="bot no"><p>I can’t answer that. I only use the HR documents your company has approved, and I have no access to salaries, payroll or employee records.</p>
     <span className="src"><Lock size={13} aria-hidden="true"/>Outside the knowledge base</span></div>
   </div>
   <div className="hra-input" aria-hidden="true"><span>Ask about a policy…</span><i/></div>
  </div>
  <div className="hra-kb">
   <p className="kb-h">Knowledge base</p>
   <ul>{KB_APPROVED.map(d=><li key={d}><FileCheck2 size={16} aria-hidden="true"/>{d}<em>Approved</em></li>)}</ul>
   <p className="kb-h off">Never connected</p>
   <ul className="off">{KB_BLOCKED.map(d=><li key={d}><Lock size={16} aria-hidden="true"/>{d}</li>)}</ul>
  </div>
 </div>;
}
