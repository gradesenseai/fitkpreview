// /api/confirm.js
// Email confirmation for Daily Dink subscribers.
//
// GET /api/confirm?token=<uuid>
//
// Flow:
//   1. Look up subscriber by confirm_token
//   2. Set confirmed = true
//   3. Redirect to /daily-dink-confirmed.html (a thank-you page)
//
// If the token is invalid or already confirmed, show a friendly message.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { token } = req.query;
  const siteUrl = (process.env.SITE_URL || 'https://faithinthekitchen.com').replace(/\/$/, '');

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return sendPage(res, 400, 'Invalid Link',
      'This confirmation link looks malformed. Please check the email and try again, or sign up again at faithinthekitchen.com.');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    // ------------------------------------------------------------------
    // 1. Look up subscriber by token
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
        'Could not verify your token right now. Please try again in a moment.');
    }

    const rows = await lookupRes.json();

    if (!rows || rows.length === 0) {
      return sendPage(res, 404, 'Link Not Found',
        'This confirmation link has expired or is invalid. Sign up again at faithinthekitchen.com to get a fresh one.');
    }

    const subscriber = rows[0];

    // Already confirmed — no need to update, just be nice about it
    if (subscriber.confirmed) {
      return res.redirect(302, `${siteUrl}/daily-dink-confirmed.html?already=true`);
    }

    // ------------------------------------------------------------------
    // 2. Mark as confirmed
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
        body: JSON.stringify({ confirmed: true })
      }
    );

    if (!patchRes.ok) {
      console.error('Supabase confirm patch failed:', await patchRes.text());
      return sendPage(res, 500, 'Could Not Confirm',
        'Something went wrong saving your confirmation. Please click the link again or contact us at hello@faithinthekitchen.com.');
    }

    // ------------------------------------------------------------------
    // 3. Redirect to thank-you page
    // ------------------------------------------------------------------
    return res.redirect(302, `${siteUrl}/daily-dink-confirmed.html`);

  } catch (err) {
    console.error('confirm error:', err);
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
