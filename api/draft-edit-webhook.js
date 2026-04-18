// /api/draft-edit-webhook.js
// Inbound Resend webhook for reply-with-edits on a Daily Dink preview email.
//
// Flow:
//   1. Mark gets a preview email "FITK Daily Dink Draft - 2026-04-19"
//   2. He replies with free-form edit instructions
//      ("swap headline 3 for the paddle war story, shorten the MLP summary")
//   3. Resend routes the inbound reply here
//   4. This function:
//       a. Verifies the signature and trusted sender
//       b. Finds the draft by date (parsed from Subject)
//       c. Calls Anthropic to apply his instructions to the stored headlines
//       d. Regenerates the headlines section of post_html and the card_html
//       e. Updates Supabase (new headlines / post_html / card_html, status=pending)
//       f. Sends a new preview email via Resend with subject
//          "REVISED FITK Daily Dink Draft - 2026-04-19"
//       g. Same approve_token — Mark can approve OR keep iterating
//
// Setup in Resend:
//   Domains -> faithinthekitchen.com -> Inbound -> Add Route
//   Match:    To contains "drafts@faithinthekitchen.com"  (or whatever you pick)
//   Webhook:  https://faithinthekitchen.com/api/draft-edit-webhook
//   Signing secret: same RESEND_WEBHOOK_SECRET env var used by hold-webhook
//
// Env vars used:
//   RESEND_WEBHOOK_SECRET, RESEND_API_KEY, RESEND_FROM (optional),
//   REVIEW_EMAIL (optional), TRUSTED_SENDERS, SUPABASE_URL, SUPABASE_ANON_KEY,
//   ANTHROPIC_API_KEY, SITE_URL (optional)

const crypto = require('crypto');

const TRUSTED_SENDERS = (process.env.TRUSTED_SENDERS || 'team@faithinthekitchen.com')
  .split(',').map(s => s.trim().toLowerCase());

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify webhook signature (Resend uses svix)
  if (process.env.RESEND_WEBHOOK_SECRET && !verifySvixSignature(req)) {
    console.warn('draft-edit-webhook: signature mismatch');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // 2. Parse payload
  const payload = req.body?.data || req.body || {};
  const fromRaw = String(payload.from || '').toLowerCase();
  const subject = String(payload.subject || '');
  const bodyText = String(payload.text || payload.plain_text || stripHtml(payload.html) || '');

  const fromMatch = fromRaw.match(/<([^>]+)>/) || [null, fromRaw.trim()];
  const fromEmail = (fromMatch[1] || '').trim();

  if (!TRUSTED_SENDERS.includes(fromEmail)) {
    console.warn(`draft-edit-webhook: untrusted sender ${fromEmail}`);
    return res.status(403).json({ error: 'Sender not authorized' });
  }

  // 3. Identify target draft by date in the subject (YYYY-MM-DD)
  const dateMatch = subject.match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    return res.status(400).json({ error: 'Could not find an edition date (YYYY-MM-DD) in the subject' });
  }
  const editionDate = dateMatch[1];

  // 4. Fetch the draft from Supabase (most recent for that date that's not yet approved)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const draftRes = await fetch(
    `${supabaseUrl}/rest/v1/daily_dink_drafts?edition_date=eq.${editionDate}&status=in.(pending,rejected)&order=created_at.desc&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (!draftRes.ok) {
    const err = await draftRes.text();
    return res.status(500).json({ error: 'Supabase lookup failed', detail: err });
  }
  const drafts = await draftRes.json();
  if (!drafts.length) {
    return res.status(404).json({ error: `No pending/rejected draft found for ${editionDate}` });
  }
  const draft = drafts[0];

  // 5. Isolate just the new content of Mark's reply (strip quoted history)
  const instructions = stripQuotedReply(bodyText).trim();
  if (!instructions) {
    return res.status(400).json({ error: 'Could not find edit instructions in the reply body' });
  }
  console.log(`draft-edit-webhook: editing ${editionDate}, ${instructions.length} chars of instructions`);

  // 6. Call Anthropic to apply the edits
  let revised;
  try {
    revised = await applyEdits({ draft, instructions });
  } catch (e) {
    console.error('draft-edit-webhook: Anthropic edit failed', e);
    return res.status(500).json({ error: 'Edit application failed', detail: e.message });
  }

  // 7. Regenerate post_html and card_html with the revised content
  const newPostHtml = replaceHeadlinesAndDek(draft.post_html, revised.headlines, revised.dek);
  const newCardHtml = replaceCardContent(draft.card_html, revised.headlines, revised.card_excerpt || revised.dek);

  // 8. Update the draft in Supabase (status reset to pending so approve link works again)
  const patchRes = await fetch(`${supabaseUrl}/rest/v1/daily_dink_drafts?id=eq.${draft.id}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      headlines: revised.headlines,
      post_html: newPostHtml,
      card_html: newCardHtml,
      status: 'pending',
    }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    return res.status(500).json({ error: 'Supabase update failed', detail: err });
  }

  // 9. Send the revised preview email
  await sendRevisedEmail({
    to: process.env.REVIEW_EMAIL || 'team@faithinthekitchen.com',
    editionDate: draft.edition_date,
    postTitle: draft.post_title,
    dek: revised.dek,
    headlines: revised.headlines,
    approveToken: draft.approve_token,
  });

  return res.status(200).json({
    received: true,
    action: 'revised',
    edition_date: editionDate,
    draft_id: draft.id,
  });
};

