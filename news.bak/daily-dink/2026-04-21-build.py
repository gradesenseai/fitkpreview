#!/usr/bin/env python3
"""Build FITK Daily Dink 2026-04-21 from the 2026-04-20 canonical template."""
import re, json, os, sys, html

TEMPLATE = "/sessions/zealous-loving-hawking/mnt/FITK/site/fitkpreview/news/daily-dink/2026-04-20.html"
OUT_HTML = "/sessions/zealous-loving-hawking/mnt/outputs/2026-04-21.html"
OUT_JSON = "/sessions/zealous-loving-hawking/mnt/outputs/2026-04-21-payload.json"

SLUG = "2026-04-21"
POST_TITLE = "FITK Daily Dink - April 21, 2026"
PRETTY_DATE = "April 21, 2026"
ISO_DATE = "2026-04-21"

DEK = (
    "Some of the top stories moving in pro pickleball today, from USA Pickleball "
    "and Boys and Girls Clubs of America launching a $100,000 national youth partnership "
    "and the PPA Tour laying out a two-tier global ladder through its new Asia circuit, "
    "to Championship Sunday fallout from the Sacramento Open where Eric Oncins won his first "
    "mixed doubles gold and Hunter Johnson was disqualified for a paddle throw, "
    "plus a feature on the backyard origin story behind Six Zero paddles."
)

HEADLINES = [
    {
        "title": "USA Pickleball and Boys and Girls Clubs of America launch national youth pickleball partnership",
        "tags": ["USA Pickleball", "Boys and Girls Clubs", "Youth Pickleball", "Grassroots", "Community"],
        "summary": (
            "USA Pickleball announced a multi-year partnership with Boys and Girls Clubs of America, "
            "seeded with a $100,000 initial investment plus Franklin paddles, balls, and nets for more "
            "than 5,500 Club locations nationwide. The program launches in Arizona with 75 Clubs serving "
            "an estimated 50,000 youth, and includes at least one newly installed court each year to "
            "expand access for kids who might not otherwise get on a court."
        ),
        "url": "https://www.bgca.org/news-stories/2026/April/usa-pickleball-and-boys-girls-clubs-of-america-announce-national-partnership-to-grow-youth-access-to-pickleball/",
        "source_label": "Boys and Girls Clubs of America",
    },
    {
        "title": "The PPA is building two different tours, and Asia is where it is testing the future",
        "tags": ["PPA Tour", "PPA Tour Asia", "Global Rankings", "Tour Development", "Industry"],
        "summary": (
            "World Pickleball Magazine details the PPA Tour's emerging two-track structure, with its new "
            "Asia circuit functioning as a proving ground for a unified global ranking system and a "
            "multi-tier event ladder running from 125 up to 2000 points. Chris Beaumont frames it as a "
            "meaningful shift from a single dominant North American tour toward a layered international "
            "pathway that lets regional players climb toward the biggest stages."
        ),
        "url": "https://worldpickleballmagazine.com/news/ppa-asia-pathway-development-structure/",
        "source_label": "World Pickleball Magazine",
    },
    {
        "title": "Sacramento Open recap: Eric Oncins wins first mixed gold as Hunter Johnson is disqualified for paddle throw",
        "tags": ["PPA Tour", "Sacramento Open", "Eric Oncins", "Hunter Johnson", "Pro Pickleball"],
        "summary": (
            "New Kitchen writer Chris Cali, arriving from the Sorry Not Sorry show, recaps a chaotic "
            "Championship Sunday in Sacramento where Eric Oncins won his first mixed doubles gold with "
            "Tyra Black and drew scrutiny for a controversial over the net finish, while Hunter Johnson "
            "was disqualified in the men's doubles medal round after throwing his paddle. Cali walks "
            "through every gold, silver, and bronze result on the PPA slate."
        ),
        "url": "https://thekitchenpickle.com/blogs/news/ppa-tour-sacramento-open-2026-recap-pro-pickleball-chris-cali",
        "source_label": "The Kitchen",
    },
    {
        "title": "The Six Zero story, from backyard prototypes in Australia to the future of pickleball paddles",
        "tags": ["Six Zero", "Paddles", "Gear", "Thermoforming", "Industry"],
        "summary": (
            "Pickleball.com traces how Dale Young and his father Bruce built Six Zero in a backyard "
            "workshop outside Melbourne, iterating through more than 100 prototypes before landing on "
            "the Carbon Fusion Edge Technology that powers today's Black Diamond and Double Black Diamond "
            "paddles. The feature frames Six Zero as a driving force behind the Gen 2 thermoforming wave "
            "that now defines the top end of the paddle market."
        ),
        "url": "https://pickleball.com/industry/the-six-zero-story-from-backyard-prototypes-to-the-future-of-pickleball",
        "source_label": "Pickleball.com",
    },
]

# Em / en dash guard
BAD = ["\u2014", "\u2013"]
def check_dashes(text, label):
    for ch in BAD:
        if ch in text:
            raise ValueError(f"{label} contains em/en dash: {text!r}")

