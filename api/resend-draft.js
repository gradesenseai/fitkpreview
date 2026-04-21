// /api/resend-draft.js
// Resend the approval email for an existing pending draft. Reads the row from
// Supabase (so we don't have to re-POST the full post_html payload) and fires
// the same Resend email used by /api/send-draft. Auth-gated with the same
// x-api-key used by the scheduled task.
//
// Usage:
//   POST /api/resend-draft
//     headers: x-api-key: <DRAFT_API_SECRET>
//     body:    { "edition_date": "2026-04-21" }   OR   { "token": "<approve_token>" }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-api-key'];
  if (authHeader !== process.env.DRAFT_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { edition_date, token } = req.body || {};
    if (!edition_date && !token) {
      return res.status(400).json({ error: 'Provide edition_date or token' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // 1. Look up the draft
    const query = token
      ? `approve_token=eq.${encodeURIComponent(token)}`
      : `edition_date=eq.${encodeURIComponent(edition_date)}&status=eq.pending&order=created_at.desc&limit=1`;

    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/daily_dink_drafts?${query}&select=id,edition_date,post_title,approve_token,headlines`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    if (!lookupRes.ok) {
      const err = await lookupRes.text();
      return res.status(500).json({ error: 'Supabase lookup failed', detail: err });
    }
    const rows = await lookupRes.json();
    if (!rows.length) {
      return res.status(404).json({ error: 'No matching pending draft found' });
    }
    const draft = rows[0];

    // 2. Normalize headline shape (same fallback keys as send-draft.js).
    const pickFirst = (obj, keys) => {
      for (const k of keys) {
        if (obj && obj[k] != null && obj[k] !== '') return obj[k];
      }
      return undefined;
    };
    const normalizeHeadline = (h) => {
      if (!h || typeof h !== 'object') return h;
      return {
        title:       pickFirst(h, ['title', 'headline', 'name']) || '',
        summary:     pickFirst(h, ['summary', 'preview', 'description', 'body', 'snippet']) || '',
        source_url:  pickFirst(h, ['source_url', 'url', 'link', 'href']) || '',
        source_name: pickFirst(h, ['source_name', 'source', 'outlet', 'publisher', 'site']) || '',
        tags:        Array.isArray(h.tags) ? h.tags : []
      };
    };
    const headlines = Array.isArray(draft.headlines)
      ? draft.headlines.map(normalizeHeadline)
      : [];

    // 3. Build email (same markup as send-draft.js)
    const siteUrl = process.env.SITE_URL || 'https://faithinthekitchen.com';
    const approveLink = `${siteUrl}/api/approve?token=${draft.approve_token}`;

    const tagToString = (t) => {
      if (t == null) return '';
      if (typeof t === 'string') return t;
      if (typeof t === 'number' || typeof t === 'boolean') return String(t);
      if (typeof t === 'object') {
        return t.name || t.label || t.text || t.value || t.tag || t.title || '';
      }
      return '';
    };
    const escapeHtml = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const headlineList = headlines.map(h => {
      const tagsHtml = Array.isArray(h.tags)
        ? h.tags
            .map(tagToString)
            .filter(Boolean)
            .map(t => `<span style="display:inline-block;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.6px;background:#f0f2f5;color:#0a1d3c;padding:3px 8px;border-radius:999px;text-transform:uppercase;margin:0 4px 4px 0;line-height:1.2;">${escapeHtml(t)}</span>`)
            .join('')
        : '';
      return `<tr>
        <td style="padding:16px 0;border-bottom:1px solid #e5e5e5;">
          <div style="font-weight:600;font-size:15px;color:#000;margin-bottom:8px;line-height:1.25;">${h.title}</div>
          ${tagsHtml ? `<div style="margin-bottom:8px;">${tagsHtml}</div>` : ''}
          <div style="font-size:14px;color:#464646;line-height:1.5;margin-bottom:8px;">${h.summary}</div>
          <a href="${h.source_url}" style="font-size:12px;color:#C8963E;text-transform:uppercase;letter-spacing:0.1em;text-decoration:underline;text-decoration-color:#C8963E;">Read at ${h.source_name} &rarr;</a>
        </td>
      </tr>`;
    }).join('');

    const emailHtml = `
    <div style="max-width:600px;margin:0 auto;font-family:'Inter',Helvetica,Arial,sans-serif;color:#000;">
      <div style="background:#000;padding:16px 24px;text-align:center;">
        <span style="color:#C8963E;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;">FITK DAILY DINK</span>
      </div>
      <div style="padding:24px;">
        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#000;">${draft.post_title}</h1>
        <p style="font-size:13px;color:#464646;margin:0 0 12px;">${draft.edition_date}</p>
        <p style="font-size:14px;font-style:italic;color:#333;margin:0 0 20px;line-height:1.5;">Some of the top stories moving in pro pickleball today.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;">
          ${headlineList}
        </table>
        <div style="margin-top:32px;text-align:center;">
          <a href="${approveLink}" style="display:inline-block;background:#C8963E;color:#fff;padding:14px 40px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">APPROVE AND PUBLISH</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#999;margin-top:16px;">
          Tap above to publish this edition to faithinthekitchen.com/news/. To pause today's subscriber send, reply with the word HOLD. For edits, open Cowork.
        </p>
      </div>
      <div style="background:#f5f5f0;padding:16px 24px;text-align:center;">
        <span style="font-size:11px;color:#999;">Faith in the Kitchen - Draft Review (resend)</span>
      </div>
    </div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'FITK Daily Dink <team@faithinthekitchen.com>',
        to: [process.env.REVIEW_EMAIL || 'team@faithinthekitchen.com'],
        reply_to: 'hold@inbound.faithinthekitchen.com',
        subject: `FITK Daily Dink Draft - ${draft.edition_date} (resend)`,
        html: emailHtml
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      return res.status(500).json({ error: 'Resend email failed', detail: err });
    }

    return res.status(200).json({
      success: true,
      draft_id: draft.id,
      edition_date: draft.edition_date,
      approve_link: approveLink
    });

  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
