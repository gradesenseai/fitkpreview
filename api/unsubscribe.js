// /api/unsubscribe.js
// One-click unsubscribe for Daily Dink subscribers.
//
// GET /api/unsubscribe?token=<uuid>
//
// The unsubscribe token is the subscriber's confirm_token (same UUID).
// It's included in every email footer by send_daily_dink.py.
//
// Flow:
//   1. Look up subscriber by confirm_token
//   2. Set unsubscribed_at = now()
//   3. Show a friendly "You've been unsubscribed" page

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { token } = req.query;
  const siteUrl = (process.env.SITE_URL || 'https://faithinthekitchen.com').replace(/\/$/, '');

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return sendPage(res, 400, 'Invalid Link',
      'This unsubscribe link looks malformed. Please contact us at ' +
      '<a href="mailto:hello@faithinthekitchen.com">hello@faithinthekitchen.com</a> ' +
      'and we\'ll remove you right away.');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    // ------------------------------------------------------------------
    // 1. Look up subscriber
    // ------------------------------------------------------------------
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?confirm_token=eq.${token}&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Accept': 'application/json',
        }
      }
    );

    if (!lookupRes.ok) {
      console.error('Supabase lookup failed:', await lookupRes.text());
      return sendPage(res, 500, 'Database Error',
        'Could not process your request right now. Please try again in a moment.');
    }

    const rows = await lookupRes.json();

    if (!rows || rows.length === 0) {
      // Token not found — already unsubscribed or never existed; be gracious
      return sendPage(res, 200, 'Already Unsubscribed',
        'Looks like you\'ve already been removed from the list. You won\'t receive any more Daily Dink emails. ' +
        `<br><br><a href="${siteUrl}">Back to faithinthekitchen.com &rarr;</a>`);
    }

    const subscriber = rows[0];

    // Already unsubscribed
    if (subscriber.unsubscribed_at) {
      return sendPage(res, 200, 'Already Unsubscribed',
        `You were already removed from the Daily Dink list on ${new Date(subscriber.unsubscribed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ` +
        `<br><br><a href="${siteUrl}">Back to faithinthekitchen.com &rarr;</a>`);
    }

    // ------------------------------------------------------------------
    // 2. Set unsubscribed_at
    // ------------------------------------------------------------------
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?id=eq.${subscriber.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString() })
      }
    );

    if (!patchRes.ok) {
      console.error('Supabase unsubscribe patch failed:', await patchRes.text());
      return sendPage(res, 500, 'Could Not Unsubscribe',
        'Something went wrong. Please email us at ' +
        '<a href="mailto:hello@faithinthekitchen.com">hello@faithinthekitchen.com</a> ' +
        'and we\'ll remove you manually.');
    }

    // ------------------------------------------------------------------
    // 3. Confirmation page
    // ------------------------------------------------------------------
    return sendPage(res, 200, 'You\'ve Been Unsubscribed',
      'You\'ve been removed from the FITK Daily Dink list. No more emails from us. ' +
      '<br><br>Changed your mind? You can always sign up again at ' +
      `<a href="${siteUrl}">faithinthekitchen.com</a>.`);

  } catch (err) {
    console.error('unsubscribe error:', err);
    return sendPage(res, 500, 'Error', `Something went wrong: ${err.message}`);
  }
};

function sendPage(res, status, title, message) {
  res.status(status).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} — FITK Daily Dink</title>
      <style>
        body {
          font-family: 'Inter', Helvetica, Arial, sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0; background: #F5F5F0; color: #000;
        }
        .card {
          background: #fff; border: 1px solid rgba(0,0,0,0.12);
          padding: 3rem 2.5rem; max-width: 480px; text-align: center;
        }
        .label {
          font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.14em; color: #C8963E; margin-bottom: 1rem;
        }
        h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; }
        p  { font-size: 0.95rem; color: #464646; line-height: 1.6; margin: 0; }
        a  { color: #C8963E; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="label">FITK Daily Dink</div>
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `);
}
