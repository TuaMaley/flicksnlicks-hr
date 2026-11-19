import {NextRequest} from 'next/server';
import {access} from '../../../../lib/auth';
import {db} from '../../../../lib/db';
import {fail,ok} from '../../../../lib/http';
import {balance,leaveTypes} from '../../../../lib/leave';

export const dynamic='force-dynamic';
// Read-only employee action context. Never accept an employeeId or companyId from the client.
export async function GET(req:NextRequest){
 const a=await access();
 if(!a.user)return fail('Unauthorized',401);
 if(!a.companyId)return fail('Select an authorized company',403);
 const employeeId=a.user.employeeId;
 if(!employeeId)return fail('Your account is not linked to an employee profile',403);
 const employee=await db.employee.findFirst({where:{id:employeeId,companyId:a.companyId},select:{id:true,firstName:true,lastName:true}});
 if(!employee)return fail('Employee profile not available in this company',403);
 const year=new Date().getUTCFullYear();
 const canLeave=a.can('leave.view')||a.can('leave.create');
 const [balances,requests]=canLeave?await Promise.all([
  Promise.all(leaveTypes.map(type=>balance(employeeId,type,year,a.companyId!))),
  db.leaveRequest.findMany({where:{companyId:a.companyId,employeeId},select:{id:true,type:true,startDate:true,endDate:true,status:true,days:true},orderBy:{createdAt:'desc'},take:10})
 ]):[[],[]];
 return ok({employee:{firstName:employee.firstName,lastName:employee.lastName},year,balances,requests,canSubmitLeave:a.can('leave.create'),canViewLeave:canLeave,links:{selfService:'/self-service',leave:'/leave',payroll:'/payroll',performance:'/performance'} });
}
