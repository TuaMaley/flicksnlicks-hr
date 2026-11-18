# Nex HR — Leave and Benefits governance record

Company: Flicks n Licks
Policy: Employee Leave & Benefits Policy, version 1
Document ID: `cmwlk10oi0005o80xkn6atz96`

## Management approval confirmation

Management confirmed in the Nex HR development conversation on 18 November 2026 that the **entire Leave and Benefits Policy is approved**. This is an operational confirmation, **not a signed approval certificate**. Do not invent an effective date or signature. HR should retain the signed/dated policy and replace the older PDF that still says `DRAFT FOR MANAGEMENT REVIEW`, `Effective date [To be approved]` and `Policy status: Proposed internal policy`.

## Rules to preserve in employee answers

- Annual leave: at least 15 working days with full pay per continuous service year, subject to applicable accrual and more favorable contracts.
- Leave workflow: employee requests; supervisor reviews; Branch Manager/Department Head recommends; HR validates; authorized approver confirms. Do not claim HR or the Branch Manager alone always grants final approval.
- Statutory benefits: apply where required by law, regardless of discretionary-benefit budgets.
- Discretionary benefits: even under an approved policy, each provision remains subject to its stated conditions, including eligibility, budget, published rules and management approval where specified.
- Sick leave: draft policy text establishes no fixed paid sick-day cap; law, contract and company arrangements govern.
- Paternity/partner leave: three paid working days is a discretionary policy benefit subject to management approval, **not described as a Ghana statutory entitlement**.
- Employee discount: 15% is the policy's proposed rate, subject to eligibility, eligible purchases, exclusions and management limits. Do not promise automatic eligibility.

## Deployment / validation

1. Extract the patch ZIP at the project root; it adds only a test and this governance record.
2. Set `NEXHR_TEST_COMPANY_ID` to the real database company ID.
3. Run `npx tsx --env-file=.env tests/nexhr-leave-benefits-governance.test.ts`.
4. Review any failures and actual AI answers before changing production behavior.

This patch does **not** modify production logic, database approval status, document bytes or migrations. That avoids overwriting later changes to the running Nex HR code. For stronger production safeguards, update the signed source document and explicitly record approval metadata in the HR governance workflow.
