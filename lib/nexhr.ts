import { Prisma } from '@prisma/client';
import {access} from './auth';
import {fail} from './http';
import {db} from './db';
export const categories=['HR Policy','SOP','Regulation','Employee Handbook','Safety','Payroll','Leave','Conduct','Training','Other'];
export const visibility=['ALL_EMPLOYEES','HR_ONLY','MANAGEMENT_ONLY'];
export async function gate(permission='nexhr.view'){
 const a=await access();
 if(!a.user)return {a,error:fail('Unauthorized',401)};
 if(!a.companyId)return {a,error:fail('Select a company workspace',403)};
 if(!a.can(permission))return {a,error:fail('Forbidden',403)};
 return {a,error:null};
}
export function allowedToRead(a:Awaited<ReturnType<typeof access>>,d:{visibility:string,status:string}){
 if(a.can('nexhr.manage')||a.can('nexhr.approve'))return true;
 return d.status==='APPROVED' && (d.visibility==='ALL_EMPLOYEES'||
 (d.visibility==='HR_ONLY'&&a.can('employees.salary.view'))||
 (d.visibility==='MANAGEMENT_ONLY'&&a.can('employees.create')));
}
export function summary(d:any){const {fileData,...rest}=d;return rest}
export async function log(companyId:string,documentId:string,actorId:string,action:string,detail?:Record<string,unknown>){
 const jsonDetail = (detail ?? {}) as Prisma.InputJsonValue;
 await db.nexHrAuditEvent.create({data:{companyId,documentId,actorId,action,detail:jsonDetail}});
 await db.auditLog.create({data:{companyId,entity:'NexHrDocument',entityId:documentId,actorId,action:'NEXHR_'+action,detail:jsonDetail}});
}
