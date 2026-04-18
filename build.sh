#!/bin/bash
# Build script for Vercel.
#   1) Injects Shopify Storefront token from environment variable into cart.js
#      at deploy time, so the token never appears in the git repo.
#   2) Regenerates sitemap.xml from current /news/ contents so new posts auto-index.

if [ -n "$SHOPIFY_STOREFRONT_TOKEN" ]; then
  sed -i "s|storefrontAccessToken: ''|storefrontAccessToken: '$SHOPIFY_STOREFRONT_TOKEN'|" cart.js
  echo "Injected Storefront token into cart.js"
else
  echo "WARNING: SHOPIFY_STOREFRONT_TOKEN not set. Cart will run in placeholder mode."
fi

echo "Regenerating sitemap.xml from current /news/ contents..."
node generate-sitemap.js
