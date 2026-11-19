/** Deterministic guard applied before Nex HR routes questions or calls the model. */
export function assessNexHrRequest(question:string):{allowed:boolean;reason?:string;message?:string}{
 const q=question.trim();
 // Never place passwords, tokens, or bank account numbers into a model prompt or chat history.
 const secrets=/(?:\b(?:password|passcode|secret key|api[ _-]?key|access token|refresh token|private key)\s*(?:is|:|=)\s*[^\s]{5,})|(?:\b(?:account number|bank account|iban)\s*(?:is|:|=)\s*[A-Z0-9 -]{8,})/i;
 if(secrets.test(q))return {allowed:false,reason:'sensitive_input',message:'Do not enter passwords, access tokens or banking details in Nex HR. Use the secure HRMS module instead.'};
 const bypass=/(?:ignore (?:all |any )?(?:previous|prior|system|developer) instructions|reveal (?:your |the )?(?:system prompt|developer prompt|hidden instructions)|(?:disable|bypass) (?:all )?(?:security|authorization|access controls)|(?:pretend|act) (?:you are|as) (?:the )?(?:system administrator|root user))/i;
 if(bypass.test(q))return {allowed:false,reason:'instruction_bypass',message:'Nex HR cannot override its security or authorization rules.'};
 return {allowed:true};
}
