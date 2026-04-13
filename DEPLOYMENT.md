# FITK Website Deployment Guide

## Overview
This is a static HTML website for Faith in the Kitchen (FITK), a faith-based pickleball apparel brand. The site is built with pure HTML, CSS, and vanilla JavaScript with no frameworks.

## File Structure
```
site/
├── index.html          # Homepage
├── shop.html           # Product catalog
├── product.html        # Product detail page (dynamic)
├── mission.html        # Mission/brand story
├── contact.html        # Contact form
├── styles.css          # Global styles
├── products.js         # Product data
└── DEPLOYMENT.md       # This file
```

## Key Features
- Responsive design (mobile-first, 90% mobile traffic)
- Nike-minimal aesthetic with dark backgrounds (#0A0A0A)
- Cream text (#FFFAF7) and muted green accents (#3D5A3D)
- Google Fonts: Oswald (headlines) and Montserrat (body)
- All 6 products with color/size selectors
- Scripture-driven design narratives
- Email signup form (Founder's List)
- Contact form
- Instagram integration link (@faithinthekitchenpb)

## Image Paths
The site references product mockup images from the parent FITK directory:
- Product mockups: `../First Drop/Mockups/`
- Logos: `../Main Logos/`

**IMPORTANT**: When deploying to Netlify, copy the mockup images into the site directory:
```bash
# From site/ directory
cp -r ../First\ Drop/Mockups/ ./assets/mockups/
cp -r ../Main\ Logos/ ./assets/logos/
```

Then update image paths in `products.js`:
```javascript
const MOCKUP_BASE = 'assets/mockups/';
const LOGO_BASE = 'assets/logos/';
```

## Deployment to Netlify

### Option 1: GitHub Integration (Recommended)
1. Push the site folder to GitHub
2. Connect GitHub repo to Netlify
3. Set build settings:
   - Build command: (leave blank for static site)
   - Publish directory: `site/`
4. Copy image assets as described above before deploying

### Option 2: Direct Upload
1. Copy the site folder and all assets to your web host
2. Ensure image paths are correctly resolved
3. Verify all pages load and product images display

### Option 3: Netlify CLI
```bash
cd site/
netlify deploy
```

## Configuration Notes

### Email Signup (Footer)
Currently a placeholder. To enable:
- Integrate with Mailchimp, ConvertKit, or similar service
- Update the form submission handler in `index.html`
- Add your API key/list ID

### Contact Form
Currently a placeholder that logs to console. To enable:
- Use Formspree (free, no backend needed)
  ```html
  <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
  ```
- Or use SendGrid, AWS SES, or similar

### Add to Cart / Shopify Integration
Currently uses placeholder JavaScript. To enable:
- Install Shopify Buy Button SDK
- Get product IDs from your Shopify store
- Wire up buy buttons in `product.html`
```javascript
ShopifyBuy.ui.ProductSet({
  id: [SHOPIFY_PRODUCT_IDS],
  options: { ... }
}).mount('#product-cart');
```

See: https://shopify.dev/docs/api/admin-rest/2024-01/resources/product

## Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
  --color-bg-primary: #0A0A0A;      /* Dark background */
  --color-text-heading: #FFFAF7;    /* Cream headings */
  --color-accent: #3D5A3D;          /* Green accent */
  /* ... */
}
```

### Typography
- Headlines: Oswald (Google Fonts, 700 weight)
- Body: Montserrat (Google Fonts, 400/500/600)
- Both are imported in each HTML file

### Product Data
Edit `products.js` to add/remove products or update descriptions, prices, scriptures, and images.

## Performance Notes
- All CSS is inline or in a single styles.css file
- Minimal JavaScript (no frameworks)
- Product data loaded via simple JS object
- Images are the largest assets - optimize mockups before deploying
- Smooth scroll behavior enabled for better UX

## Browser Support
- Modern browsers (Chrome, Safari, Firefox, Edge)
- Mobile-responsive down to 320px width
- CSS Grid and Flexbox supported

## Important Reminders

1. **No Em Dashes**: All copy uses regular hyphens, not em dashes (--) or en dashes (-)
2. **Mobile-First**: Test on iPhone/Android before launch
3. **Scripture is Key**: Don't remove or downplay the scripture references
4. **Product Descriptions**: Kacie's copy is intentional and premium - keep it intact
5. **Font Loading**: Google Fonts are loaded via CDN - ensure stable internet for development

## Next Steps After Deployment

1. Test all pages on mobile and desktop
2. Verify product images load correctly
3. Set up email signup service
4. Wire up Shopify checkout
5. Set up contact form service
6. Add analytics (Google Analytics, Plausible, etc.)
7. Set up SSL certificate (Netlify provides free HTTPS)
8. Submit to Google Search Console
9. Optimize images for web (consider WebP format)

## Support
For questions about the code or design, refer to the briefing document and design system specifications.
