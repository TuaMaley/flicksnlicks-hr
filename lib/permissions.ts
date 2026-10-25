export const PERMISSIONS=[
'employees.view','employees.create','employees.edit','employees.deactivate','employees.transfer','employees.salary.view',
'payroll.view','payroll.create','payroll.edit','payroll.approve','payroll.export',
'leave.view','leave.create','leave.edit','leave.approve',
'training.view','training.create','training.edit','training.approve',
'recruitment.view','recruitment.create','recruitment.edit','recruitment.approve',
'appraisals.view','appraisals.analytics.view','appraisals.create','appraisals.edit','appraisals.approve',
'onboarding.view','onboarding.create','onboarding.edit','onboarding.approve',
'disciplinary.view','disciplinary.create','disciplinary.edit','disciplinary.approve',
'rewards.view','rewards.create','rewards.edit','rewards.approve',
'selfservice.view','selfservice.edit',
'access.view','access.roles.manage','access.users.manage','access.audit.view'
] as const;
export type PermissionKey=typeof PERMISSIONS[number];
