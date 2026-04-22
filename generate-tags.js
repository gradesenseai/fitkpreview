#!/usr/bin/env node
/**
 * FITK tag system generator
 *
 * Runs at Vercel build time (via build.sh) before generate-sitemap.js.
 *
 * For every news post under /news/{daily-dink,weekly-drive,monthly-atp}/:
 *   1. Extracts tags from <span class="dink-headline-tag">...</span> elements
 *   2. Converts those spans into <a class="dink-headline-tag" href="../tag/{slug}.html">
 *   3. Patches the post's .dink-headline-tag CSS block to include
 *      text-decoration: none + a hover rule (idempotent)
 *   4. Injects a "keywords" field into the JSON-LD NewsArticle block so
 *      search engines pick up the topical signal
 *
 * Then it writes one archive page per unique tag at /news/tag/{slug}.html
 * plus an /news/tag/index.html browse-all-tags hub. Tag pages use the
 * shared ../../styles.css stylesheet the same way /news/index.html does.
 *
 * The script is idempotent - running it twice on the same tree is a no-op
 * for already-processed posts.
 *
 * Usage:
 *   node generate-tags.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const NEWS_DIR = path.join(ROOT, 'news');
const TAG_DIR = path.join(NEWS_DIR, 'tag');
const SITE = 'https://faithinthekitchen.com';

// Post-type directories that carry tags.
const POST_DIRS = ['daily-dink', 'weekly-drive', 'monthly-atp'];

const CATEGORY_LABEL = {
  'daily-dink':   'Daily Dink',
  'weekly-drive': 'Weekly Drive',
  'monthly-atp':  'Monthly ATP',
};
const CATEGORY_PLACEHOLDER = {
  'daily-dink':   'DAILY DINK',
  'weekly-drive': 'WEEKLY DRIVE',
  'monthly-atp':  'MONTHLY ATP',
};

/* ---------- utilities ---------- */

function slugify(tag) {
  return String(tag)
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function htmlDecode(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function attrEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/* ---------- post discovery + metadata ---------- */

function discoverPosts() {
  const posts = [];
  for (const cat of POST_DIRS) {
    const dir = path.join(NEWS_DIR, cat);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.html')) continue;
      if (entry.startsWith('_')) continue;
      const file = path.join(dir, entry);
      posts.push({
        file,
        category: cat,
        rel: `${cat}/${entry}`,
      });
    }
  }
  return posts;
}

function extractTagsFromHtml(html) {
  // Match both <span> (legacy) and <a> (already-linked) forms.
  const re = /<(?:span|a)\s+class="dink-headline-tag"[^>]*>([^<]+)<\/(?:span|a)>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = htmlDecode(m[1]).trim();
    if (text) out.push(text);
  }
  return out;
}

function extractTitle(html) {
  const m = html.match(/<h1\s+class="news-post-title"[^>]*>([^<]+)<\/h1>/);
  return m ? htmlDecode(m[1]).trim() : null;
}

function extractDate(html) {
  // Prefer JSON-LD datePublished ("YYYY-MM-DD")
  const m = html.match(/"datePublished":\s*"([^"]+)"/);
  if (m) return m[1].slice(0, 10);
  // Fallback: article:published_time meta
  const m2 = html.match(/<meta property="article:published_time"[^>]+content="([^"]+)"/);
  if (m2) return m2[1].slice(0, 10);
  return '';
}

function extractDek(html) {
  // <p class="news-post-dek"><em>TEXT</em></p>
  const m = html.match(/<p class="news-post-dek"><em>([\s\S]*?)<\/em><\/p>/);
  if (m) return htmlDecode(m[1]).trim();
  // Fallback: description meta
  const m2 = html.match(/<meta name="description" content="([^"]+)"/);
  return m2 ? htmlDecode(m2[1]).trim() : '';
}