// ---------------------------------------------------------------------------
// Signature verification (same as hold-webhook)
// ---------------------------------------------------------------------------
function verifySvixSignature(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const svixId        = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  const rawBody = JSON.stringify(req.body);
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const received = String(svixSignature).split(' ').map(s => s.replace(/^v1,/, ''));
  return received.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(expected, 'base64'));
    } catch { return false; }
  });
}

// ---------------------------------------------------------------------------
// Email body parsing
// ---------------------------------------------------------------------------
function stripHtml(h) {
  if (!h) return '';
  return String(h)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuotedReply(txt) {
  if (!txt) return '';
  // Common markers that separate the new reply from the quoted message
  const markers = [
    /^On .+ wrote:$/m,
    /^-{2,} Forwarded message -{2,}$/m,
    /^From: .+$/m,
    /^Sent from my /m,
    /^> /m,
  ];
  let earliest = txt.length;
  for (const re of markers) {
    const m = txt.match(re);
    if (m && m.index !== undefined && m.index < earliest) earliest = m.index;
  }
  return txt.slice(0, earliest).trim();
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------
async function applyEdits({ draft, instructions }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const currentPayload = {
    edition_date: draft.edition_date,
    dek: extractDek(draft.post_html) || '',
    headlines: draft.headlines || [],
  };

  const systemPrompt = [
    'You are editing a FITK Daily Dink edition. Return ONLY a JSON object with this shape:',
    '{',
    '  "dek": "Some of the top stories moving in pro pickleball today, ...",',
    '  "card_excerpt": "short archive-card excerpt (<=220 chars), plain text",',
    '  "headlines": [ { "title": "...", "tags": ["t1","t2","t3","t4","t5"], "summary": "2 sentence fair-use summary", "source_url": "https://...", "source_name": "..." } ]',
    '}',
    'Constraints:',
    '- Exactly 5 tags per headline, plain strings. Full names (e.g. "Anna Leigh Waters" not "Waters").',
    '- Keep the dek prefix "Some of the top stories moving in pro pickleball today" exactly as written at the start.',
    '- No em or en dashes, use regular hyphens.',
    '- Preserve any headlines the user did not ask to change.',
    '- 5 to 10 headlines total.',
    '- Output JSON only. No prose before or after.',
  ].join('\n');

  const userPrompt = [
    'Current edition:',
    '```json',
    JSON.stringify(currentPayload, null, 2),
    '```',
    '',
    'Edit instructions from the editor:',
    '"""',
    instructions,
    '"""',
    '',
    'Apply the instructions and return the updated edition JSON.',
  ].join('\n');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Anthropic ${r.status}: ${body.slice(0, 400)}`);
  }
  const data = await r.json();
  const text = (data.content || []).map(b => b.text || '').join('');
  // Extract the first JSON object from the response
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error('Anthropic response had no JSON');
  const revised = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  if (!Array.isArray(revised.headlines) || !revised.headlines.length) {
    throw new Error('Revised payload missing headlines');
  }
  // Normalize tags to strings just in case
  revised.headlines = revised.headlines.map(h => ({
    ...h,
    tags: (h.tags || []).map(t => typeof t === 'string' ? t : (t?.label || t?.name || String(t))),
  }));
  return revised;
}

function extractDek(postHtml) {
  const m = String(postHtml || '').match(/<p class="news-post-dek"><em>([\s\S]*?)<\/em><\/p>/);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------
// HTML regen
// ---------------------------------------------------------------------------
function renderHeadlinesList(headlines) {
  const items = headlines.map(h => {
    const tagsHtml = (h.tags || []).map(t => `<span class="dink-headline-tag">${escapeHtml(t)}</span>`).join('');
    return `        <li class="dink-headline-item">
          <h2 class="dink-headline-title">${escapeHtml(h.title)}</h2>
          <div class="dink-headline-tags">${tagsHtml}</div>
          <p class="dink-headline-summary">${escapeHtml(h.summary)}</p>
          <a class="dink-headline-source" href="${escapeHtml(h.source_url)}" target="_blank" rel="noopener noreferrer">Read at ${escapeHtml(h.source_name)} &rarr;</a>
        </li>`;
  }).join('\n');
  return `<ul class="dink-headlines">\n${items}\n        </ul>`;
}

function replaceHeadlinesAndDek(postHtml, headlines, dek) {
  let out = postHtml;
  // Replace the <ul class="dink-headlines">...</ul>
  const ulRe = /<ul class="dink-headlines">[\s\S]*?<\/ul>/;
  if (ulRe.test(out)) out = out.replace(ulRe, renderHeadlinesList(headlines));
  // Replace the <p class="news-post-dek"><em>...</em></p>
  if (dek) {
    const dekRe = /<p class="news-post-dek"><em>[\s\S]*?<\/em><\/p>/;
    if (dekRe.test(out)) {
      out = out.replace(dekRe, `<p class="news-post-dek"><em>${escapeHtml(dek)}</em></p>`);
    }
    // Also update meta descriptions (best-effort, stops at the first closing quote)
    out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeAttr(dek)}$2`);
    out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeAttr(dek)}$2`);
    out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeAttr(dek)}$2`);
  }
  return out;
}