check_dashes(DEK, "dek")
for h in HEADLINES:
    check_dashes(h["title"], "title")
    check_dashes(h["summary"], "summary")
    for t in h["tags"]:
        check_dashes(t, "tag")

def esc_attr(s):
    return html.escape(s, quote=True)

def esc_text(s):
    # Preserve apostrophes as &#x27; to match canonical style
    return html.escape(s, quote=True).replace("&#x27;", "&#x27;")

# Build the headline items HTML, matching canonical structure
def build_items():
    out = []
    for h in HEADLINES:
        tag_html = "".join(
            f'<span class="dink-headline-tag">{esc_text(t)}</span>' for t in h["tags"]
        )
        out.append(
            '        <li class="dink-headline-item">\n'
            f'          <h2 class="dink-headline-title">{esc_text(h["title"])}</h2>\n'
            f'          <div class="dink-headline-tags">{tag_html}</div>\n'
            f'          <p class="dink-headline-summary">{esc_text(h["summary"])}</p>\n'
            f'          <a class="dink-headline-source" href="{esc_attr(h["url"])}" target="_blank" rel="noopener noreferrer">Read at {esc_text(h["source_label"])} &rarr;</a>\n'
            '        </li>'
        )
    return "\n".join(out)

with open(TEMPLATE, "r", encoding="utf-8") as f:
    src = f.read()

# ---- Head replacements ----
# Title
src = src.replace(
    "<title>FITK Daily Dink - April 20, 2026 | FITK News</title>",
    f"<title>FITK Daily Dink - April 21, 2026 | FITK News</title>",
)

# Escaped dek for meta attrs (HTML entity apostrophes)
dek_attr = html.escape(DEK, quote=True)
# The canonical uses &#x27; for apostrophes in attrs; html.escape uses &#x27; when quote=True
# html.escape default uses &quot; for " and &#x27; for '
# Confirmed: html.escape("don't", quote=True) -> "don&#x27;t"

# description meta
src = re.sub(
    r'<meta name="description" content="[^"]*">',
    f'<meta name="description" content="{dek_attr}">',
    src,
    count=1,
)

# canonical
src = src.replace(
    'href="https://faithinthekitchen.com/news/daily-dink/2026-04-20.html"',
    'href="https://faithinthekitchen.com/news/daily-dink/2026-04-21.html"',
)
# og:title
src = re.sub(
    r'<meta property="og:title" content="[^"]*">',
    f'<meta property="og:title" content="{POST_TITLE}">',
    src,
    count=1,
)
# og:description
src = re.sub(
    r'<meta property="og:description" content="[^"]*">',
    f'<meta property="og:description" content="{dek_attr}">',
    src,
    count=1,
)
# og:url
src = src.replace(
    'content="https://faithinthekitchen.com/news/daily-dink/2026-04-20.html"',
    'content="https://faithinthekitchen.com/news/daily-dink/2026-04-21.html"',
)
# twitter:title
src = re.sub(
    r'<meta name="twitter:title" content="[^"]*">',
    f'<meta name="twitter:title" content="{POST_TITLE}">',
    src,
    count=1,
)
# twitter:description
src = re.sub(
    r'<meta name="twitter:description" content="[^"]*">',
    f'<meta name="twitter:description" content="{dek_attr}">',
    src,
    count=1,
)
# article:published_time
src = src.replace(
    'content="2026-04-20">',
    f'content="{ISO_DATE}">',
)

# ---- JSON-LD NewsArticle (first block) ----
# Update headline, description, datePublished, dateModified, mainEntityOfPage @id
src = src.replace(
    '"headline": "FITK Daily Dink - April 20, 2026"',
    f'"headline": "{POST_TITLE}"',
)
# description string in JSON — the canonical uses literal apostrophes inside JSON string
# (not &#x27; — inside JSON-LD script it's raw text)
src = re.sub(
    r'"description":\s*"Some of the top stories moving in pro pickleball today[^"]*"',
    f'"description": {json.dumps(DEK, ensure_ascii=False)}',
    src,
    count=1,
)
src = src.replace(
    '"datePublished": "2026-04-20"',
    f'"datePublished": "{ISO_DATE}"',
)
src = src.replace(
    '"dateModified": "2026-04-20"',
    f'"dateModified": "{ISO_DATE}"',
)
# mainEntityOfPage @id
src = src.replace(
    '"@id": "https://faithinthekitchen.com/news/daily-dink/2026-04-20.html"',
    f'"@id": "https://faithinthekitchen.com/news/daily-dink/{SLUG}.html"',
)

# ---- Second JSON-LD (Article schema near bottom of head) ----
# It contains "2026-04-18" references — update to 2026-04-21
src = src.replace(
    '"headline": "FITK Daily Dink - April 18, 2026"',
    f'"headline": "{POST_TITLE}"',
)
src = src.replace(
    '"datePublished": "2026-04-18"',
    f'"datePublished": "{ISO_DATE}"',
)
src = src.replace(
    '"dateModified": "2026-04-18"',
    f'"dateModified": "{ISO_DATE}"',
)
src = src.replace(
    '"@id": "https://faithinthekitchen.com/news/daily-dink/2026-04-18.html"',
    f'"@id": "https://faithinthekitchen.com/news/daily-dink/{SLUG}.html"',
)
src = src.replace(
    '"url": "https://faithinthekitchen.com/news/daily-dink/2026-04-18.html"',
    f'"url": "https://faithinthekitchen.com/news/daily-dink/{SLUG}.html"',
)

