// /api/subscribe.js
// Handles new Daily Dink subscriber sign-ups.
//
// POST /api/subscribe
// Body: { email: string, first_name?: string }
//
// Flow:
//   1. Validate email
//   2. Upsert into Supabase subscribers table (handles re-subscribes gracefully)
//   3. Send a confirmation email via Resend with a confirm link
//   4. Return 200 so the form can show a "Check your inbox" message

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers (in case the form is on a different origin during testing)
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { email, first_name } = req.body || {};
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanName  = (first_name || '').trim().slice(0, 80);

  // Basic validation
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // service key for writes
  const siteUrl     = (process.env.SITE_URL || 'https://faithinthekitchen.com').replace(/\/$/, '');

  try {
    // ------------------------------------------------------------------
    // 1. Check for an existing subscriber (handles re-subscribe gracefully)
    // ------------------------------------------------------------------
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?email=eq.${encodeURIComponent(cleanEmail)}&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json',
        }
      }
    );

    const existing = await lookupRes.json();
    let subscriber;

    if (existing && existing.length > 0) {
      subscriber = existing[0];

      // If already confirmed and still subscribed, send a gentle "already subscribed" note
      if (subscriber.confirmed && !subscriber.unsubscribed_at) {
        return res.status(200).json({
          success: true,
          message: 'You\'re already on the Daily Dink list! Check your inbox for the next edition.',
          already_subscribed: true,
        });
      }

      // Re-subscribe: clear unsubscribed_at, issue a fresh confirm token
      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/subscribers?id=eq.${subscriber.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            unsubscribed_at: null,
            confirmed: false,
            // Supabase will call gen_random_uuid() only on INSERT;
            // we reset it by passing a new one from JS
            confirm_token: crypto.randomUUID(),
            ...(cleanName ? { first_name: cleanName } : {}),
          })
        }
      );
      const updated = await updateRes.json();
      subscriber = updated[0];

    } else {
      // ------------------------------------------------------------------
      // 2. Insert new subscriber
      // ------------------------------------------------------------------
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/subscribers`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          email: cleanEmail,
          first_name: cleanName || null,
        })
      });

      if (!insertRes.ok) {
        const err = await insertRes.text();
        console.error('Supabase insert error:', err);
        return res.status(500).json({ error: 'Could not save your subscription. Please try again.' });
      }

      const inserted = await insertRes.json();
      subscriber = inserted[0];
    }

    // ------------------------------------------------------------------
    // 3. Send confirmation email via Resend
    // ------------------------------------------------------------------
    const confirmUrl = `${siteUrl}/api/confirm?token=${subscriber.confirm_token}`;
    const greeting   = cleanName ? `Hey ${cleanName},` : 'Hey there,';

    const emailHtml = `
    <div style="max-width:560px;margin:0 auto;font-family:'Inter',Helvetica,Arial,sans-serif;background:#F5F5F0;">
      <div style="background:#000;padding:16px 24px;text-align:center;">
        <span style="color:#C8963E;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;">
          FITK DAILY DINK
        </span>
      </div>
      <div style="background:#fff;padding:32px 24px;">
        <p style="font-size:16px;font-weight:600;margin:0 0 12px;color:#000;">${greeting}</p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 20px;">
          Thanks for signing up for the <strong>FITK Daily Dink</strong> — your daily dose of pickleball news, delivered every morning.
        </p>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 28px;">
          One quick step: confirm your email so we know it's you.
        </p>
        <div style="text-align:center;margin:0 0 28px;">
          <a href="${confirmUrl}"
             style="display:inline-block;background:#C8963E;color:#fff;padding:14px 40px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">
            YES, SUBSCRIBE ME
          </a>
        </div>
        <p style="font-size:12px;color:#999;text-align:center;margin:0;line-height:1.6;">
          If you didn't sign up, just ignore this email — nothing will happen.
        </p>
      </div>
      <div style="background:#000;padding:16px 24px;text-align:center;">
        <span style="font-size:11px;color:#555;">
          Faith in the Kitchen &mdash;
          <a href="${siteUrl}" style="color:#C8963E;text-decoration:none;">faithinthekitchen.com</a>
        </span>
      </div>
    </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'FITK Daily Dink <team@faithinthekitchen.com>',
        to: [cleanEmail],
        subject: 'Confirm your FITK Daily Dink subscription',
        html: emailHtml,
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      // Don't expose send errors to the user — the record is saved, they can re-submit
    }

    return res.status(200).json({
      success: true,
      message: 'Almost there! Check your inbox and click the confirmation link.',
    });

  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