function replaceCardContent(cardHtml, headlines, excerpt) {
  let out = cardHtml;
  // Rebuild the news-tags div with the top 4 unique tag strings across all headlines
  const flat = [];
  const seen = new Set();
  for (const h of headlines) {
    for (const t of (h.tags || [])) {
      if (!seen.has(t)) { seen.add(t); flat.push(t); }
      if (flat.length >= 4) break;
    }
    if (flat.length >= 4) break;
  }
  const tagClasses = ['topic', 'player', 'brand', 'topic'];
  const tagsMarkup = flat.map((t, i) =>
    `<span class="news-tag news-tag--${tagClasses[i] || 'topic'}">${escapeHtml(t)}</span>`
  ).join('');
  out = out.replace(/<div class="news-tags">[\s\S]*?<\/div>/, `<div class="news-tags">${tagsMarkup}</div>`);

  // Replace the excerpt
  if (excerpt) {
    out = out.replace(/<p class="news-card-excerpt">[\s\S]*?<\/p>/,
      `<p class="news-card-excerpt">${escapeHtml(excerpt)}</p>`);
  }
  return out;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Outbound email (REVISED subject)
// ---------------------------------------------------------------------------
async function sendRevisedEmail({ to, editionDate, postTitle, dek, headlines, approveToken }) {
  const siteUrl = process.env.SITE_URL || 'https://faithinthekitchen.com';
  const approveLink = `${siteUrl}/api/approve?token=${approveToken}`;

  const headlineRows = (headlines || []).map(h => {
    const tagsHtml = (h.tags || []).map(t =>
      `<span style="display:inline-block;font-family:'Inter',Helvetica,Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.6px;background:#f0f2f5;color:#0a1d3c;padding:3px 8px;border-radius:999px;text-transform:uppercase;margin:0 4px 4px 0;line-height:1.2;">${escapeHtml(t)}</span>`
    ).join('');
    return `<tr>
      <td style="padding:16px 0;border-bottom:1px solid #e5e5e5;">
        <div style="font-weight:600;font-size:15px;color:#000;margin-bottom:8px;line-height:1.25;">${escapeHtml(h.title)}</div>
        ${tagsHtml ? `<div style="margin-bottom:8px;">${tagsHtml}</div>` : ''}
        <div style="font-size:14px;color:#464646;line-height:1.5;margin-bottom:8px;">${escapeHtml(h.summary)}</div>
        <a href="${escapeAttr(h.source_url)}" style="font-size:12px;color:#C8963E;text-transform:uppercase;letter-spacing:0.1em;text-decoration:underline;text-decoration-color:#C8963E;">Read at ${escapeHtml(h.source_name)} &rarr;</a>
      </td>
    </tr>`;
  }).join('');

  const emailHtml = `
  <div style="max-width:600px;margin:0 auto;font-family:'Inter',Helvetica,Arial,sans-serif;color:#000;">
    <div style="background:#000;padding:16px 24px;text-align:center;">
      <span style="color:#C8963E;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;">REVISED FITK DAILY DINK</span>
    </div>
    <div style="padding:24px;">
      <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#000;">${escapeHtml(postTitle || `FITK Daily Dink - ${editionDate}`)}</h1>
      <p style="font-size:13px;color:#464646;margin:0 0 12px;">${editionDate} &middot; revised draft</p>
      <p style="font-size:14px;font-style:italic;color:#333;margin:0 0 20px;line-height:1.5;">${escapeHtml(dek || '')}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;">
        ${headlineRows}
      </table>
      <div style="margin-top:32px;text-align:center;">
        <a href="${approveLink}" style="display:inline-block;background:#C8963E;color:#fff;padding:14px 40px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">APPROVE AND PUBLISH</a>
      </div>
      <p style="text-align:center;font-size:12px;color:#999;margin-top:16px;">
        Reply again to keep editing. Same date in the subject line and the draft will revise in place.
      </p>
    </div>
  </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'FITK Daily Dink <team@faithinthekitchen.com>',
      to: [to],
      reply_to: 'drafts@inbound.faithinthekitchen.com',
      subject: `REVISED FITK Daily Dink Draft - ${editionDate}`,
      html: emailHtml,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error('draft-edit-webhook: Resend send failed', body);
    throw new Error(`Resend ${r.status}: ${body.slice(0, 400)}`);
  }
}
