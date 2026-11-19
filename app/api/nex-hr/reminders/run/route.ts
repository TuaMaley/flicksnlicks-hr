import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Reminder = { companyId: string; userId: string; sourceId: string; kind: string; title: string; message: string; href: string; day: string };
type AssignmentRow = { companyId: string; userId: string; sourceId: string; deadline: Date; status: string };
type TrainingRow = { companyId: string; userId: string; sourceId: string; title: string; startDate: Date };

function validToken(request: NextRequest): boolean {
  const expected = process.env.NEXHR_REMINDER_CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!expected || !provided) return false;
  const a = Buffer.from(expected), b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

function stableId(r: Reminder) {
  return `nexhr-rem-${createHash('sha256').update([r.companyId,r.userId,r.sourceId,r.kind,r.day].join('|')).digest('hex').slice(0, 32)}`;
}

export async function GET(request: NextRequest) {
  if (!validToken(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  try {
    // Only company-scoped records, active employees, active users and active memberships.
    const assignments = await db.$queryRaw<AssignmentRow[]>`
      SELECT a."companyId", u."id" AS "userId", a."id" AS "sourceId",
             c."selfDeadline" AS "deadline", a."status"
      FROM "AppraisalCycleAssignment" a
      JOIN "AppraisalCycle" c ON c."id" = a."cycleId" AND c."companyId" = a."companyId"
      JOIN "Employee" e ON e."id" = a."employeeId" AND e."companyId" = a."companyId"
      JOIN "User" u ON u."employeeId" = e."id" AND u."active" = true
      JOIN "CompanyMembership" m ON m."userId" = u."id" AND m."companyId" = a."companyId" AND m."active" = true
      WHERE a."companyId" IS NOT NULL AND c."status" = 'OPEN'
        AND a."selfCompletedAt" IS NULL AND c."selfDeadline" > ${now}
        AND c."selfDeadline" <= ${inTwoDays} AND e."status" = 'ACTIVE'
    `;
    const training = await db.$queryRaw<TrainingRow[]>`
      SELECT te."companyId", u."id" AS "userId", te."id" AS "sourceId",
             t."title", t."startDate"
      FROM "TrainingEnrollment" te
      JOIN "Training" t ON t."id" = te."trainingId" AND t."companyId" = te."companyId"
      JOIN "Employee" e ON e."id" = te."employeeId" AND e."companyId" = te."companyId"
      JOIN "User" u ON u."employeeId" = e."id" AND u."active" = true
      JOIN "CompanyMembership" m ON m."userId" = u."id" AND m."companyId" = te."companyId" AND m."active" = true
      WHERE te."companyId" IS NOT NULL AND te."status" = 'ENROLLED'
        AND t."startDate" > ${tomorrow} AND t."startDate" <= ${inTwoDays}
        AND e."status" = 'ACTIVE'
    `;
    const reminders: Reminder[] = [
      ...assignments.map(a => ({ companyId:a.companyId,userId:a.userId,sourceId:a.sourceId,
        kind:'APPRAISAL_REMINDER',title:'Appraisal deadline approaching',
        message:'Your self-appraisal is due within 48 hours. Open Performance Appraisal to complete it.',
        href:'/appraisals',day })),
      ...training.map(t => ({ companyId:t.companyId,userId:t.userId,sourceId:t.sourceId,
        kind:'TRAINING_REMINDER',title:'Upcoming training',
        message:`Your training session, ${t.title.slice(0, 100)}, starts within 48 hours. Review your training details.`,
        href:'/self-service?tab=training',day }))
    ];
    let inserted = 0;
    for (const r of reminders) {
      const id = stableId(r);
      const result = await db.$executeRaw`
        INSERT INTO "NexoraNotification" ("id","companyId","userId","kind","title","message","href","createdAt")
        VALUES (${id},${r.companyId},${r.userId},${r.kind},${r.title},${r.message},${r.href},CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO NOTHING
      `;
      inserted += result;
    }
    return NextResponse.json({ ok:true, eligible:reminders.length, created:inserted, date:day });
  } catch (error) {
    console.error('Nex HR scheduled reminders failed', error);
    return NextResponse.json({ error:'Unable to process reminders' }, { status:503 });
  }
}
