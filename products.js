// Faith in the Kitchen - Product Data

// Base path for mockup images
const MOCKUP_BASE = 'images/mockups/';
const LOGO_BASE = 'images/logos/';

const products = [
  {
    id: 'dinkp',
    name: 'Dink with Purpose Tee',
    price: 35,
    category: 'tee',
    metaDescription: 'Dink with Purpose pickleball tee. Precision at the line, intention in every point. Scripture-embedded faith apparel built for competitive players.',
    altText: 'Dink with Purpose pickleball tee - faith-driven athletic apparel with hidden scripture',
    scripture: 'Colossians 3:23',
    scriptureText: 'Whatever you do, work at it with all your heart, as working for the Lord.',
    image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c55ae178453.png',
    frontImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c55ae178453.png',
    backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c55ae17c1da.png',
    colorways: [
      { name: 'Dark Grey Heather', code: 'heather-grey', image: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-front-69c55ae174abd.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-left-front-69c575768aa26.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-back-69c55ae17bf8a.png' },
      { name: 'Heather Olive', code: 'heather-olive', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c55ae178453.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-left-front-69c575768ac91.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c55ae17c1da.png' },
      { name: 'Heather Slate', code: 'heather-slate', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-front-69c55ae17720b.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-left-front-69c575768abe6.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-back-69c55ae17c129.png' },
      { name: 'Heather Mauve', code: 'heather-mauve', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-front-69c55ae175dfc.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-left-front-69c575768ab3b.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-back-69c55ae17c07b.png' },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    description: 'Precision at the line. Intention in every point. The front carries a clean, modern mark with a hidden scripture reference embedded in the design. The sleeve spells out the full slogan. Bold clarity to complement the minimal front. Part of the Founder\'s Drop. Built with intention.',
    details: {
      material: '52% combed and ring-spun cotton, 48% polyester',
      weight: '4.2 oz',
      care: 'Pre-shrunk, machine wash cold, gentle cycle, inside out. Do not bleach. Tumble dry low.',
      sizing: 'True to size. Fits unisex/standard.'
    }
  },
  {
    id: 'servp',
    name: 'Serve with Purpose Tee',
    price: 35,
    category: 'tee',
    metaDescription: 'Serve with Purpose pickleball tee. Scripture-embedded Christian athletic apparel for players who compete with conviction. Premium cotton-poly blend.',
    altText: 'Serve with Purpose pickleball tee - Christian athletic apparel with embedded scripture',
    scripture: '1 Peter 4:10',
    scriptureText: 'Each of you should use whatever gift you have received to serve others.',
    image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c5773e0a057.png',
    frontImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c5773e0a057.png',
    backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c5773e0ddbe.png',
    colorways: [
      { name: 'Dark Grey Heather', code: 'heather-grey', image: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-front-69c5773e06a8f.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-left-front-69c5773e042f9.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-back-69c5773e0db58.png' },
      { name: 'Heather Olive', code: 'heather-olive', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c5773e0a057.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-left-front-69c5773e04517.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c5773e0ddbe.png' },
      { name: 'Heather Slate', code: 'heather-slate', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-front-69c5773e08e02.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-left-front-69c5773e04467.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-back-69c5773e0dcf2.png' },
      { name: 'Heather Mauve', code: 'heather-mauve', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-front-69c5773e07d37.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-left-front-69c5773e043c6.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-back-69c5773e0dc41.png' },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    description: 'Every moment at the baseline is an act of conviction. A modern mark meets legacy typography, with an embedded scripture reference making every wear a silent declaration. Whether you\'re on the court or building community, this piece carries weight. Part of the Founder\'s Drop. Built with intention.',
    details: {
      material: '52% combed and ring-spun cotton, 48% polyester',
      weight: '4.2 oz',
      care: 'Pre-shrunk, machine wash cold, gentle cycle, inside out. Do not bleach. Tumble dry low.',
      sizing: 'True to size. Fits unisex/standard.'
    }
  },
  {
    id: 'sgsg',
    name: 'Soft Game Strong Faith Tee',
    price: 35,
    category: 'tee',
    metaDescription: 'Soft Game Strong Faith pickleball tee. Faith-based athletic wear for players who win rallies with finesse and matches with conviction. Built with intention.',
    altText: 'Soft Game Strong Faith pickleball tee - faith-based athletic wear for competitive players',
    scripture: '2 Corinthians 12:9',
    scriptureText: 'My grace is sufficient for you, for my power is made perfect in weakness.',
    image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c57954b333e.png',
    frontImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c57954b333e.png',
    backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c57954b6b2b.png',
    colorways: [
      { name: 'Dark Grey Heather', code: 'heather-grey', image: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-front-69c57954b0043.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-left-front-69c57954ade91.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-back-69c57954b6910.png' },
      { name: 'Heather Olive', code: 'heather-olive', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c57954b333e.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-left-front-69c57954ae0a5.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c57954b6b2b.png' },
      { name: 'Heather Slate', code: 'heather-slate', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-front-69c57954b234a.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-left-front-69c57954ae007.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-back-69c57954b6a85.png' },
      { name: 'Heather Mauve', code: 'heather-mauve', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-front-69c57954b1137.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-left-front-69c57954adf65.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-back-69c57954b69d9.png' },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    description: 'The soft game wins rallies. But only faith wins the match. This design captures the tension between finesse and conviction. The player who controls the net while standing firm in something deeper. Understated front. Bold statement on the back. Part of the Founder\'s Drop. Built with intention.',
    details: {
      material: '52% combed and ring-spun cotton, 48% polyester',
      weight: '4.2 oz',
      care: 'Pre-shrunk, machine wash cold, gentle cycle, inside out. Do not bleach. Tumble dry low.',
      sizing: 'True to size. Fits unisex/standard.'
    }
  },
  {
    id: '4glory',
    name: 'For His Glory Tee',
    price: 35,
    category: 'tee',
    metaDescription: 'For His Glory pickleball tee. Faith pickleball apparel for believers who compete with conviction. Clean geometry, bold typography, scripture embedded.',
    altText: 'For His Glory pickleball tee - faith pickleball apparel for believers',
    scripture: '1 Corinthians 10:31',
    scriptureText: 'So whether you eat or drink or whatever you do, do it all for the glory of God.',
    image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c572b1c7ca1.png',
    frontImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c572b1c7ca1.png',
    backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c572b1ca641.png',
    colorways: [
      { name: 'Dark Grey Heather', code: 'heather-grey', image: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-front-69c572b1c526d.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-left-front-69c572b1c2b11.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-back-69c572b1ca3c2.png' },
      { name: 'Heather Olive', code: 'heather-olive', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c572b1c7ca1.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-left-front-69c572b1c2ef9.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c572b1ca641.png' },
      { name: 'Heather Slate', code: 'heather-slate', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-front-69c572b1c6f14.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-left-front-69c572b1c2dce.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-back-69c572b1ca589.png' },
      { name: 'Heather Mauve', code: 'heather-mauve', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-front-69c572b1c6161.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-left-front-69c572b1c2c99.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-back-69c572b1ca491.png' },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    description: 'Every point is an opportunity. Every rally is a witness. The court is a stage, and our play is a statement of faith. This is the tee for the believer who competes with conviction. Clean geometry. Bold typography. Part of the Founder\'s Drop. Built with intention.',
    details: {
      material: '52% combed and ring-spun cotton, 48% polyester',
      weight: '4.2 oz',
      care: 'Pre-shrunk, machine wash cold, gentle cycle, inside out. Do not bleach. Tumble dry low.',
      sizing: 'True to size. Fits unisex/standard.'
    }
  },
  {
    id: 'drop',
    name: 'Trust the Drop Tee',
    price: 35,
    category: 'tee',
    metaDescription: 'Trust the Drop pickleball tee. Christian pickleball shirt for players who commit to the play before they see the result. Scripture-embedded faith apparel.',
    altText: 'Trust the Drop pickleball tee - Christian pickleball shirt with embedded scripture',
    scripture: 'Proverbs 3:5',
    scriptureText: 'Trust in the Lord with all your heart and lean not on your own understanding.',
    image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c579a350ff7.png',
    frontImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c579a350ff7.png',
    backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c579a353206.png',
    colorways: [
      { name: 'Dark Grey Heather', code: 'heather-grey', image: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-front-69c579a34ef95.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-left-front-69c579a34cf21.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-dark-grey-heather-back-69c579a352fda.png' },
      { name: 'Heather Olive', code: 'heather-olive', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-front-69c579a350ff7.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-left-front-69c579a34d2d4.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-olive-back-69c579a353206.png' },
      { name: 'Heather Slate', code: 'heather-slate', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-front-69c579a3505cd.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-left-front-69c579a34d1aa.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-slate-back-69c579a353156.png' },
      { name: 'Heather Mauve', code: 'heather-mauve', image: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-front-69c579a34fb20.png', modelImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-left-front-69c579a34d079.png', backImage: MOCKUP_BASE + 'unisex-staple-t-shirt-heather-mauve-back-69c579a3530ab.png' },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    description: 'The drop shot is the ultimate expression of control and faith. You commit to the play before you see the result. This is the tee for the player who moves with conviction even when the outcome isn\'t guaranteed. Minimal front mark. Significant statement on the back. Part of the Founder\'s Drop. Built with intention.',
    details: {
      material: '52% combed and ring-spun cotton, 48% polyester',
      weight: '4.2 oz',
      care: 'Pre-shrunk, machine wash cold, gentle cycle, inside out. Do not bleach. Tumble dry low.',
      sizing: 'True to size. Fits unisex/standard.'
    }
  },
  {
    id: 'hoodie',
    name: 'FITK Flagship Hoodie',
    price: 60,
    category: 'hoodie',
    metaDescription: 'FITK Flagship pickleball hoodie. Premium faith-driven athletic hoodie for the serious competitor who carries conviction on and off the court.',
    altText: 'FITK Flagship pickleball hoodie - premium faith-driven athletic hoodie',
    scripture: 'Colossians 3:23',
    scriptureText: 'Whatever you do, work at it with all your heart, as working for the Lord.',
    image: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-vintage-black-front-69dd300381007.png',
    frontImage: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-vintage-black-front-69dd300381007.png',
    backImage: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-vintage-black-back-69dd300381819.png',
    colorways: [
      { name: 'Vintage Black', code: 'black', image: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-vintage-black-front-69dd300381007.png', modelImage: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-vintage-black-left-69dd300381dc6.png', backImage: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-vintage-black-back-69dd300381819.png' },
      { name: 'Dusty Rose', code: 'rose', image: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-dusty-rose-front-69dd32616f469.png', modelImage: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-dusty-rose-left-69dd32616ff65.png', backImage: MOCKUP_BASE + 'hoodie_mocks/unisex-premium-pullover-hoodie-dusty-rose-back-69dd32616f94f.png' }
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    description: 'The flagship piece. Built for the serious competitor who carries faith on and off the court. Subtle FITK mark on the chest, full brand name down the left sleeve. Part of the Founder\'s Drop.',
    details: {
      material: '80% combed and ring-spun cotton, 20% polyester fleece',
      weight: '6.8 oz',
      care: 'Pre-shrunk, machine wash cold, gentle cycle, inside out. Do not bleach. Tumble dry low.',
      sizing: 'Oversized fit. We recommend sizing down for a true fit.'
    }
  }
];

// Export for use in HTML pages
if (typeof module !== 'undefined' && module.exports) {
  module.exports = products;
}
