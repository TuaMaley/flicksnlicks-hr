import {NextRequest} from 'next/server';import {db} from '../../../lib/db';import {access,employeeWhere} from '../../../lib/auth';import {fail,ok} from '../../../lib/http';
export async function GET(req:NextRequest){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.companyId)return fail('Select an authorized company',403);if(!a.can('employees.view'))return fail('Forbidden',403);const q=(req.nextUrl.searchParams.get('q')||'').slice(0,80);const branchId=req.nextUrl.searchParams.get('branchId')||undefined;const where:any={AND:[employeeWhere(a),...(branchId?[{branchId}]:[]),...(q?[{OR:[{firstName:{contains:q,mode:'insensitive'}},{lastName:{contains:q,mode:'insensitive'}},{employeeNo:{contains:q,mode:'insensitive'}}]}]:[])]};const employees=await db.employee.findMany({where,include:{branch:{select:{name:true}}},orderBy:{createdAt:'desc'},take:250});return ok({employees})}
export async function POST(req:NextRequest){const a=await access();if(!a.user)return fail('Unauthorized',401);if(!a.companyId)return fail('Select an authorized company',403);if(!a.can('employees.create'))return fail('Forbidden',403);if(!a.user.roles.some(r=>r.role.active&&(r.role.name==='Administrator'||r.role.name==='HR Manager')))return fail('Only HR or administrators can register employees',403);try{const d=await req.json();for(const f of ['firstName','lastName','email','position','department','branchId'])if(typeof d[f]!=='string'||!d[f].trim())return fail(`${f} is required`);if(!/^\S+@\S+\.\S+$/.test(d.email))return fail('Valid email required');const branch=await db.branch.findUnique({where:{id:d.branchId,companyId:a.companyId}});if(!branch)return fail('Invalid branch');const employee=await db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(78001234)`;const result = await tx.$queryRaw<Array<{ number: bigint }>>`
  SELECT nextval('public.employee_number_seq') AS number
`;

const n = result[0].number;

const employeeNo = `FNL-${n.toString().padStart(5, '0')}`;const created=await tx.employee.create({data:{companyId:a.companyId!,employeeNo,firstName:d.firstName.trim(),lastName:d.lastName.trim(),email:d.email.trim().toLowerCase(),phone:d.phone?.trim()||null,position:d.position.trim(),department:d.department.trim(),branchId:d.branchId,employmentType:d.employmentType||'FULL_TIME',hireDate:d.hireDate?new Date(d.hireDate):new Date(),emergencyContact:d.emergencyContact||null}});await tx.auditLog.create({data:{companyId:a.companyId!,actorId:a.user!.id,action:'EMPLOYEE_CREATED',entity:'Employee',entityId:created.id,detail:{employeeNo:created.employeeNo}}});return created});return ok({employee},201)}catch(e:any){if (e?.code === 'P2002') {
  console.error('Employee registration unique constraint:', e.meta);

  const target = e.meta?.target;
  const fields = Array.isArray(target)
    ? target.join(', ')
    : String(target ?? 'unknown');

  if (fields.includes('email')) {
    return fail('Employee email already exists', 409);
  }

  if (fields.includes('employeeNo')) {
    return fail(
      'Employee number already exists. Please contact the administrator.',
      409
    );
  }

  return fail('Employee registration conflicts with an existing record', 409);
}
return fail('Unable to create employee',500)}}