# ---- Article body ----
# news-post-date
src = re.sub(
    r'<span class="news-post-date">April 20, 2026</span>',
    f'<span class="news-post-date">{PRETTY_DATE}</span>',
    src,
    count=1,
)
# news-post-title h1
src = src.replace(
    '<h1 class="news-post-title">FITK Daily Dink - April 20, 2026</h1>',
    f'<h1 class="news-post-title">{POST_TITLE}</h1>',
)
# news-post-dek
src = re.sub(
    r'<p class="news-post-dek"><em>[^<]*</em></p>',
    f'<p class="news-post-dek"><em>{dek_attr}</em></p>',
    src,
    count=1,
)

# ---- Replace the <ul class="dink-headlines"> block ----
items_html = build_items()
new_ul = f'<ul class="dink-headlines">\n{items_html}\n        </ul>'
# Find old ul and swap. Using a regex across the block.
src, n = re.subn(
    r'<ul class="dink-headlines">[\s\S]*?</ul>',
    new_ul,
    src,
    count=1,
)
if n != 1:
    raise SystemExit("Failed to locate and replace dink-headlines block")

# Write the new HTML to outputs
with open(OUT_HTML, "w", encoding="utf-8") as f:
    f.write(src)

# ---- Build card_html ----
CARD_HTML = (
    '<a class="news-card" href="daily-dink/2026-04-21.html" data-filter="daily-dink">\n'
    '  <div class="news-card-meta">\n'
    '    <span class="news-card-category">Daily Dink</span>\n'
    '    <span class="news-card-date">April 21, 2026</span>\n'
    '  </div>\n'
    '  <h3 class="news-card-title">FITK Daily Dink - April 21, 2026</h3>\n'
    '  <p class="news-card-preview">'
    'USA Pickleball teams with Boys and Girls Clubs of America on a $100,000 national youth partnership, '
    'the PPA maps out its two-tier global tour through Asia, Eric Oncins wins mixed gold and Hunter Johnson is DQd in Sacramento, '
    'and the Six Zero backyard-origin story.'
    '</p>\n'
    '  <span class="news-card-link">Read The Dink &rarr;</span>\n'
    '</a>'
)

# ---- Build the payload ----
payload = {
    "slug": SLUG,
    "edition_date": ISO_DATE,
    "post_title": POST_TITLE,
    "dek": DEK,
    "post_html": src,
    "card_html": CARD_HTML,
    "headlines": [
        {
            "title": h["title"],
            "url": h["url"],
            "source": h["source_label"],
            "preview": h["summary"],
            "tags": h["tags"],
        }
        for h in HEADLINES
    ],
}

with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

# Integrity checks
checks = [
    (DEK.startswith("Some of the top stories moving in pro pickleball today"),
        "dek starts verbatim with the required opener"),
    ('href="daily-dink/2026-04-21.html"' in CARD_HTML,
        "card href uses nested daily-dink/ prefix"),
    ('&rarr;' in CARD_HTML and '&amp;rarr;' not in CARD_HTML,
        "card uses literal &rarr;"),
    ('&rarr;' in src and '&amp;rarr;' not in src,
        "post_html uses literal &rarr;"),
    (all(len(h["tags"]) == 5 for h in HEADLINES),
        "each headline has exactly 5 tags"),
    (all(isinstance(t, str) for h in HEADLINES for t in h["tags"]),
        "all tags are plain strings"),
    ("2026-04-20" not in src.replace("2026-04-20", "", 0),
        "template date should be replaced"),
]
for ok, msg in checks:
    print(("PASS" if ok else "FAIL"), msg)

# Emphasize any stale 2026-04-20 or 2026-04-18 references
stale_20 = src.count("2026-04-20")
stale_18 = src.count("2026-04-18")
stale_20_label = src.count("April 20, 2026")
stale_18_label = src.count("April 18, 2026")
print(f"Remaining refs: 2026-04-20 x{stale_20}, 2026-04-18 x{stale_18}, 'April 20, 2026' x{stale_20_label}, 'April 18, 2026' x{stale_18_label}")

# Check for any em/en dash in the article body (ignore inherited CSS comments from template)
# Extract only the <article> ... </article> region for the dash check
art_m = re.search(r'<article class="news-post">[\s\S]*?</article>', src)
art_body = art_m.group(0) if art_m else ""
for bad in ["\u2014", "\u2013"]:
    if bad in art_body:
        idx = art_body.find(bad)
        print(f"FAIL: found {bad!r} at offset {idx}: ...{art_body[max(0,idx-40):idx+40]!r}...")
        sys.exit(1)
print("PASS no em/en dash in article body")
print("post_html length:", len(src))
print("headlines count:", len(HEADLINES))
print("OK")
