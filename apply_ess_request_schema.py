from pathlib import Path
p=Path('prisma/schema.prisma')
if not p.exists(): raise SystemExit('Run from project root: prisma/schema.prisma not found')
s=p.read_text(encoding='utf-8')
if 'model EmployeeHRRequest {' in s:
 print('EmployeeHRRequest already exists: no changes made')
else:
 s+='\n\n'+Path('ESS_REQUEST_MODEL.prisma.txt').read_text(encoding='utf-8')
 p.write_text(s,encoding='utf-8')
 print('Added EmployeeHRRequest model to prisma/schema.prisma')
