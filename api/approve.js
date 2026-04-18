// /api/approve.js
// One-tap approve: Mark clicks the link in the draft email, this function
// reads the draft from Supabase, commits the post + updated index to GitHub,
// and Vercel auto-deploys. Done.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { token } = req.query;
  if (!token) {
    return sendPage(res, 400, 'Missing Token', 'No approval token was provided. Check the link in your email.');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || 'gradesenseai/fitkpreview';

  try {
    // 1. Look up the draft by token
    const draftRes = await fetch(
      `${supabaseUrl}/rest/v1/daily_dink_drafts?approve_token=eq.${token}&status=eq.pending&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    if (!draftRes.ok) {
      return sendPage(res, 500, 'Database Error', 'Could not reach the drafts database. Try again in a moment.');
    }

    const drafts = await draftRes.json();
    if (!drafts.length) {
      return sendPage(res, 404, 'Draft Not Found', 'This draft was already published, or the link has expired.');
    }

    const draft = drafts[0];

    // 2. Get the current news/index.html from GitHub (need its SHA to update)
    const indexPath = 'news/index.html';
    const indexRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${indexPath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!indexRes.ok) {
      return sendPage(res, 500, 'GitHub Error', 'Could not read news/index.html from the repo.');
    }

    const indexFile = await indexRes.json();
    const indexContent = Buffer.from(indexFile.content, 'base64').toString('utf-8');

    // 3. Insert card_html at the TOP of the news grid (newest first).
    //    Prefer a BEGIN_NEWS_GRID marker; fall back to inserting right after
    //    the <div class="news-grid" ...> opening tag; last resort, before END.
    const beginMarker = '<!-- BEGIN_NEWS_GRID -->';
    const endMarker = '<!-- END_NEWS_GRID -->';
    let updatedIndex;
    if (indexContent.includes(beginMarker)) {
      updatedIndex = indexContent.replace(
        beginMarker,
        beginMarker + '\n\n      ' + draft.card_html
      );
    } else {
      const gridOpenRe = /(<div[^>]*class="[^"]*\bnews-grid\b[^"]*"[^>]*>)/;
      if (gridOpenRe.test(indexContent)) {
        updatedIndex = indexContent.replace(
          gridOpenRe,
          (m) => m + '\n\n      ' + draft.card_html
        );
      } else if (indexContent.includes(endMarker)) {
        updatedIndex = indexContent.replace(
          endMarker,
          draft.card_html + '\n\n      ' + endMarker
        );
      } else {
        return sendPage(res, 500, 'Publish Failed',
          'Could not find the news grid in news/index.html to insert the card.');
      }
    }

    // 4. Commit both files atomically via GitHub Git Trees API
    // 4a. Get the latest commit SHA on main
    const refRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/ref/heads/main`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!refRes.ok) {
      return sendPage(res, 500, 'GitHub Error', 'Could not get latest commit from main branch.');
    }

    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 4b. Get the tree of the latest commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/commits/${latestCommitSha}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 4c. Create blobs for both files
    const postBlobRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/blobs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: draft.post_html,
          encoding: 'utf-8'
        })
      }
    );
    const postBlob = await postBlobRes.json();

    const indexBlobRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/blobs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: updatedIndex,
          encoding: 'utf-8'
        })
      }
    );
    const indexBlob = await indexBlobRes.json();

    // 4d. Create a new tree with both files
    const treeRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: [
            {
              // Nested-by-column path. Scheduler now emits slug as the
              // edition date only (e.g. "2026-04-18"). If we ever get an
              // old-style slug like "2026-04-18-daily-dink", strip the
              // suffix so the file lands at news/daily-dink/2026-04-18.html.
              path: `news/daily-dink/${String(draft.slug).replace(/-daily-dink$/, '')}.html`,
              mode: '100644',
              type: 'blob',
              sha: postBlob.sha
            },
            {
              path: indexPath,
              mode: '100644',
              type: 'blob',
              sha: indexBlob.sha
            }
          ]
        })
      }
    );
    const treeData = await treeRes.json();

    // 4e. Create the commit
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Publish FITK Daily Dink - ${draft.edition_date}`,
          tree: treeData.sha,
          parents: [latestCommitSha]
        })
      }
    );
    const newCommit = await newCommitRes.json();

    // 4f. Update main to point to the new commit
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/git/ref/heads/main`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: newCommit.sha
        })
      }
    );

    if (!updateRefRes.ok) {
      return sendPage(res, 500, 'Publish Failed', 'Could not push the commit to GitHub. Try again or publish manually.');
    }

    // 5. Mark draft as approved in Supabase
    await fetch(
      `${supabaseUrl}/rest/v1/daily_dink_drafts?id=eq.${draft.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
      }
    );

    // 6. Success page
    const liveSlug = String(draft.slug).replace(/-daily-dink$/, '');
    return sendPage(res, 200, 'Published',
      `FITK Daily Dink for ${draft.edition_date} is live. Vercel will deploy in about 30 seconds.<br><br>` +
      `<a href="https://faithinthekitchen.com/news/daily-dink/${liveSlug}.html" style="color:#C8963E;">View the post &rarr;</a>`
    );

  } catch (err) {
    return sendPage(res, 500, 'Error', `Something went wrong: ${err.message}. Reply to the draft email or open Cowork.`);
  }
}

function sendPage(res, status, title, message) {
  res.status(status).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - FITK Daily Dink</title>
      <style>
        body { font-family: 'Inter', Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F5F0; color: #000; }
        .card { background: #fff; border: 1px solid rgba(0,0,0,0.12); padding: 3rem 2.5rem; max-width: 480px; text-align: center; }
        .label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: #C8963E; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; }
        p { font-size: 0.95rem; color: #464646; line-height: 1.6; margin: 0; }
        a { color: #C8963E; text-decoration: none; }
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
