#!/usr/bin/env node
/**
 * FITK sitemap generator
 *
 * Produces sitemap.xml by combining a hardcoded list of core pages with
 * every HTML file discovered under /news/ (excluding templates and index).
 *
 * Runs at Vercel build time via build.sh so new Daily Dink / Weekly Drive /
 * Monthly ATP posts land in the sitemap automatically on deploy.
 *
 * Usage:
 *   node generate-sitemap.js
 *
 * Output:
 *   ./sitemap.xml (overwritten in place)
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://faithinthekitchen.com';
const ROOT = __dirname;
const NEWS_DIR = path.join(ROOT, 'news');
const OUT = path.join(ROOT, 'sitemap.xml');

// Core pages that don't live under /news/. Keep in sync with the routing tree.
const CORE_PAGES = [
  { loc: '/',               priority: '1.0', changefreq: 'weekly'  },
  { loc: '/shop.html',      priority: '0.9', changefreq: 'weekly'  },
  { loc: '/product.html?id=dinkp',  priority: '0.8', changefreq: 'monthly' },
  { loc: '/product.html?id=servp',  priority: '0.8', changefreq: 'monthly' },
  { loc: '/product.html?id=sgsg',   priority: '0.8', changefreq: 'monthly' },
  { loc: '/product.html?id=4glory', priority: '0.8', changefreq: 'monthly' },
  { loc: '/product.html?id=drop',   priority: '0.8', changefreq: 'monthly' },
  { loc: '/product.html?id=hoodie', priority: '0.8', changefreq: 'monthly' },
  { loc: '/mission.html',   priority: '0.7', changefreq: 'monthly' },
  { loc: '/contact.html',   priority: '0.5', changefreq: 'monthly' },
  { loc: '/news/',          priority: '0.8', changefreq: 'daily'   },
];

// Files inside /news/ that should NOT be indexed (templates, stubs).
// Top-level /news/index.html is the hub, already added via CORE_PAGES.
// Nested index.html files (e.g. /news/tag/index.html tag cloud) ARE indexed.
const NEWS_EXCLUDE_BASENAMES = new Set(['_post-template.html']);
const NEWS_EXCLUDE_PATHS = new Set(['index.html']); // paths relative to /news/

function isoDate(mtime) {
  return mtime.toISOString().slice(0, 10);
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

function collectNewsPosts() {
  const posts = [];
  for (const file of walk(NEWS_DIR)) {
    const base = path.basename(file);
    const relFromNews = path.relative(NEWS_DIR, file).split(path.sep).join('/');
    // Skip basenames that are never indexable (templates).
    // Skip specific paths relative to /news/ (top-level news hub, covered by CORE_PAGES).
    // Underscore-prefixed files anywhere are treated as private.
    if (NEWS_EXCLUDE_BASENAMES.has(base)) continue;
    if (NEWS_EXCLUDE_PATHS.has(relFromNews)) continue;
    if (base.startsWith('_')) continue;

    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const stat = fs.statSync(file);

    posts.push({
      loc: '/' + rel,
      lastmod: isoDate(stat.mtime),
      priority: '0.7',
      changefreq: 'monthly',
    });
  }
  // Newest first so GSC picks up fresh content priority.
  posts.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  return posts;
}

function latestNewsDate(posts) {
  if (!posts.length) return isoDate(new Date());
  return posts[0].lastmod;
}

function buildXml() {
  const today = isoDate(new Date());
  const newsPosts = collectNewsPosts();
  const newsListDate = latestNewsDate(newsPosts);

  const urls = [];

  for (const page of CORE_PAGES) {
    // /news/ hub lastmod should track the newest post.
    const lastmod = page.loc === '/news/' ? newsListDate : today;
    urls.push({
      loc: SITE + page.loc,
      lastmod,
      changefreq: page.changefreq,
      priority: page.priority,
    });
  }

  for (const post of newsPosts) {
    urls.push({
      loc: SITE + post.loc,
      lastmod: post.lastmod,
      changefreq: post.changefreq,
      priority: post.priority,
    });
  }

  const body = urls.map(u => [
    '  <url>',
    `    <loc>${u.loc}</loc>`,
    `    <lastmod>${u.lastmod}</lastmod>`,
    `    <changefreq>${u.changefreq}</changefreq>`,
    `    <priority>${u.priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

function main() {
  const xml = buildXml();
  fs.writeFileSync(OUT, xml);
  const lines = xml.trim().split('\n').length;
  console.log(`Sitemap written to ${OUT} (${lines} lines)`);
}

main();