function readableDate(ymd) {
  // "2026-04-22" -> "April 22, 2026"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map(Number);
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[m-1]} ${d}, ${y}`;
}

/* ---------- post rewriting ---------- */

function rewritePostTags(html, tagToSlug) {
  // span -> anchor. Also normalize existing anchors (in case slug map changed).
  return html.replace(
    /<(span|a)\s+class="dink-headline-tag"(?:\s+href="[^"]*")?>([^<]+)<\/(?:span|a)>/g,
    (_full, _tagName, inner) => {
      const text = inner;
      const decoded = htmlDecode(text).trim();
      const slug = tagToSlug.get(decoded.toLowerCase()) || slugify(decoded);
      return `<a class="dink-headline-tag" href="../tag/${slug}.html">${text}</a>`;
    }
  );
}

function ensureTagCssRules(html) {
  // Find the .dink-headline-tag rule block and make sure it has
  // text-decoration: none so anchors render like the original pills.
  // Also append a :hover rule once.
  const CSS_PATCH_MARKER = '/* fitk-tag-link-patch */';
  if (html.includes(CSS_PATCH_MARKER)) return html;

  // Append to the existing rule body - safer than regex replacement.
  const ruleRe = /(\.dink-headline-tag\s*\{[^}]*)(\})/;
  if (!ruleRe.test(html)) return html;

  html = html.replace(ruleRe, (_m, body, close) => {
    const needsTD = !/text-decoration\s*:/i.test(body);
    const addition = `${needsTD ? '      text-decoration: none;\n' : ''}      transition: background 0.15s ease;\n    `;
    return `${body}${addition}${close}`;
  });

  // Append hover + marker immediately after the .dink-headline-tag rule.
  html = html.replace(
    /(\.dink-headline-tag\s*\{[^}]*\})/,
    `$1\n    .dink-headline-tag:hover { background: #e0e3e8; color: #0a1d3c; }\n    ${CSS_PATCH_MARKER}`
  );

  return html;
}

function injectKeywordsIntoJsonLd(html, tags) {
  // Insert "keywords" into the NewsArticle JSON-LD block, right after
  // "headline". Idempotent - replaces an existing keywords line if present.
  const keywords = tags.map(t => htmlDecode(t)).filter(Boolean);
  if (!keywords.length) return html;
  const kwJson = JSON.stringify(keywords.join(', '));

  // Find JSON-LD script blocks that declare @type: NewsArticle
  return html.replace(
    /(<script type="application\/ld\+json">\s*)([\s\S]*?)(\s*<\/script>)/g,
    (full, open, body, close) => {
      if (!/"@type"\s*:\s*"NewsArticle"/.test(body)) return full;

      let newBody = body;
      if (/"keywords"\s*:/.test(newBody)) {
        // Replace existing keywords line
        newBody = newBody.replace(
          /"keywords"\s*:\s*(?:"[^"]*"|\[[^\]]*\])\s*,?/,
          `"keywords": ${kwJson},`
        );
      } else {
        // Insert after "headline": "..." line
        newBody = newBody.replace(
          /("headline"\s*:\s*"[^"]*"\s*,)/,
          `$1\n    "keywords": ${kwJson},`
        );
      }
      return open + newBody + close;
    }
  );
}

function processPost(post, tagToSlug) {
  const original = fs.readFileSync(post.file, 'utf8');
  const tags = extractTagsFromHtml(original);
  post.tags = tags;
  post.title = extractTitle(original);
  post.date = extractDate(original);
  post.dek = extractDek(original);

  if (!tags.length) return false;

  let updated = original;
  updated = rewritePostTags(updated, tagToSlug);
  updated = ensureTagCssRules(updated);
  updated = injectKeywordsIntoJsonLd(updated, tags);

  if (updated !== original) {
    fs.writeFileSync(post.file, updated);
    return true;
  }
  return false;
}

/* ---------- tag archive page rendering ---------- */

