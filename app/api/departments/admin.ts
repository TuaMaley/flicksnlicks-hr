import { access } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { fail } from '../../../lib/http';

export async function requireCompanyAdministrator() {
  const a = await access();
  if (!a.user) return { error: fail('Unauthorized', 401) };
  if (!a.companyId) return { error: fail('Select a company', 403) };

  const membership = await db.companyMembership.findFirst({
    where: { userId: a.user.id, companyId: a.companyId, active: true },
    include: { roles: { include: { role: true } } },
  });
  const allowed = a.can('employees.create') || a.can('employees.edit') || membership?.roles.some(
    (x) => x.role.active && x.role.companyId === a.companyId &&
      (x.role.name === 'Administrator' || x.role.name.startsWith('Administrator ['))
  );
  if (!allowed) return { error: fail('HR or company administrator access required', 403) };
  return { a };
}
