// Professional prompt-template defaults seeded for every advocate's office on
// first access to the AI Assistant. After seeding, each partner OWNS its
// copies and can edit, delete, or add new templates freely.

export type PromptDefault = {
  title: string;
  category: string;
  body: string;
};

export const PROMPT_DEFAULTS: PromptDefault[] = [
  {
    title: "Draft a plaint for recovery of money under Order VII Rule 1 CPC",
    category: "Pleadings",
    body: `Draft a plaint to be filed before the Hon'ble [Court Name], [Place], in the matter of recovery of money, in conformity with Order VII Rule 1 of the Code of Civil Procedure, 1908.

Details to incorporate:
• Plaintiff: [Plaintiff's Full Name, Address, S/o or D/o, Age, Occupation]
• Defendant: [Defendant's Full Name, Address, S/o or D/o]
• Cause of action: [Date(s) and brief facts of the loan / advance / unpaid invoice]
• Amount claimed: ₹[Principal Amount] together with simple interest @ [Rate]% per annum from [Date] till realisation
• Documents in support: [List documents — promissory note, ledger statement, invoices, demand notice, reply if any]
• Jurisdiction: pecuniary and territorial — explain why this court has jurisdiction (Section 15–20 CPC)
• Cause of action paragraph: when and where the cause of action arose
• Limitation: confirm the suit is within limitation under Article 19/22/55 of the Limitation Act, 1963
• Court fee: as per the Court Fees Act / [State] Court Fees Act
• Verification: in compliance with Order VI Rule 15 CPC

Structure required:
1. Cause-title and parties array
2. Facts in numbered paragraphs (concise, chronological)
3. Cause of action with date and place
4. Jurisdiction
5. Limitation
6. Court fee
7. Prayer (decree for ₹[amount] with interest, costs, and any further relief)
8. Verification by the plaintiff

Tone: formal, third-person, in standard pleading style. Avoid argumentative language; state facts.`,
  },
  {
    title:
      "Prepare a written statement responding to the following allegations",
    category: "Pleadings",
    body: `Draft a written statement on behalf of the defendant in compliance with Order VIII Rules 1 to 10 of the Code of Civil Procedure, 1908, in response to the plaint filed by [Plaintiff's Name] before the Hon'ble [Court Name].

Inputs to be used:
• Defendant: [Defendant's Full Name and Address]
• Plaint paragraphs to address: [Paste relevant paragraphs of the plaint]
• Defendant's version of facts: [Brief account]
• Documents relied upon: [List]

Required structure:
1. Preliminary objections (maintainability, jurisdiction, limitation, mis-joinder / non-joinder of parties, suit barred under any provision of law).
2. Para-wise reply to the plaint — every averment must be specifically admitted, denied, or denied for want of knowledge as required by Order VIII Rule 5 CPC. Avoid evasive denials.
3. Additional pleas (set-off / counter-claim under Order VIII Rules 6–6A if applicable).
4. Statement of defendant's positive case — with dates, amounts, and supporting documents.
5. Prayer — for dismissal of the suit with costs.
6. Verification under Order VI Rule 15 CPC.

Drafting notes:
• Keep para numbering aligned with the plaint where practicable.
• Cite documents by date and exhibit reference.
• Reserve liberty to file further written statement / additional documents.
• Do not introduce evidence in the pleading; only material facts.`,
  },
  {
    title: "Draft an affidavit in support of an application under [provision]",
    category: "Affidavits",
    body: `Draft an affidavit in support of [Application Name — e.g., Application under Section 5 of the Limitation Act, 1963 / Application under Order XXXIX Rules 1 & 2 CPC] before the Hon'ble [Court Name].

Particulars:
• Deponent: [Full Name, S/o or D/o, Age, Occupation, Address]
• Capacity: [Plaintiff / Defendant / Authorised Representative — annex authorisation if applicable]
• Facts to be deposed: [List facts the deponent must depose to, with dates]
• Documents annexed: [List with annexure markings — Annexure A-1, A-2, etc.]

Required structure:
1. Title — "BEFORE THE HON'BLE [COURT NAME]" with case number and parties array.
2. Affidavit heading — "AFFIDAVIT OF [Name], [Age], [Occupation], R/o [Address]"
3. Numbered paragraphs deposing to facts within personal knowledge, distinguishing between matters within personal knowledge and those derived from records (with source).
4. Verification clause: "I, the deponent above named, do hereby verify that the contents of paragraphs ___ to ___ of the above affidavit are true to my personal knowledge and the contents of paragraphs ___ to ___ are based on records / information believed by me to be true. Nothing material has been concealed therefrom."
5. Place, date, signature of deponent.
6. Notarial / oath commissioner attestation block.

Drafting notes:
• Use first person ("I, [Name], do hereby state on oath…").
• Each averment must be in a separate paragraph.
• Avoid arguments and conclusions of law — depose only to facts.`,
  },
  {
    title:
      "Generate a petition under Section 482 Cr.P.C. for quashing of FIR / proceedings",
    category: "Criminal",
    body: `Draft a criminal miscellaneous petition under Section 482 of the Code of Criminal Procedure, 1973, to be filed before the Hon'ble High Court of [State], for quashing of FIR No. [FIR Number] dated [Date] registered at [Police Station] under Sections [IPC / BNS sections] / proceedings in C.C. No. [Number] before the Hon'ble [Magistrate Court].

Inputs:
• Petitioner: [Name, Age, Occupation, Address]
• Respondents: (1) State of [State] through Public Prosecutor; (2) De-facto complainant — [Name, Address]
• Brief facts of the FIR / complaint: [Insert]
• Grounds for quashing: [Settlement / lack of prima facie offence / abuse of process / civil dispute given criminal colour / parallel proceedings / etc.]

Required structure:
1. Cause-title and parties.
2. Brief synopsis (one page) and list of dates and events.
3. Statement of facts.
4. Grounds — relying upon authoritative pronouncements such as State of Haryana v. Bhajan Lal (1992) Supp (1) SCC 335 (the seven categories), Gian Singh v. State of Punjab (2012) 10 SCC 303, Narinder Singh v. State of Punjab (2014) 6 SCC 466, where relevant.
5. Inherent jurisdiction of the High Court under Section 482 Cr.P.C.
6. Prayer — for quashing of the FIR / charge-sheet / proceedings, and any consequential reliefs (stay during pendency).
7. Verification and supporting affidavit.

Drafting notes:
• Annex the FIR, charge-sheet, settlement deed (if any), and any relevant documents.
• Cite case law sparingly and accurately, with full citation.
• Maintain a respectful tone toward the trial court and the State.`,
  },
  {
    title: "Issue a legal notice for breach of contract demanding [relief]",
    category: "Notices",
    body: `Draft a legal notice on behalf of [Client Name] addressed to [Noticee's Name and Address] in respect of breach of [identify contract — e.g., Agreement dated DD/MM/YYYY for supply of goods / sale deed dated DD/MM/YYYY / lease agreement / employment contract].

Inputs:
• Client (sender): [Full Name, Address]
• Noticee (recipient): [Full Name, Address]
• Date of contract: [Date]
• Material terms breached: [Identify clauses with reference]
• Consequence / loss suffered: [Quantify, with dates]
• Relief demanded: [Specific performance / payment of ₹[amount] with interest @ [rate]% / restoration of possession / etc.]
• Statutory period: 15 / 30 / 60 days as per the underlying contract or applicable statute (e.g., Section 80 CPC for State, Section 138 NI Act for cheque dishonour — 30 days)

Required structure:
1. Advocate's letter-head block (name, enrolment, address, contact).
2. Reference number, date, mode of dispatch (Speed Post AD / Registered AD / e-mail).
3. "Without prejudice" if applicable; otherwise "Under instructions from my client".
4. Body — narrate the contractual relationship, the breach, the demand previously made (if any), and the loss suffered, in numbered paragraphs.
5. Demand paragraph — set out exactly what the noticee must do and within what time-frame.
6. Consequence paragraph — civil and / or criminal proceedings that will be initiated at the cost and risk of the noticee, including reliefs that will be sought.
7. Reservation of rights.
8. Closing salutation, advocate's signature.

Drafting notes:
• Be specific and unambiguous in the demand and the time-frame.
• Avoid threatening language; state legal consequences instead.
• Keep one copy with file; dispatch by Speed Post AD; preserve postal receipts.`,
  },
  {
    title:
      "Summarise the following judgment in 5 bullet points highlighting ratio",
    category: "Research",
    body: `Summarise the following judgment for office briefing in a clear, concise manner suitable for an Indian legal practitioner. Paste the judgment text below this prompt before sending.

Output format required:
1. **Citation** — full neutral citation (Court, Bench composition, date of judgment).
2. **Parties** — appellant / petitioner v. respondent.
3. **Issues framed** — bullet list of the precise questions before the court.
4. **Holdings** — bullet-point ratio decidendi (3–5 points). Distinguish ratio from obiter clearly.
5. **Reasoning** — 4–6 sentences explaining the court's path to the holding, including statutory provisions / earlier precedents relied upon.
6. **Disposition** — the operative order (allowed / dismissed / remanded / set aside, with terms).
7. **Practitioner takeaway** — one short paragraph on how to use this authority in pleadings.

Style:
• Use active voice and Indian English.
• Keep each bullet under two lines.
• Italicise case names and bold the operative phrases.
• Do not paraphrase the operative paragraph — quote it verbatim with paragraph reference.
• Flag any concurring / dissenting opinions and their substance.

Paste the judgment below:`,
  },
  {
    title:
      "Draft a regular bail application under Section 437 / 439 Cr.P.C.",
    category: "Criminal",
    body: `Draft an application for regular bail under Section 437 / Section 439 of the Code of Criminal Procedure, 1973 (or Section 480 / 483 of the BNSS, 2023, as applicable) on behalf of the accused, before the Hon'ble [Sessions Court / High Court of [State]].

Inputs:
• Applicant / Accused: [Name, Age, S/o, Occupation, Address]
• FIR / Crime No.: [Number] dated [Date], P.S. [Name], District [Name]
• Sections invoked: [List sections — IPC / BNS / Special Acts]
• Date of arrest: [Date]; period of custody so far: [Duration]
• Co-accused, if any, and their bail status: [Insert]
• Brief facts of the prosecution case: [Summarise from FIR]

Required structure:
1. Cause-title and parties — State of [State] through P.P. as opposite party.
2. Brief facts of the prosecution case.
3. Grounds for bail — adopt as appropriate:
   • Accused has clean antecedents.
   • Investigation is complete / charge-sheet filed; further custody not needed.
   • Accused is willing to abide by terms imposed under Section 437(3) / 439(2) Cr.P.C.
   • No likelihood of tampering with evidence or influencing witnesses.
   • Triple test: flight risk, tampering with evidence, influencing witnesses (rebut).
   • Parity with co-accused already enlarged on bail (cite order).
   • Period already undergone; trial likely to take time.
4. Reliance on authorities: Sanjay Chandra v. CBI (2012) 1 SCC 40, Arnesh Kumar v. State of Bihar (2014) 8 SCC 273, Satender Kumar Antil v. CBI (2022) 10 SCC 51 — cite only what applies.
5. Prayer — enlarge the applicant on bail on such terms as the court may deem fit.
6. Verification and supporting affidavit.

Drafting notes:
• Annex the FIR, charge-sheet (if available), antecedents NIL certificate.
• Mention readiness to furnish surety / personal bond / cash security as the court may direct.
• Maintain restrained tone; do not pre-judge merits at bail stage.`,
  },
  {
    title:
      "Draft an anticipatory bail petition under Section 438 Cr.P.C. (Section 482 BNSS)",
    category: "Criminal",
    body: `Draft a petition under Section 438 of the Code of Criminal Procedure, 1973 (or the corresponding Section 482 of the BNSS, 2023) seeking anticipatory bail in apprehension of arrest in connection with FIR / Crime No. [Number] dated [Date], P.S. [Name].

Inputs:
• Petitioner: [Name, Age, Occupation, Address]
• Sections in FIR: [List]
• Apprehension of arrest: [How, when, by whom — specific incidents]
• Antecedents: [Clean / explain]
• Cooperation with investigation: undertaking to join investigation as and when required

Required structure:
1. Cause-title and parties.
2. Brief facts giving rise to apprehension of arrest.
3. Petitioner's version distinguishing role from co-accused.
4. Grounds:
   • Allegations are vague / ulteriorly motivated / civil dispute with criminal cloak.
   • Petitioner has roots in society — family, employment, no risk of absconding.
   • Petitioner undertakes to cooperate with the investigation.
   • Reliance on Gurbaksh Singh Sibbia v. State of Punjab (1980) 2 SCC 565 and Sushila Aggarwal v. State (NCT of Delhi) (2020) 5 SCC 1.
5. Conditions petitioner is willing to abide by under Section 438(2) Cr.P.C.
6. Prayer — for pre-arrest bail in the event of arrest, with such terms as the court deems fit.
7. Verification and supporting affidavit.

Drafting notes:
• File under correct territorial jurisdiction (Court of Sessions or High Court).
• Annex the FIR; if FIR not registered, annex the legal notice / complaint received.
• Provide full and frank disclosure of antecedents, if any.`,
  },
  {
    title: "Prepare a Vakalatnama for representation in [Court Name]",
    category: "Procedural",
    body: `Prepare a Vakalatnama (memorandum of appearance) authorising [Advocate's Name, Enrolment No. [State Bar] / [Year]] to appear, plead and act on behalf of [Client Name] before the Hon'ble [Court Name] in [Case Title and Number, if assigned].

Required content:
1. Name of the court and case (or "to be filed" if not yet numbered).
2. Names of the parties.
3. Authority clauses — to file pleadings, applications, written statements, take steps, withdraw / compromise (with express authority for compromise if intended), receive payments, file appeals / revisions, engage other counsel as instructed.
4. Acceptance clause by the advocate.
5. Identification clause: "Identified by me, [Identifier's Name and capacity]".
6. Signature of client (with photograph affixed if required by local rules).
7. Date and place.
8. Bar Council stamp / fee as per State rules.

Drafting notes:
• Use the standard Vakalatnama format prescribed by the High Court of the relevant State.
• If client is a company, attach board resolution.
• If guardian is signing for minor / person of unsound mind, indicate capacity clearly.
• Counsel's enrolment number must appear below the signature block.`,
  },
  {
    title:
      "Draft an application for adjournment citing [reason]",
    category: "Procedural",
    body: `Draft a short application seeking adjournment of the hearing fixed on [Date] in [Case Title and Number] before the Hon'ble [Court Name].

Inputs:
• Reason for adjournment: [e.g., counsel pre-occupied in High Court matter / serious illness with medical certificate annexed / bereavement in family / awaiting documents under RTI / etc.]
• Stage of the case: [e.g., evidence in chief, cross-examination, arguments]
• Whether earlier adjournments were sought and on whose part: [Disclosure]
• Cost willing to bear: [If court is likely to impose costs under Order XVII CPC / Section 309 Cr.P.C.]

Required structure:
1. Cause-title and parties.
2. Brief facts — present stage of the case and the date fixed.
3. Reason for the adjournment, with supporting documents annexed (medical certificate, conflicting cause-list, etc.).
4. Statement of bona fides — that the adjournment is not sought to delay the matter.
5. Willingness to bear reasonable costs.
6. Prayer — adjourn the hearing to a convenient date and pass such other orders as the court deems fit.
7. Verification and supporting affidavit.

Drafting notes:
• Keep the application brief — one to two pages.
• Adjournments under Order XVII CPC / Section 309 Cr.P.C. are sparingly granted; full and frank disclosure is essential.
• Send a copy to opposing counsel in advance.`,
  },
  {
    title:
      "Generate a cross-examination plan from the following witness statement",
    category: "Trial Strategy",
    body: `Prepare a structured cross-examination plan for [Witness Name], examined-in-chief in [Case Title], based on the deposition pasted below. Output is for office use only and must not contain any privileged information that should not be revealed in court.

Inputs:
• Witness role: [PW / DW number, eye-witness / panch / investigating officer / expert]
• Theory of the case: [Insert defence theory in 2 lines]
• Facts to establish through this witness: [List]
• Facts to neutralise: [List]

Output format required:
1. **Witness profile** — interest, motive, prior statements (Section 161 / 164 Cr.P.C. or earlier civil affidavits) and contradictions to be put under Section 145 of the Indian Evidence Act, 1872 (or Section 148 of the BSA, 2023).
2. **Topics** — group questions by topic; one topic per block.
3. **Sequence** — order from neutral / non-controversial to contested. End with strongest contradiction.
4. **Question style** — closed-ended, leading, one fact per question. Avoid open invitations to explain.
5. **Documents to confront** — list with exhibit number and the paragraph / line of the statement to confront.
6. **Anticipated answers and follow-ups** — three branches each.
7. **Record contradictions** — phrasing for the contradiction memo to be filed under Section 145 of the Evidence Act.

Cautions:
• Do not put leading questions on points where the witness will deny — confront with documents instead.
• Avoid arguing with the witness; hostility weakens credibility.
• Stop on a high note — do not rehabilitate the witness by over-asking.

Paste the deposition below:`,
  },
  {
    title:
      "Draft a reply to a legal notice received from [Counter-party]",
    category: "Notices",
    body: `Draft a reply on behalf of [Client Name] to the legal notice dated [Date] received from [Counter-party / their counsel], in respect of [Subject of Notice].

Inputs:
• Client: [Full Name, Address]
• Counter-party: [Name, Address]
• Notice particulars: reference number, date, demand made, time-frame stipulated
• Client's version: [Concise account of facts and defence]
• Documents in possession: [List]

Required structure:
1. Reference and date.
2. Acknowledgement of receipt of the notice without admitting any of its contents.
3. Para-wise reply — admit, deny, or call for strict proof of every averment.
4. Client's positive case — set out the true and correct facts.
5. Demand made by the noticee is meritless — give reasons (limitation, no privity, no breach, payment already made, set-off, etc.).
6. Counter-claim, if any.
7. Reservation of rights — without prejudice to all rights and remedies, including initiating civil and / or criminal action against the noticee for [defamation / malicious prosecution / abuse of process].
8. Closing salutation; advocate's signature with enrolment number.

Drafting notes:
• Maintain a measured tone; do not match aggression with aggression.
• Confine reply strictly to facts; legal arguments to follow at the proceedings stage.
• Send by Speed Post AD; preserve postal receipts and a copy on file.`,
  },
];
