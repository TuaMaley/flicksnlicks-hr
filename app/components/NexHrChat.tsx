'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import NexHrActions from './NexHrActions';
import '../nex-hr/nexhr.css';
function isPersonalLeaveApplication(question:string){
 const q=question.toLowerCase().replace(/[’]/g,"'");
 if(!/\b(leave|vacation|time off)\b/.test(q))return false;
 if(/\b(policy|entitlement|eligibility|balance|remaining|left|status|pending|approved|rejected|history|last request|recent requests)\b/.test(q))return false;
 return /\b(apply|application|submit|book|request|take)\b/.test(q)&&/\b(i|me|my|please|can i|could i)\b/.test(q);
}
// Only route to known internal HRMS destinations. Never turn AI-generated text into arbitrary links.
function getSafeHrmsDestination(content:string):string|null{
 if(/\/self-service\?tab=payslips\b/i.test(content))return '/self-service?tab=payslips';
 if(/\/self-service\?tab=(?:leave|performance|information|requests|training)\b/i.test(content)){
  const tab=content.match(/\/self-service\?tab=(leave|performance|information|requests|training)\b/i)?.[1].toLowerCase();
  return tab?'/self-service?tab='+tab:null;
 }
 if(/\/self-service\b/i.test(content))return '/self-service';
 if(/\/performance\b/i.test(content))return '/performance';
 if(/\/payroll\b/i.test(content))return '/payroll';
 if(/\/leave\b/i.test(content))return '/leave';
 return null;
}
export default function NexHrChat({compact=false}:{compact?:boolean}){
 const [showHistory,setShowHistory]=useState(false);
 const [leaveOpenRequest,setLeaveOpenRequest]=useState(0);
 const [threads,setThreads]=useState<{id:string;title:string}[]>([]),[threadId,setThreadId]=useState(''),[messages,setMessages]=useState<any[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function refresh(){try{const r=await fetch('/api/nex-hr/chat',{cache:'no-store'});if(r.ok)setThreads((await r.json()).threads||[])}catch{}}
 useEffect(()=>{void refresh()},[]);
 async function open(id:string){setShowHistory(false);setError('');setThreadId(id);if(!id){setMessages([]);return}try{const r=await fetch('/api/nex-hr/chat?threadId='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw Error(d.error);setMessages(d.thread.messages||[])}catch(e:any){setError(e.message)}}
 async function send(e:React.FormEvent){e.preventDefault();if(busy||!question.trim())return;const q=question.trim();
  // Only a local UI signal: no HRMS data is passed to the language model.
  if(isPersonalLeaveApplication(q))setLeaveOpenRequest(v=>v+1);
  setQuestion('');setBusy(true);setError('');setMessages(m=>[...m,{id:'pending-'+Date.now(),role:'user',content:q}]);try{const r=await fetch('/api/nex-hr/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,threadId:threadId||undefined})});const d=await r.json();if(!r.ok)throw Error(d.error||'Chat unavailable');setThreadId(d.threadId);setMessages(m=>[...m,{...d.message,citations:d.citations}]);await refresh()}catch(e:any){setError(e.message);setMessages(m=>m.filter(x=>!String(x.id).startsWith('pending-')));setQuestion(q)}finally{setBusy(false)}}
 async function rate(id:string,rating:string){try{const r=await fetch('/api/nex-hr/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:id,rating})});if(!r.ok)throw Error('Feedback could not be saved');setMessages(ms=>ms.map(m=>m.id===id?{...m,myRating:rating}:m))}catch(e:any){setError(e.message)}}
 async function remove(){if(!threadId||!confirm('Delete this conversation?'))return;const r=await fetch('/api/nex-hr/chat?threadId='+encodeURIComponent(threadId),{method:'DELETE'});if(r.ok){await open('');await refresh()}}
 return <section className={'nexhr-card'+(compact?' nexhr-compact-chat':'')}>
 {compact?<div className="nexhr-compact-toolbar"><button type="button" title="New conversation" aria-label="New conversation" onClick={()=>void open('')}>＋</button><button type="button" title="Conversation history" aria-label="Conversation history" aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}>◷</button><Link href="/self-service" title="Open Employee Self-Service" aria-label="Open full Nex HR in Employee Self-Service">⤢</Link><span className="nexhr-compact-topic" title={threads.find(t=>t.id===threadId)?.title||'New conversation'}>{threads.find(t=>t.id===threadId)?.title||'New conversation'}</span></div>:<><h2>Ask Nex HR</h2><p>Answers use only approved, effective documents you are permitted to read. If no sufficient evidence is found, Nex HR will decline to answer.</p></>}
 <NexHrActions openLeaveRequest={leaveOpenRequest} /><div className="nexhr-chat-layout"><aside className={'nexhr-chat-threads'+(compact&&!showHistory?' nexhr-history-hidden':'')} aria-label="Conversation history"><button type="button" onClick={()=>open('')}>+ New conversation</button>{threads.map(t=><button className={threadId===t.id?'selected':''} key={t.id} onClick={()=>open(t.id)}>{t.title}</button>)}{threadId&&<button type="button" onClick={remove}>Delete conversation</button>}</aside><div className="nexhr-chat-main"><div className="nexhr-chat-messages" aria-live="polite">{!messages.length&&<p>Ask a question about your company's approved policies, SOPs or regulations.</p>}{messages.map(m=><article key={m.id} className={'nexhr-chat-message '+m.role}><strong>{m.role==='assistant'?'Nex HR':'You'}</strong><p style={{whiteSpace:'pre-line'}}>{m.content}</p>{m.role==='assistant'&&getSafeHrmsDestination(String(m.content||''))&&<div><a href={getSafeHrmsDestination(String(m.content||''))!} target="_blank" rel="noopener noreferrer">Open HRMS module ↗</a></div>}{Array.isArray(m.citations)&&m.citations.length>0&&<details><summary>Sources ({m.citations.length})</summary>{m.citations.map((c:any,i:number)=><div key={i}><a href={'/api/nex-hr/documents/'+encodeURIComponent(c.documentId)} target="_blank" rel="noreferrer">{c.title} · v{c.version}{c.page?' · page '+c.page:''}</a><p>{c.excerpt}</p></div>)}</details>}{m.role==='assistant'&&!String(m.id).startsWith('pending-')&&<div className="nexhr-feedback"><button type="button" disabled={!!m.myRating} onClick={()=>rate(m.id,'HELPFUL')}>Helpful</button><button type="button" disabled={!!m.myRating} onClick={()=>rate(m.id,'NOT_HELPFUL')}>Not helpful</button>{m.myRating&&<small>Feedback saved</small>}</div>}</article>)}{busy&&<p>Nex HR is checking the knowledge library…</p>}</div>{error&&<p role="alert" className="nexhr-error">{error}</p>}<form onSubmit={send} className="nexhr-chat-form"><input aria-label="Ask Nex HR" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about an approved company policy…" maxLength={1200} required/><button className="nexhr-primary" disabled={busy||!question.trim()}>Send</button></form></div></div></section>
}

