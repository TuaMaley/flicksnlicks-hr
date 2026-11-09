import {employeeIdentityFields} from '../../../../lib/employeeIdentityFields';
import { NextRequest } from 'next/server';
import { db } from '../../../../lib/db';
import { access, employeeWhere } from '../../../../lib/auth';
import { fail, ok } from '../../../../lib/http';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const a = await access();
  if (!a.user) return fail('Unauthorized', 401);
  if (!a.companyId) return fail('Select an authorized company', 403);
  if (!a.can('employees.edit')) return fail('Forbidden', 403);
  if (!a.user.roles.some(r =>
    r.role.active && (r.role.name === 'Administrator' || r.role.name === 'HR Manager')
  )) {
    return fail('Only HR or administrators can edit employees', 403);
  }

  const { id } = await params;
  const old = await db.employee.findFirst({
    where: { AND: [{ id }, employeeWhere(a)] },
  });
  if (!old) return fail('Not found', 404);

  try {
    const d = await req.json();
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      return fail('Invalid employee data', 400);
    }

    const allowed = [
      'firstName', 'lastName', 'phone', 'position', 'department',
      'branchId', 'employmentType', 'emergencyContact', 'status',
    ] as const;
    const data: Record<string, unknown> = {};

    for (const k of allowed) {
      if (d[k] !== undefined) {
        if (typeof d[k] !== 'string') return fail(`Invalid ${k}`, 400);
        data[k] = d[k].trim();
      }
    }

    try { Object.assign(data,employeeIdentityFields(d)); } catch(e){ return fail((e as Error).message,400); }
    if (data.status && !['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'EXITED'].includes(data.status as string)) {
      return fail('Invalid status', 400);
    }
    if (data.branchId && data.branchId !== old.branchId && !a.can('employees.transfer')) {
      return fail('Transfer permission required', 403);
    }

    if (data.department && data.department !== old.department) {
      const department=await db.companyDepartment.findFirst({where:{companyId:a.companyId!,name:data.department as string,active:true}});
      if(!department)return fail('Select an active company department',400);
    }
    if (data.position && data.position !== old.position) {
      const position=await db.companyPosition.findFirst({where:{companyId:a.companyId!,name:data.position as string,active:true}});
      if(!position)return fail('Select an active company position',400);
    }
    if (data.branchId) {
      const branch = await db.branch.findFirst({where:{id:data.branchId as string,companyId:a.companyId}});
      if (!branch) return fail('Invalid branch for selected company',400);
    }

    if (d.reportingManagerId !== undefined) {
      if (d.reportingManagerId !== null && typeof d.reportingManagerId !== 'string') return fail('Invalid reporting manager',400);
      const managerId = typeof d.reportingManagerId === 'string' ? d.reportingManagerId.trim() : '';
      if (managerId === id) return fail('Employee cannot report to themselves',400);
      if (managerId) {
        const manager = await db.employee.findFirst({where:{id:managerId,companyId:a.companyId},select:{id:true,reportingManagerId:true}});
        if (!manager) return fail('Reporting manager must belong to the same company',400);
        let ancestor: string | null = manager.reportingManagerId;
        const visited = new Set<string>([managerId]);
        while (ancestor) {
          if (ancestor === id) return fail('Reporting relationship cannot create a cycle',400);
          if (visited.has(ancestor)) return fail('Invalid existing reporting hierarchy',400);
          visited.add(ancestor);
          const parent: {reportingManagerId:string|null}|null = await db.employee.findFirst({where:{id:ancestor,companyId:a.companyId},select:{reportingManagerId:true}});
          ancestor = parent?.reportingManagerId ?? null;
        }
      }
      data.reportingManagerId = managerId || null;
    }

    if (d.hireDate !== undefined) {
      if (typeof d.hireDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.hireDate)) {
        return fail('Hire Date must be in YYYY-MM-DD format', 400);
      }
      const hireDate = new Date(`${d.hireDate}T00:00:00.000Z`);
      if (Number.isNaN(hireDate.getTime()) || hireDate.toISOString().slice(0, 10) !== d.hireDate) {
        return fail('Invalid Hire Date', 400);
      }
      data.hireDate = hireDate;
    }

    const result = await db.$transaction(async tx => {
      const updated = await tx.employee.updateMany({where:{id,companyId:a.companyId!},data});
      if(updated.count!==1)throw new Error('Employee no longer belongs to selected company');
      const employee=await tx.employee.findFirstOrThrow({where:{id,companyId:a.companyId!}});
      await tx.auditLog.create({
        data: {
          companyId:a.companyId!,
          actorId: a.user!.id,
          action: 'EMPLOYEE_UPDATED',
          entity: 'Employee',
          entityId: id,
          detail: { fields: Object.keys(data), previousStatus: old.status },
        },
      });
      return employee;
    });
    return ok({ employee: result });
  } catch (error) {
    console.error('Employee update failed:', error);
    return fail('Unable to update employee', 500);
  }
}
