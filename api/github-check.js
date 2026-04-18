// /api/github-check.js
// Diagnostic endpoint: verifies the GITHUB_TOKEN is valid, shows the user it
// authenticates as, and lists the scopes GitHub reports for it. Does not
// mutate anything.
//
// Usage: https://faithinthekitchen.com/api/github-check?key=<DRAFT_API_SECRET>
// Protected by the same secret as /api/send-draft so it doesn't leak info to
// the public.

module.exports = async function handler(req, res) {
  const key = req.query.key || req.headers['x-api-key'];
  if (key !== process.env.DRAFT_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'gradesenseai/fitkpreview';

  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN is not set in Vercel env vars' });
  }

  const H = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'fitkpreview-github-check',
  };

  const out = { token_set: true, token_prefix: token.slice(0, 7) + '...', repo };

  // /user tells us who the token belongs to + returns x-oauth-scopes header
  const userRes = await fetch('https://api.github.com/user', { headers: H });
  out.user_status = userRes.status;
  out.oauth_scopes = userRes.headers.get('x-oauth-scopes') || '(none — likely a fine-grained PAT)';
  out.accepted_scopes = userRes.headers.get('x-accepted-oauth-scopes') || null;
  out.rate_remaining = userRes.headers.get('x-ratelimit-remaining');
  if (userRes.ok) {
    const u = await userRes.json();
    out.user_login = u.login;
    out.user_type = u.type;
  } else {
    out.user_error = (await userRes.text()).slice(0, 400);
  }

  // Can we read the repo?
  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers: H });
  out.repo_status = repoRes.status;
  if (repoRes.ok) {
    const r = await repoRes.json();
    out.repo_permissions = r.permissions; // { admin, maintain, push, triage, pull }
    out.repo_default_branch = r.default_branch;
  } else {
    out.repo_error = (await repoRes.text()).slice(0, 400);
  }

  // Can we read main branch protection state?
  const protRes = await fetch(`https://api.github.com/repos/${repo}/branches/main`, { headers: H });
  out.branch_status = protRes.status;
  if (protRes.ok) {
    const b = await protRes.json();
    out.branch_protected = b.protected;
    out.branch_protection_required = b.protection?.required_status_checks ? 'has required checks' : 'no required checks';
  }

  return res.status(200).json(out);
};
