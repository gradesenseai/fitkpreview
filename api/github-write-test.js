// /api/github-write-test.js
// DRY-RUN write test. Exercises the full blob + tree + commit GitHub API path
// the approve endpoint uses, but DOES NOT update refs/heads/main, so nothing
// actually lands on the branch. The blob/tree/commit objects become orphaned
// and get garbage-collected by GitHub later.
//
// Usage: /api/github-write-test?key=<DRAFT_API_SECRET>
// Protected by the same secret as /api/github-check.

module.exports = async function handler(req, res) {
  const key = req.query.key || req.headers['x-api-key'];
  if (key !== process.env.DRAFT_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO || 'gradesenseai/fitkpreview';

  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN is not set' });
  }

  const H = {
<<<<<<< HEAD
    'Authorization': `token ${token}`,
=======
    'Authorization': 'token ' + token,
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'fitkpreview-write-test',
  };

  const trail = [];
<<<<<<< HEAD
  const log = (msg) => { trail.push(`${new Date().toISOString()} ${msg}`); };
  const out = { repo, steps: trail };

  async function step(name, fn) {
    try {
      const r = await fn();
      log(`${name} OK`);
      return r;
    } catch (e) {
      log(`${name} FAILED: ${e.message}`);
      throw e;
    }
  }

  try {
    // 1. get ref heads/main
    let r = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/main`, { headers: H });
=======
  const log = (msg) => { trail.push(new Date().toISOString() + ' ' + msg); };
  const out = { repo, steps: trail };

  try {
    // 1. get ref heads/main
    let r = await fetch('https://api.github.com/repos/' + repo + '/git/ref/heads/main', { headers: H });
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
    out.ref_status = r.status;
    if (!r.ok) {
      out.ref_body = (await r.text()).slice(0, 400);
      out.fail_at = 'get ref heads/main';
      return res.status(200).json(out);
    }
    const refData = await r.json();
    const latestCommitSha = refData.object.sha;
<<<<<<< HEAD
    log(`ref heads/main -> ${latestCommitSha.slice(0,7)}`);

    // 2. get commit
    r = await fetch(`https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`, { headers: H });
=======
    log('ref heads/main -> ' + latestCommitSha.slice(0,7));

    // 2. get commit
    r = await fetch('https://api.github.com/repos/' + repo + '/git/commits/' + latestCommitSha, { headers: H });
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
    out.commit_status = r.status;
    if (!r.ok) {
      out.commit_body = (await r.text()).slice(0, 400);
      out.fail_at = 'get commit';
      return res.status(200).json(out);
    }
    const commitData = await r.json();
    const baseTreeSha = commitData.tree.sha;
<<<<<<< HEAD
    log(`base tree -> ${baseTreeSha.slice(0,7)}`);

    // 3. create blob
    r = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ content: `write-test ${new Date().toISOString()}\n`, encoding: 'utf-8' }),
=======
    log('base tree -> ' + baseTreeSha.slice(0,7));

    // 3. create blob
    r = await fetch('https://api.github.com/repos/' + repo + '/git/blobs', {
      method: 'POST', headers: H,
      body: JSON.stringify({ content: 'write-test ' + new Date().toISOString() + '\n', encoding: 'utf-8' }),
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
    });
    out.blob_status = r.status;
    if (!r.ok) {
      out.blob_body = (await r.text()).slice(0, 400);
      out.fail_at = 'create blob';
      return res.status(200).json(out);
    }
    const blob = await r.json();
<<<<<<< HEAD
    log(`blob -> ${blob.sha.slice(0,7)}`);

    // 4. create tree based on main, adding our throwaway file under .write-test/
    r = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
=======
    log('blob -> ' + blob.sha.slice(0,7));

    // 4. create tree based on main, adding our throwaway file under .write-test/
    r = await fetch('https://api.github.com/repos/' + repo + '/git/trees', {
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
      method: 'POST', headers: H,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [{ path: '.write-test/probe.txt', mode: '100644', type: 'blob', sha: blob.sha }],
      }),
    });
    out.tree_status = r.status;
    if (!r.ok) {
      out.tree_body = (await r.text()).slice(0, 400);
      out.fail_at = 'create tree';
      return res.status(200).json(out);
    }
    const tree = await r.json();
<<<<<<< HEAD
    log(`tree -> ${tree.sha.slice(0,7)}`);

    // 5. create commit (parent = current main, but we will NOT update the ref)
    r = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
=======
    log('tree -> ' + tree.sha.slice(0,7));

    // 5. create commit (parent = current main, but we will NOT update the ref)
    r = await fetch('https://api.github.com/repos/' + repo + '/git/commits', {
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
      method: 'POST', headers: H,
      body: JSON.stringify({
        message: 'write-test probe (orphan, not referenced)',
        tree: tree.sha,
        parents: [latestCommitSha],
      }),
    });
    out.commit_create_status = r.status;
    if (!r.ok) {
      out.commit_create_body = (await r.text()).slice(0, 400);
      out.fail_at = 'create commit';
      return res.status(200).json(out);
    }
    const newCommit = await r.json();
<<<<<<< HEAD
    log(`commit -> ${newCommit.sha.slice(0,7)} (NOT attached to any ref; GitHub will GC this)`);

    // ALL good. We deliberately skip the PATCH /refs/heads/main call, so main
    // is untouched. The objects we just created are orphans.
    out.ok = true;
    out.orphan_commit = newCommit.sha;
    out.verdict = 'GitHub write path works: blob, tree, and commit all created successfully. Updating refs/heads/main from /api/approve should also work. If approve still fails, the issue is elsewhere (supabase, card_html, index.html markers, etc.).';
=======
    log('commit -> ' + newCommit.sha.slice(0,7) + ' (orphan; GitHub GCs this)');

    out.ok = true;
    out.orphan_commit = newCommit.sha;
    out.verdict = 'GitHub write path works: blob, tree, and commit created. Ref update should also work.';
>>>>>>> ddc0676b7379029a291d4ef8f151e416d30581f1
    return res.status(200).json(out);
  } catch (e) {
    out.thrown = String(e.message || e);
    return res.status(200).json(out);
  }
};
