import { Prisma } from '@prisma/client';
import { db } from './db';

/** Call inside a transaction after acquiring the employee-number advisory lock. */
export async function nextCompanyEmployeeNo(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const company = await tx.company.findUnique({ where: { id: companyId }, select: { code: true } });
  if (!company) throw new Error('Selected company does not exist');
  // Explicit business-specific prefix; other companies use their configured company code.
  const prefix = company.code === 'EP001' ? 'EPL' : company.code === 'FNL001' ? 'FNL' : company.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!prefix || prefix.length > 16) throw new Error('Invalid company employee-number prefix');
  const employees = await tx.employee.findMany({ where: { companyId }, select: { employeeNo: true } });
  let maximum = 0;
  for (const employee of employees) {
    const match = employee.employeeNo.match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (match) maximum = Math.max(maximum, Number(match[1]));
  }
  // Existing employeeNo is globally unique; a serialized transaction prevents duplicates.
  return `${prefix}-${String(maximum + 1).padStart(5, '0')}`;
}
