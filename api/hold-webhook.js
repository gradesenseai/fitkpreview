// /api/hold-webhook.js
// Resend inbound email webhook — lets Mark reply "HOLD" to the 7 AM preview
// email to pause today's 10 AM subscriber send without opening a terminal.
//
// Setup in Resend Dashboard:
//   Domains → faithinthekitchen.com → Inbound → Add Route
//   Match: To contains "hold@faithinthekitchen.com"  (or any address you want)
//   Webhook URL: https://faithinthekitchen.com/api/hold-webhook
//   Secret: set RESEND_WEBHOOK_SECRET env var (Resend signs requests with this)
//
// How Mark uses it:
//   1. Mark receives the 7 AM draft preview email
//   2. He replies with the word "HOLD" anywhere in the subject or body
//   3. Resend routes the inbound reply to this webhook
//   4. This function verifies the payload, sets hold_today = true in Supabase
//   5. The 10 AM send_daily_dink.py checks the flag and skips sending
//
// Security:
//   - Resend signs webhook payloads with HMAC-SHA256 using your webhook secret
//   - We verify the signature before touching Supabase
//   - We also check that the sender is a trusted address (TRUSTED_SENDERS env var)

const crypto = require('crypto');

const TRUSTED_SENDERS = (process.env.TRUSTED_SENDERS || 'team@faithinthekitchen.com')
  .split(',')
  .map(s => s.trim().toLowerCase());

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ------------------------------------------------------------------
  // 1. Verify Resend webhook signature
  //    Resend sends: svix-id, svix-timestamp, svix-signature headers
  // ------------------------------------------------------------------
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const svixId        = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(401).json({ error: 'Missing webhook signature headers' });
    }

    // Resend signs: "<svix-id>.<svix-timestamp>.<raw-body>"
    const rawBody = JSON.stringify(req.body);
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
    const expectedSig = crypto.createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // svix-signature may be "v1,<base64>" — strip the prefix
    const receivedSigs = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''));
    const sigMatches = receivedSigs.some(sig => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(expectedSig, 'base64'));
      } catch { return false; }
    });

    if (!sigMatches) {
      console.warn('hold-webhook: signature mismatch');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } else {
    console.warn('hold-webhook: RESEND_WEBHOOK_SECRET not set — running without signature verification');
  }

  // ------------------------------------------------------------------
  // 2. Parse the inbound email payload from Resend
  // ------------------------------------------------------------------
  const payload = req.body;

  // Resend inbound email schema:
  // { type: 'email.received', data: { from, to, subject, text, html, ... } }
  const emailData = payload?.data || payload;
  const fromRaw   = (emailData?.from || '').toLowerCase();
  const subject   = (emailData?.subject || '').toLowerCase();
  const bodyText  = (emailData?.text || emailData?.plain_text || '').toLowerCase();

  // Extract the email address from "Name <email@address.com>" format
  const fromMatch = fromRaw.match(/<([^>]+)>/) || [null, fromRaw];
  const fromEmail = fromMatch[1].trim();

  // ------------------------------------------------------------------
  // 3. Check the sender is trusted
  // ------------------------------------------------------------------
  if (!TRUSTED_SENDERS.includes(fromEmail)) {
    console.warn(`hold-webhook: untrusted sender ${fromEmail}`);
    return res.status(403).json({ error: 'Sender not authorized to trigger hold' });
  }

  // ------------------------------------------------------------------
  // 4. Check if the word "HOLD" appears in subject or first 500 chars of body
  // ------------------------------------------------------------------
  const holdKeyword = 'hold';
  const bodySnippet = bodyText.slice(0, 500);
  const isHoldRequest = subject.includes(holdKeyword) || bodySnippet.includes(holdKeyword);

  if (!isHoldRequest) {
    // Reply without "HOLD" — ignore silently (maybe it's an out-of-office, etc.)
    console.log(`hold-webhook: reply from ${fromEmail} did not contain "HOLD" — ignoring`);
    return res.status(200).json({ received: true, action: 'ignored' });
  }

  // ------------------------------------------------------------------
  // 5. Set hold_today = true in Supabase
  // ------------------------------------------------------------------
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const reason      = `Hold triggered via email reply from ${fromEmail}`;

  try {
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/send_config?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hold_today: true,
        hold_reason: reason,
      })
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error('hold-webhook: Supabase patch failed:', err);
      return res.status(500).json({ error: 'Could not set hold in database' });
    }

    console.log(`hold-webhook: HOLD set by ${fromEmail}`);
    return res.status(200).json({
      received: true,
      action: 'hold_set',
      reason,
    });

  } catch (err) {
    console.error('hold-webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
