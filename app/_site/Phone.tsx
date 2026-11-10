// Illustration of the Nexora Employee mobile app (same dark theme as the real app).
import {CalendarDays,FileText} from 'lucide-react';
export default function Phone({net}:{net:string}){
 return <div className="phone" aria-hidden="true">
  <div className="notch"/>
  <p className="hi">Good morning</p><p className="name">Ama Mensah</p>
  <div className="pcard pred"><small>October payslip · net pay</small><b className="num">GH₵ {net}</b></div>
  <div className="pcard"><small>Annual leave remaining</small><b>9 of 15 days</b><div className="bar"><i/></div></div>
  <div className="prow"><span style={{display:'flex',gap:8,alignItems:'center'}}><CalendarDays size={14}/>Leave · 4–6 Dec</span><em className="wait">Pending</em></div>
  <div className="prow"><span style={{display:'flex',gap:8,alignItems:'center'}}><FileText size={14}/>Employment letter</span><em>Ready</em></div>
  <div className="prow" style={{borderBottom:0}}><span style={{display:'flex',gap:8,alignItems:'center'}}><FileText size={14}/>September payslip</span><em>PDF</em></div>
 </div>;
}
