// Sandbox routing: the one place that decides which number a text really goes to.

// Twilio's Virtual Phone. Texts to it show up in the Twilio console and need
// no number registration, so a trial account can send to it.
export const TWILIO_VIRTUAL_PHONE = "+18777804236";

type Env = Record<string, string | undefined>;

// On unless SANDBOX_MODE is exactly "false". A typo or a missing value keeps it
// on. Vercel preview deployments are always in sandbox mode.
export function isSandboxMode(env: Env = process.env): boolean {
  if (env.VERCEL_ENV === "preview") {
    return true;
  }
  return env.SANDBOX_MODE !== "false";
}

export interface Recipient {
  // The number the provider is asked to text.
  sendTo: string;
  // Saved to messages.sandbox_redirected_to. Null when the text went to the contact.
  sandboxRedirectedTo: string | null;
}

export function resolveRecipient(contactPhone: string, sandbox: boolean): Recipient {
  if (!sandbox) {
    return { sendTo: contactPhone, sandboxRedirectedTo: null };
  }
  return { sendTo: TWILIO_VIRTUAL_PHONE, sandboxRedirectedTo: TWILIO_VIRTUAL_PHONE };
}
