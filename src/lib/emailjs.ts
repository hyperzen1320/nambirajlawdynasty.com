// EmailJS delivers the /contact enquiry form straight from the visitor's
// browser to the inbox connected to the EmailJS service below, so the site
// needs no mail server or credentials of its own.
//
// All three values are public identifiers by EmailJS's design — they end up in
// the browser bundle whichever way they are supplied. What stops anyone else
// reusing them is the "Allowed domains" list in the EmailJS dashboard
// (Account → Security), so keep that restricted to the site's domain.
// NEVER put the account's Private Key here.
//
// Where to find them in the EmailJS dashboard:
//   serviceId   Email Services → the connected service
//   templateId  Email Templates → the enquiry template
//   publicKey   Account → General → Public Key

export const EMAILJS = {
  serviceId: "service_0ipau32",
  templateId: "",
  publicKey: "",
};

const SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

/** True once all three identifiers are filled in. */
export function emailjsConfigured(): boolean {
  return Boolean(EMAILJS.serviceId && EMAILJS.templateId && EMAILJS.publicKey);
}

/**
 * Sends one email through the EmailJS template. Each key in `params` is
 * available in the template as {{key}}. Throws with EmailJS's reason when the
 * send is rejected (bad template id, domain not allowed, rate limit, …).
 */
export async function sendEmailjs(params: Record<string, string>): Promise<void> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS.serviceId,
      template_id: EMAILJS.templateId,
      user_id: EMAILJS.publicKey,
      template_params: params,
    }),
  });
  if (!res.ok) {
    const reason = await res.text().catch(() => "");
    throw new Error(reason || `EmailJS responded ${res.status}`);
  }
}
