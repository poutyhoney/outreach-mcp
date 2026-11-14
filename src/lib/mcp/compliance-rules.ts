// Served as the MCP resource outreach://compliance-rules.
// Keep this in sync with the guardrails in the send tools (M4).
export const COMPLIANCE_RULES_URI = "outreach://compliance-rules";

export const COMPLIANCE_RULES = `# Outreach compliance rules

The server enforces every rule below. A tool call that breaks one is refused
with a plain reason. Read this before drafting or sending anything.

## Consent
- Never message a contact who is opted out. Check consent with get_contact or list_opt_outs.
- Inbound STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, or QUIT opts a contact out.
  START or UNSTOP opts them back in.
- Importing a contact does not create consent. Consent from an import is recorded
  only when the CSV has a consent column that says so.

## Message content
- The body must not be empty and must be at most 1,600 characters.
- The first message to a contact gets "Reply STOP to opt out" appended
  if the body does not already say it.

## Sending window
- Messages go out only between 8:00 and 21:00 in the contact's own timezone.
- If a contact's timezone is unknown, the send is refused. Ask the user for it.

## Broadcasts
- Always call preview_broadcast first and show the user the audience count,
  the skip reasons, and the samples.
- send_broadcast needs the confirm_token from that preview. Only send after the
  user has seen the preview and said yes.
- A broadcast is refused if its audience changed since the preview.
- A broadcast can reach at most 50 recipients.

## Sandbox
- While sandbox mode is on, every outbound message goes to a test phone,
  not to the contact. The intended recipient is still recorded.
`;
