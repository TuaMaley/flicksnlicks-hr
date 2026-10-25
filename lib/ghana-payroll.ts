// Monetary amounts in GHS. Inputs must be approved before payroll finalization.
export type TaxBand={amount:number|null;rate:number};
export const OCT_2026_BANDS:TaxBand[]=[{amount:588,rate:0},{amount:80,rate:.05},{amount:100,rate:.10},{amount:2900,rate:.175},{amount:16000,rate:.25},{amount:30332,rate:.30},{amount:null,rate:.35}];
export const roundMoney=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export function paye(chargeable:number,bands:TaxBand[]){
 if(!Number.isFinite(chargeable)||chargeable<0)throw Error('Invalid chargeable income');
 let left=chargeable,tax=0;
 for(const b of bands){if(!Number.isFinite(b.rate)||b.rate<0||b.rate>1||b.amount!==null&&(!Number.isFinite(b.amount)||b.amount<0))throw Error('Invalid PAYE band');const slice=Math.min(left,b.amount??left);tax+=slice*b.rate;left-=slice;if(left<=0)break}
 if(left>0)throw Error('Incomplete PAYE tax bands');return roundMoney(tax);
}
export type GhanaPayrollInput={basic:number;allowances:number;otherDeductions:number;overtimeDays:number;overtimeRate:number;unpaidDays:number;workDaysPerMonth:number;tier3Employee:number;employeeRate:number;employerRate:number;tier1Rate:number;tier2Rate:number;minimumInsurable:number;maximumInsurable:number;taxBands:TaxBand[]};
export function computeGhanaPayroll(i:GhanaPayrollInput){
 for(const [key,value] of Object.entries(i)){if(typeof value==='number'&&(!Number.isFinite(value)||value<0))throw Error('Invalid payroll input: '+key)}
 if(i.workDaysPerMonth<1||i.unpaidDays>i.workDaysPerMonth||i.maximumInsurable<i.minimumInsurable)throw Error('Invalid payroll workdays or contribution ceiling');
 if(Math.abs(i.tier1Rate+i.tier2Rate-i.employeeRate-i.employerRate)>0.00001)throw Error('Tier 1 + Tier 2 must equal employee + employer contributions');
 const absenceDeduction=roundMoney(i.basic*i.unpaidDays/i.workDaysPerMonth);
 const pensionableBasic=Math.max(0,roundMoney(i.basic-absenceDeduction));
 const insurableBasic=pensionableBasic>0?Math.min(i.maximumInsurable,Math.max(i.minimumInsurable,pensionableBasic)):0;
 const employeeSSNIT=roundMoney(insurableBasic*i.employeeRate);
 const employerPension=roundMoney(insurableBasic*i.employerRate);
 const tier1Total=roundMoney(insurableBasic*i.tier1Rate);
 const tier2Total=roundMoney(insurableBasic*i.tier2Rate);
 const overtimePay=roundMoney(i.overtimeDays*i.overtimeRate);
 const gross=roundMoney(pensionableBasic+i.allowances+overtimePay);
 // Overtime taxation is employment-classification dependent; conservative standard PAYE treatment pending review.
 const taxableIncome=Math.max(0,roundMoney(gross-employeeSSNIT-i.tier3Employee));
 const incomeTax=paye(taxableIncome,i.taxBands);
 const deductions=roundMoney(employeeSSNIT+i.tier3Employee+i.otherDeductions+incomeTax);
 const net=roundMoney(gross-deductions);
 return {basic:roundMoney(i.basic),pensionableBasic,allowances:roundMoney(i.allowances),absenceDeduction,overtimeDays:i.overtimeDays,overtimeRate:i.overtimeRate,overtimePay,gross,employeeSSNIT,employerPension,tier1Total,tier2Total,tier3Employee:roundMoney(i.tier3Employee),otherDeductions:roundMoney(i.otherDeductions),taxableIncome,incomeTax,deductions,net,employerTotalCost:roundMoney(gross+employerPension),insurableBasic};
}
