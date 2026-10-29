// Transcribed from Flicks n Licks & Love Matcha Discipline & Conduct Policy V1, Appendix A.
// Null means the policy has a dash, NOT permission to bypass a hearing.
export const POLICY_VERSION = 'V1';
export const POLICY_EFFECTIVE_DATE: string | null = null; // Source says TBD
export const SANCTIONS_MATRIX = [
  {
    "code": "FNL-001",
    "category": "Attendance & Timekeeping",
    "offence": "Late reporting to work",
    "first": "Verbal warning",
    "second": "Written warning",
    "thirdOrSevere": "Final written warning / Suspension"
  },
  {
    "code": "FNL-002",
    "category": "Attendance & Timekeeping",
    "offence": "Absence without permission",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-003",
    "category": "Attendance & Timekeeping",
    "offence": "Abandonment of duty",
    "first": "Final written warning",
    "second": "Suspension",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-004",
    "category": "Work Performance",
    "offence": "Poor job performance after training",
    "first": "Coaching & verbal warning",
    "second": "Written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-005",
    "category": "Work Performance",
    "offence": "Sleeping while on duty",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-006",
    "category": "Insubordination",
    "offence": "Refusal to follow lawful instruction",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-007",
    "category": "Insubordination",
    "offence": "Use of abusive language to supervisor",
    "first": "Final written warning",
    "second": "Suspension",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-008",
    "category": "Customer Service",
    "offence": "Rude behavior to customers",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-009",
    "category": "Customer Service",
    "offence": "Wrong orders due to negligence",
    "first": "Verbal warning",
    "second": "Written warning",
    "thirdOrSevere": "Final written warning"
  },
  {
    "code": "FNL-010",
    "category": "Food Safety & Hygiene",
    "offence": "Poor personal hygiene",
    "first": "Verbal warning",
    "second": "Written warning",
    "thirdOrSevere": "Suspension"
  },
  {
    "code": "FNL-011",
    "category": "Food Safety & Hygiene",
    "offence": "Unsafe food handling practices",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-012",
    "category": "Food Safety & Hygiene",
    "offence": "Serving expired/spoiled food",
    "first": "Suspension",
    "second": null,
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-013",
    "category": "Theft & Fraud",
    "offence": "Theft of food, cash, or property",
    "first": null,
    "second": null,
    "thirdOrSevere": "Immediate termination"
  },
  {
    "code": "FNL-014",
    "category": "Theft & Fraud",
    "offence": "POS or Mobile Money manipulation",
    "first": null,
    "second": null,
    "thirdOrSevere": "Immediate termination + possible legal action"
  },
  {
    "code": "FNL-015",
    "category": "Theft & Fraud",
    "offence": "Unauthorized discounts/free items",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-016",
    "category": "Harassment & Discrimination",
    "offence": "Verbal harassment or bullying",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-017",
    "category": "Harassment & Discrimination",
    "offence": "Sexual harassment",
    "first": null,
    "second": null,
    "thirdOrSevere": "Immediate termination"
  },
  {
    "code": "FNL-018",
    "category": "Workplace Violence",
    "offence": "Fighting or physical assault",
    "first": null,
    "second": null,
    "thirdOrSevere": "Immediate termination"
  },
  {
    "code": "FNL-019",
    "category": "Workplace Violence",
    "offence": "Threats or intimidation",
    "first": "Final written warning",
    "second": "Suspension",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-020",
    "category": "Substance Abuse",
    "offence": "Reporting to work intoxicated",
    "first": "Suspension",
    "second": null,
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-021",
    "category": "Substance Abuse",
    "offence": "Alcohol or drugs on premises",
    "first": null,
    "second": null,
    "thirdOrSevere": "Immediate termination"
  },
  {
    "code": "FNL-022",
    "category": "Company Property & Assets",
    "offence": "Damage due to negligence",
    "first": "Written warning + cost recovery",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-023",
    "category": "Company Property & Assets",
    "offence": "Willful destruction of property",
    "first": null,
    "second": null,
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-024",
    "category": "Confidentiality & Reputation",
    "offence": "Sharing confidential info",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-025",
    "category": "Confidentiality & Reputation",
    "offence": "Damaging brand reputation online",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Termination"
  },
  {
    "code": "FNL-026",
    "category": "Health & Safety",
    "offence": "Ignoring safety instructions",
    "first": "Written warning",
    "second": "Final written warning",
    "thirdOrSevere": "Suspension / Termination"
  },
  {
    "code": "FNL-027",
    "category": "Health & Safety",
    "offence": "Endangering customers or staff",
    "first": "Suspension",
    "second": null,
    "thirdOrSevere": "Termination"
  }
] as const;
