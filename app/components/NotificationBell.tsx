'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Bell,CheckCheck,X} from 'lucide-react';
type Notice={id:string;title:string;message:string;href:string;kind:string;readAt:string|null;createdAt:string};
export default function NotificationBell(){
 const [open,setOpen]=useState(false),[items,setItems]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[error,setError]=useState('');
 const root=useRef<HTMLDivElement>(null);const router=useRouter();
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/notifications',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Notifications unavailable');setItems(data.notifications||[]);setUnread(data.unread||0);setError('')}catch(e){setError(e instanceof Error?e.message:'Notifications unavailable')}},[]);
 useEffect(()=>{refresh();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000);return()=>window.clearInterval(timer)},[refresh]);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false)};const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('mousedown',close);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',esc)}},[open]);
 const mark=async(id?:string)=>{const r=await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{id}:{all:true})});if(r.ok)await refresh();else setError('Unable to mark notification as read')};
 return <div ref={root} style={{position:'relative'}}>
 <button type="button" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} aria-expanded={open} title="Notifications" onClick={()=>{setOpen(v=>!v);refresh()}} style={{position:'relative',display:'inline-flex',alignItems:'center',justifyContent:'center',width:42,height:42,border:'1px solid #e2e8f0',borderRadius:12,background:'#f8fafc',cursor:'pointer'}}><Bell size={21}/>{unread>0&&<span style={{position:'absolute',top:-5,right:-6,background:'#cf142b',color:'white',borderRadius:20,fontSize:10,fontWeight:700,minWidth:18,padding:'2px 4px'}}>{unread>99?'99+':unread}</span>}</button>
 {open&&<div role="dialog" aria-label="Notifications" style={{position:'absolute',right:0,top:'calc(100% + 10px)',width:'min(380px, calc(100vw - 24px))',maxHeight:'min(520px, 75vh)',overflowY:'auto',zIndex:1000,background:'white',color:'#142033',border:'1px solid #e2e8f0',borderRadius:14,boxShadow:'0 12px 40px #17233a30'}}>
 <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid #e2e8f0'}}><strong>Notifications {unread>0?`(${unread})`:''}</strong><div style={{display:'flex',gap:10,alignItems:'center'}}>{unread>0&&<button type="button" onClick={()=>mark()} style={{background:'none',border:0,cursor:'pointer',color:'#b91c1c',fontSize:12,display:'flex',gap:4,alignItems:'center'}}><CheckCheck size={14}/> Mark all read</button>}<button type="button" aria-label="Close notifications" onClick={()=>setOpen(false)} style={{background:'none',border:0,cursor:'pointer'}}><X size={17}/></button></div></div>
 {error&&<div role="alert" style={{padding:14,color:'#b91c1c',fontSize:13}}>{error}</div>}
 {!error&&items.length===0&&<p style={{padding:20,textAlign:'center',color:'#64748b',fontSize:13}}>No notifications yet.</p>}
 {items.map(n=><button type="button" key={n.id} onClick={async()=>{if(!n.readAt)await mark(n.id);setOpen(false);if(n.href.startsWith('/')&&!n.href.startsWith('//'))router.push(n.href)}} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 16px',border:0,borderBottom:'1px solid #f1f5f9',background:n.readAt?'white':'#f1f6ff',cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong style={{fontSize:13}}>{n.title}</strong>{!n.readAt&&<span aria-label="Unread" style={{width:7,height:7,flexShrink:0,borderRadius:'50%',background:'#2563eb',marginTop:5}}/>}</div><div style={{fontSize:12,color:'#475569',marginTop:4}}>{n.message}</div><div style={{fontSize:11,color:'#64748b',marginTop:5}}>{new Date(n.createdAt).toLocaleString()}</div></button>)}
 </div>}
 </div>
}
