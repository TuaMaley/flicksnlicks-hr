import type { ComponentType } from 'react';
import { Building2, Building, Users, CreditCard, LayoutGrid, ShieldCheck, Clock3, CalendarClock, BadgeCheck, CircleX, ClipboardList, Activity, PackageCheck, AlertTriangle, CalendarDays, Layers, FileText } from 'lucide-react';
import styles from './PlatformKpiCard.module.css';
const iconMap: Record<string, ComponentType<{size?:number;strokeWidth?:number}>> = {
  'Registered companies': Building2, 'Active companies': Building, 'Active subscriptions': CreditCard,
  'Expiring in 30 days': CalendarClock, 'Plan catalog entries': LayoutGrid,
  'Ready for use': ShieldCheck, 'Setup incomplete': AlertTriangle,
  'Total': ClipboardList, 'Active': BadgeCheck, 'Expired': CircleX,
  'Scheduled': CalendarDays, 'Cancelled': CircleX,
};
export function PlatformKpiCard({label,value,tone=0}:{label:string;value:string|number;tone?:number}) {
 const Icon=iconMap[label] || Activity;
 return <div className={`${styles.card} ${styles['tone'+(tone%6)]}`}>
   <div className={styles.top}><span className={styles.label}>{label}</span><span className={styles.icon} aria-hidden="true"><Icon size={19} strokeWidth={2}/></span></div>
   <strong className={styles.value}>{value}</strong>
 </div>;
}
