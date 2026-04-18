// /api/contents-write-test.js
// Tests whether the GITHUB_TOKEN can use the Contents API (PUT /contents/:path).
// If blobs-API write is blocked but Contents-API write works, we can simplify
// approve.js to use only that endpoint.
//
// Creates .write-test/contents-probe.txt on a throwaway branch (never merged),
// then deletes the branch. Usage:
//   /api/contents-write-test?key=<DRAFT_API_SECRET>

module.exports = async function handler(req, res) {
  const key = req.query.key || req.headers['x-api-key'];
  if (key !== process.env.DRAFT_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'gradesenseai/fitkpreview';
  if (!token) return res.status(500).json({ error: 'GITHUB_TOKEN is not set' });

  const H = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'fitkpreview-contents-write-test',
  };

  const trail = [];
  const log = (m) => trail.push(`${new Date().toISOString()} ${m}`);
  const out = { repo, steps: trail };
  const branch = `contents-probe-${Date.now()}`;

  try {
    // 1. Get the latest main SHA
    let r = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers: H });
    out.ref_status = r.status;
    if (!r.ok) {
      out.ref_body = (await r.text()).slice(0, 400);
      out.fail_at = 'get ref heads/main';
      return res.status(200).json(out);
    }
    const { object: { sha: mainSha } } = await r.json();
    log(`main -> ${mainSha.slice(0, 7)}`);

    // 2. Create a throwaway branch from main
    r = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha }),
    });
    out.branch_create_status = r.status;
    if (!r.ok) {
      out.branch_create_body = (await r.text()).slice(0, 400);
      out.fail_at = `create branch ${branch}`;
      return res.status(200).json(out);
    }
    log(`created branch ${branch}`);

    // 3. Try to PUT a file via Contents API on the throwaway branch
    const content = Buffer.from(`contents-write-test ${new Date().toISOString()}\n`, 'utf-8').toString('base64');
    r = await fetch(`https://api.github.com/repos/${repo}/contents/.write-test/contents-probe.txt`, {
      method: 'PUT', headers: H,
      body: JSON.stringify({
        message: 'contents-write-test probe',
        content,
        branch,
      }),
    });
    out.contents_put_status = r.status;
    const putBody = await r.text();
    if (!r.ok) {
      out.contents_put_body = putBody.slice(0, 400);
      out.fail_at = 'PUT contents';
      // Still try to clean up the branch
      await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, { method: 'DELETE', headers: H });
      return res.status(200).json(out);
    }
    log(`PUT contents succeeded (branch=${branch})`);

    // 4. Cleanup: delete the throwaway branch
    const delRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
      method: 'DELETE', headers: H,
    });
    out.branch_delete_status = delRes.status;
    log(`deleted branch ${branch} (status ${delRes.status})`);

    out.ok = true;
    out.verdict = 'Contents API PUT works. We can route approve.js through this endpoint only (skip the git/blobs path).';
    return res.status(200).json(out);
  } catch (e) {
    out.thrown = String(e.message || e);
    return res.status(200).json(out);
  }
};