function buildTagIndex(posts) {
  // Map slug -> { displayName, posts: [{post, ...}] }
  const tagIndex = new Map();
  for (const post of posts) {
    if (!post.tags) continue;
    for (const tag of post.tags) {
      const slug = slugify(tag);
      if (!slug) continue;
      if (!tagIndex.has(slug)) {
        tagIndex.set(slug, { slug, displayName: tag, posts: [] });
      } else {
        // Stick with the earliest-seen case variant for consistency.
        // (No-op.)
      }
      tagIndex.get(slug).posts.push(post);
    }
  }
  // Sort each tag's posts newest-first.
  for (const entry of tagIndex.values()) {
    entry.posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  return tagIndex;
}

function renderPostCard(post, opts = {}) {
  // Link from /news/tag/{slug}.html -> /news/{category}/{file}.html is "../{rel}"
  const href = opts.fromTagPage
    ? `../${post.rel}`
    : `${post.rel}`;
  const catLabel = CATEGORY_LABEL[post.category] || post.category;
  const placeholder = CATEGORY_PLACEHOLDER[post.category] || catLabel.toUpperCase();
  const dateReadable = readableDate(post.date);
  const title = post.title || catLabel;
  const excerpt = post.dek || '';
  const dateSuffix = post.category === 'daily-dink' && dateReadable
    ? ` | <span style="font-size:0.6em; letter-spacing:0.05em;">${htmlEscape(dateReadable)}</span>`
    : '';
  return `      <a href="${href}" class="news-card" data-category="${post.category}">
        <div class="news-card-image">
          <div class="news-card-image-placeholder">${placeholder}${dateSuffix}</div>
        </div>
        <div class="news-card-body">
          <div class="news-card-meta">
            <span class="news-card-category">${htmlEscape(catLabel)}</span>
          </div>
          <h3 class="news-card-title">${htmlEscape(title)}</h3>
          <p class="news-card-excerpt">${htmlEscape(excerpt)}</p>
          <span class="news-card-readmore">Read More &rarr;</span>
        </div>
      </a>`;
}

function renderTagPage(tagEntry) {
  const { displayName, slug, posts } = tagEntry;
  const displaySafe = htmlEscape(displayName);
  const displayAttr = attrEscape(displayName);
  const count = posts.length;
  const url = `${SITE}/news/tag/${slug}.html`;
  const cards = posts.map(p => renderPostCard(p, { fromTagPage: true })).join('\n\n');

  const description = `Every FITK Daily Dink, Weekly Drive, and Monthly ATP story tagged ${displayName}. ${count} post${count === 1 ? '' : 's'} from Faith in the Kitchen's pickleball news desk.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1322528483075450');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1322528483075450&ev=PageView&noscript=1"
  /></noscript>
  <!-- End Meta Pixel Code -->
  <title>${displaySafe} | FITK News Archive</title>
  <meta name="description" content="${attrEscape(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:title" content="${displayAttr} | FITK News Archive">
  <meta property="og:description" content="${attrEscape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/images/new_flagship.png">
  <meta property="og:site_name" content="Faith in the Kitchen">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${displayAttr} | FITK News Archive">
  <meta name="twitter:description" content="${attrEscape(description)}">
  <meta name="twitter:image" content="${SITE}/images/new_flagship.png">
  <link rel="icon" type="image/png" href="../../images/logos/icon.png" media="(prefers-color-scheme: light)">
  <link rel="icon" type="image/png" href="../../images/logos/icon-dark.png" media="(prefers-color-scheme: dark)">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Caveat:wght@600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../styles.css">
  <script defer src="https://cdn.vercel-insights.com/v1/script.js"></script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "FITK News - ${displaySafe}",
    "description": ${JSON.stringify(description)},
    "url": "${url}",
    "about": ${JSON.stringify(displayName)},
    "keywords": ${JSON.stringify(displayName)},
    "isPartOf": {
      "@type": "WebSite",
      "name": "Faith in the Kitchen",
      "url": "${SITE}/"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Faith in the Kitchen",
      "url": "${SITE}/",
      "logo": "${SITE}/images/logos/FIK_Logo_Primary_CR.png"
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": ${count},
      "itemListElement": [
${posts.map((p, i) => `        {
          "@type": "ListItem",
          "position": ${i + 1},
          "url": "${SITE}/news/${p.rel}",
          "name": ${JSON.stringify(p.title || '')}
        }`).join(',\n')}
      ]
    }
  }
  </script>
</head>
<body>
  <!-- Announcement Bar -->
  <div class="announcement-bar">
    <div class="announcement-marquee">
      <span>FREE SHIPPING ON ORDERS $75+</span><span>FREE SHIPPING ON ORDERS $75+</span>
    </div>
  </div>

  <!-- Search Overlay -->
  <div class="search-overlay" id="search-overlay">
    <input type="text" placeholder="Search products..." id="search-input" onkeydown="if(event.key==='Enter'){window.location='../../shop.html';}" onfocusout="setTimeout(()=>document.getElementById('search-overlay').classList.remove('open'),200)">
  </div>

  <!-- Header -->
  <header>
    <div class="header-container">
      <a href="../../index.html" class="logo-link">
        <img src="../../images/logos/2026-02-11_FIK-Logo-Icon.png" alt="Faith in the Kitchen" class="logo">
      </a>
      <button class="mobile-menu-toggle" aria-label="Menu" onclick="toggleMobileMenu()">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <nav class="nav">
        <a href="../../shop.html">Shop</a>
        <a href="../../mission.html">Mission</a>
        <a href="../index.html">News</a>
        <a href="../../contact.html">Contact</a>
      </nav>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <div class="search-icon" onclick="toggleSearch()" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <div class="cart-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
        </div>
      </div>
    </div>
  </header>

  <h1 class="sr-only">FITK News tagged ${displaySafe}</h1>

  <!-- Tag Hero -->
  <section class="news-hero">
    <div class="news-hero-inner">
      <p class="news-hero-label">
        <a href="../index.html" style="color:#C8963E;text-decoration:none;">FITK News</a>
        <span style="color:#999;">&nbsp;/&nbsp;</span>
        <a href="./index.html" style="color:#C8963E;text-decoration:none;">All Tags</a>
      </p>
      <h2 class="news-hero-title">${displaySafe}</h2>
      <p class="news-hero-subtitle">${count} ${count === 1 ? 'story' : 'stories'} tagged ${displaySafe} across Daily Dink, Weekly Drive, and Monthly ATP.</p>
    </div>
  </section>

  <!-- Archive Grid -->
  <section class="news-archive">
    <div class="news-grid" id="news-grid">
${cards}
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-container">
      <div class="footer-grid">
        <div class="footer-column footer-signup-col">
          <h3>The Daily Dink</h3>
          <p>Pickleball news delivered to your inbox every morning. Free.</p>
          <form id="dink-subscribe-form" class="footer-signup-form" onsubmit="handleDinkSubscribe(event)" novalidate>
            <input type="text" id="dink-first-name" name="first_name" placeholder="First Name (optional)" autocomplete="given-name" style="margin-bottom:8px;">
            <input type="email" id="dink-email" name="email" placeholder="Email Address..." required autocomplete="email">
            <button type="submit" class="btn btn-primary" id="dink-submit-btn">Subscribe Free</button>
          </form>
          <p id="dink-signup-message" style="display:none;font-size:13px;color:#555;margin-top:10px;line-height:1.5;"></p>
        </div>
        <div class="footer-column">
          <h3>Shop</h3>
          <ul>
            <li><a href="../../shop.html">All Products</a></li>
            <li><a href="../../shop.html?filter=tees">Tees</a></li>
            <li><a href="../../shop.html?filter=hoodies">Hoodies</a></li>
          </ul>
        </div>
        <div class="footer-column">
          <h3>Company</h3>
          <ul>
            <li><a href="../../mission.html">Our Mission</a></li>
            <li><a href="../index.html">News</a></li>
            <li><a href="../../contact.html">Contact Us</a></li>
            <li><a href="../../returns.html">Returns & Exchanges</a></li>
          </ul>
        </div>
        <div class="footer-column">
          <h3>Connect</h3>
          <div class="footer-social">
            <a href="https://instagram.com/faithinthekitchenpb" target="_blank" rel="noopener noreferrer" class="social-icon" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z"/></svg>
            </a>
            <a href="mailto:hello@faithinthekitchen.com" class="social-icon" aria-label="Email">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            </a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <a href="../../index.html"><img src="../../images/logos/FIK_Logo_Primary_CR.png" alt="Faith in the Kitchen" class="footer-logo"></a>
        <p class="footer-copyright">&copy; 2026 FAITH IN THE KITCHEN. ALL RIGHTS RESERVED.</p>
      </div>
    </div>
  </footer>

  <script src="../../products.js"></script>
  <script src="../../cart.js"></script>
  <script>
    function toggleMobileMenu() {
      const toggle = document.querySelector('.mobile-menu-toggle');
      const nav = document.querySelector('.nav');
      toggle.classList.toggle('active');
      nav.classList.toggle('active');
    }
    function toggleSearch() {
      const overlay = document.getElementById('search-overlay');
      overlay.classList.toggle('open');
      if (overlay.classList.contains('open')) document.getElementById('search-input').focus();
    }
    async function handleDinkSubscribe(event) {
      event.preventDefault();
      const emailEl = document.getElementById('dink-email');
      const nameEl = document.getElementById('dink-first-name');
      const msgEl = document.getElementById('dink-signup-message');
      const btn = document.getElementById('dink-submit-btn');
      const email = (emailEl.value || '').trim();
      const firstName = (nameEl.value || '').trim();
      if (!email || !/.+@.+\\..+/.test(email)) {
        msgEl.style.display = 'block';
        msgEl.textContent = 'Please enter a valid email address.';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Subscribing...';
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, first_name: firstName, source: 'tag-page' })
        });
        if (res.ok) {
          msgEl.style.display = 'block';
          msgEl.textContent = 'Subscribed. Watch for the next Daily Dink in your inbox.';
          emailEl.value = ''; nameEl.value = '';
        } else {
          msgEl.style.display = 'block';
          msgEl.textContent = 'Something went wrong. Please try again.';
        }
      } catch (e) {
        msgEl.style.display = 'block';
        msgEl.textContent = 'Network error. Please try again.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Subscribe Free';
      }
    }
  </script>
</body>
</html>
`;
}

function renderTagIndexPage(tagIndex) {
  const entries = Array.from(tagIndex.values())
    .sort((a, b) => b.posts.length - a.posts.length || a.displayName.localeCompare(b.displayName));
  const total = entries.length;

  const pills = entries.map(e => {
    const size = Math.min(1.3, 0.82 + e.posts.length * 0.08);
    return `      <a href="./${e.slug}.html" class="tag-cloud-pill" style="font-size:${size}rem;">${htmlEscape(e.displayName)} <span class="tag-cloud-count">${e.posts.length}</span></a>`;
  }).join('\n');

  const description = `Every tag across FITK's pickleball news coverage. Browse ${total} topics from Daily Dink, Weekly Drive, and Monthly ATP.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Tags | FITK News Archive</title>
  <meta name="description" content="${attrEscape(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${SITE}/news/tag/">
  <meta property="og:title" content="All Tags | FITK News Archive">
  <meta property="og:description" content="${attrEscape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE}/news/tag/">
  <meta property="og:image" content="${SITE}/images/new_flagship.png">
  <link rel="icon" type="image/png" href="../../images/logos/icon.png" media="(prefers-color-scheme: light)">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Caveat:wght@600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../styles.css">
  <style>
    .tag-cloud {
      max-width: 960px;
      margin: 2rem auto 4rem;
      padding: 0 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      justify-content: center;
      align-items: baseline;
    }
    .tag-cloud-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      letter-spacing: 0.02em;
      background: #f0f2f5;
      color: #0a1d3c;
      padding: 0.45rem 0.95rem;
      border-radius: 999px;
      text-decoration: none;
      text-transform: uppercase;
      transition: background 0.15s ease;
    }
    .tag-cloud-pill:hover { background: #e0e3e8; }
    .tag-cloud-count {
      font-size: 0.7em;
      background: #C8963E;
      color: #fff;
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
    }
  </style>
</head>
<body>
  <div class="announcement-bar">
    <div class="announcement-marquee">
      <span>FREE SHIPPING ON ORDERS $75+</span><span>FREE SHIPPING ON ORDERS $75+</span>
    </div>
  </div>

  <header>
    <div class="header-container">
      <a href="../../index.html" class="logo-link">
        <img src="../../images/logos/2026-02-11_FIK-Logo-Icon.png" alt="Faith in the Kitchen" class="logo">
      </a>
      <button class="mobile-menu-toggle" aria-label="Menu" onclick="toggleMobileMenu()">
        <span></span><span></span><span></span>
      </button>
      <nav class="nav">
        <a href="../../shop.html">Shop</a>
        <a href="../../mission.html">Mission</a>
        <a href="../index.html">News</a>
        <a href="../../contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <h1 class="sr-only">All FITK News Tags</h1>

  <section class="news-hero">
    <div class="news-hero-inner">
      <p class="news-hero-label"><a href="../index.html" style="color:#C8963E;text-decoration:none;">FITK News</a></p>
      <h2 class="news-hero-title">All Tags</h2>
      <p class="news-hero-subtitle">Every topic, player, and brand we've covered. ${total} tag${total === 1 ? '' : 's'} across ${Array.from(new Set(Array.from(tagIndex.values()).flatMap(e => e.posts.map(p => p.rel)))).length} posts.</p>
    </div>
  </section>

  <div class="tag-cloud">
${pills}
  </div>

  <footer>
    <div class="footer-container">
      <div class="footer-bottom">
        <a href="../../index.html"><img src="../../images/logos/FIK_Logo_Primary_CR.png" alt="Faith in the Kitchen" class="footer-logo"></a>
        <p class="footer-copyright">&copy; 2026 FAITH IN THE KITCHEN. ALL RIGHTS RESERVED.</p>
      </div>
    </div>
  </footer>

  <script>
    function toggleMobileMenu() {
      const toggle = document.querySelector('.mobile-menu-toggle');
      const nav = document.querySelector('.nav');
      toggle.classList.toggle('active');
      nav.classList.toggle('active');
    }
  </script>
</body>
</html>
`;
}

/* ---------- main ---------- */

function main() {
  if (!fs.existsSync(NEWS_DIR)) {
    console.error(`News directory not found: ${NEWS_DIR}`);
    process.exit(1);
  }

  const posts = discoverPosts();
  console.log(`Scanning ${posts.length} news posts for tags...`);

  // First pass: extract tags and build slug map
  for (const post of posts) {
    const html = fs.readFileSync(post.file, 'utf8');
    post.tags = extractTagsFromHtml(html);
    post.title = extractTitle(html);
    post.date = extractDate(html);
    post.dek = extractDek(html);
  }

  // Tag-text to slug map. Case-insensitive: "JOOLA" and "Joola" -> same slug.
  const tagToSlug = new Map();
  for (const post of posts) {
    for (const t of post.tags) {
      const key = t.toLowerCase();
      if (!tagToSlug.has(key)) tagToSlug.set(key, slugify(t));
    }
  }

  // Second pass: rewrite each post
  let changed = 0;
  for (const post of posts) {
    const original = fs.readFileSync(post.file, 'utf8');
    let updated = original;
    updated = rewritePostTags(updated, tagToSlug);
    updated = ensureTagCssRules(updated);
    updated = injectKeywordsIntoJsonLd(updated, post.tags);
    if (updated !== original) {
      fs.writeFileSync(post.file, updated);
      changed += 1;
    }
  }
  console.log(`Rewrote ${changed} post(s) with linked tags + keyword JSON-LD.`);

  // Third pass: build tag archive pages
  const tagIndex = buildTagIndex(posts);
  console.log(`Found ${tagIndex.size} unique tags.`);

  // Clear out /news/tag/ and rewrite - safer than incremental updates.
  if (fs.existsSync(TAG_DIR)) {
    for (const f of fs.readdirSync(TAG_DIR)) {
      if (f.endsWith('.html')) fs.unlinkSync(path.join(TAG_DIR, f));
    }
  } else {
    fs.mkdirSync(TAG_DIR, { recursive: true });
  }

  for (const entry of tagIndex.values()) {
    const out = path.join(TAG_DIR, `${entry.slug}.html`);
    fs.writeFileSync(out, renderTagPage(entry));
  }
  console.log(`Wrote ${tagIndex.size} tag pages to ${TAG_DIR}`);

  // Tag index (all tags hub)
  fs.writeFileSync(
    path.join(TAG_DIR, 'index.html'),
    renderTagIndexPage(tagIndex)
  );
  console.log(`Wrote tag hub at ${path.join(TAG_DIR, 'index.html')}`);
}

main();
