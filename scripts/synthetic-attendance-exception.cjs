/* Read-only: inspect attendance rows missing expected synthetic markers. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const employees = await prisma.employee.findMany({
    where: { employeeNo: { startsWith: 'FNL-SYN-16-1-' } },
    select: { id: true, employeeNo: true },
  });
  const byId = new Map(employees.map(e => [e.id, e.employeeNo]));
  const rows = await prisma.payrollAttendance.findMany({
    where: {
      employeeId: { in: employees.map(e => e.id) },
      NOT: { AND: [{ status: 'DRAFT' }, { notes: { contains: 'SYNTHETIC' } }] },
    },
    select: { id: true, employeeId: true, workDate: true, status: true, notes: true,
      submittedById: true, reviewedById: true, reviewedAt: true, createdAt: true },
    orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
  });
  console.log(JSON.stringify({ action: 'read-only-attendance-exceptions', syntheticEmployees: employees.length,
    exceptions: rows.map(r => ({ ...r, employeeNo: byId.get(r.employeeId) || null })) }, null, 2));
  console.log('READ-ONLY: No database records changed.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
