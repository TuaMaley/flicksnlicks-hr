// Deterministic, conservative matching for labelled disciplinary matrix rows.
// A match must identify the current question's offence and occurrence; never
// infer from conversation history, a category label, or a neighboring row.
export type SanctionEvidence={documentId:string;title:string;version:number;page:number|null;excerpt:string;score:number};
export type VerifiedSanction={text:string;usedEvidence:SanctionEvidence[];mode:'extractive'};
const ignore=new Set('what which when where why who how does do did is are was were can could should would the a an of in on for to with by from at about and or if as it this that their my me please tell explain policy policies company nex hr punishment penalty penalties disciplinary says say have many number count total employee employees according approved first second third occurrence occurrences severe case sanction sanctions matrix page number include specific issue offence offense work working staff time due'.split(' '));
const categoryPrefix=/^(?:(?:attendance\s*&\s*timekeeping|attendance|timekeeping|food\s+safety\s*&|food\s+safety|customer\s+service|work\s+performance|workplace\s+violence|theft\s*&\s*fraud|theft|fraud|insubordination|harassment\s*&\s*discrimination|substance\s+abuse|company\s+property\s*&\s*assets|confidentiality\s*&\s*reputation|health\s*&\s*safety)\s*)+/i;
function words(value:string):string[]{
 const aliases:Record<string,string>={reporting:'report',reported:'report',reports:'report',lateness:'late',tardy:'late',tardiness:'late',punctuality:'late',orders:'order',discounts:'discount',items:'item',threats:'threat',warnings:'warning',intimidating:'intimidation',hygienic:'hygiene',unauthorised:'unauthorized'};
 return [...new Set((value.toLowerCase().match(/[a-z]+/g)||[]).map(t=>aliases[t]||t).filter(t=>t.length>2&&!ignore.has(t)))];
}
function offenceWords(value:string):string[]{
 let cleaned=value.replace(categoryPrefix,'').replace(/\b(timekeeping|attendance)\b/gi,'');
 return words(cleaned);
}
function occurrence(question:string):number|null{
 const found=[/\b(first|1st)\b/i,/\b(second|2nd)\b/i,/\b(third|3rd)\b/i].flatMap((r,i)=>r.test(question)?[i+1]:[]);
 return found.length===1?found[0]:null;
}
export function isOccurrenceSanctionQuestion(question:string):boolean{
 return occurrence(question)!==null&&/\b(sanction|penalt|punish|disciplin|warning|occurrence)\w*\b/i.test(question);
}
function parseRows(evidence:SanctionEvidence[]){
 const result:{offence:string;sanctions:string[];source:SanctionEvidence}[]=[];
 for(const source of evidence)for(const line of source.excerpt.split('\n')){
  if(!line.startsWith('Sanctions matrix row:'))continue;
  const m=line.match(/^Sanctions matrix row:\s*Offence \/ Issue:\s*(.+?);\s*1st Occurrence:\s*([^;]+);\s*2nd Occurrence:\s*([^;]+);\s*3rd Occurrence \/ Severe Case:\s*(.+?)\.?$/i);
  if(m)result.push({offence:m[1].trim(),sanctions:[m[2].trim(),m[3].trim(),m[4].trim().replace(/\.$/,'')],source});
 }
 return result;
}
export function verifiedMatrixSanction(question:string,evidence:SanctionEvidence[]):VerifiedSanction|null{
 const which=occurrence(question);if(which===null)return null;
 const asked=words(question);
 // Need at least two offence-specific terms. Generic requests must not guess.
 const rows=parseRows(evidence).filter(row=>{
  const terms=offenceWords(row.offence);
  return terms.length>=2&&terms.every(t=>asked.includes(t))&&asked.every(t=>terms.includes(t));
 });
 if(!rows.length)return null;
 const keys=new Set(rows.map(r=>offenceWords(r.offence).sort().join('|')));
 if(keys.size!==1)return null;
 const values=new Set(rows.map(r=>r.sanctions[which-1].toLowerCase()));
 if(values.size!==1)return null;
 const selected=rows[0],sanction=selected.sanctions[which-1];
 if(!sanction||/^(not specified|—|-|n\/a)$/i.test(sanction))return null;
 const ordinal=['first','second','third'][which-1];
 return {text:`According to the approved sanctions matrix${selected.source.page?` (page ${selected.source.page})`:''}, the sanction for the ${ordinal} occurrence of ${selected.offence} is ${sanction}.`,usedEvidence:[selected.source],mode:'extractive'};
}
