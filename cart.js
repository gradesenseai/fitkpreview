// Faith in the Kitchen - Shopify Storefront API Integration
// =========================================================
// Uses the Storefront API Cart GraphQL endpoints directly.
// No external SDK required.

// Shopify Storefront API token - set via environment variable or config injection at deploy time.
// Removed from source per Shopify Ecosystem Governance request (April 2026, ticket 49f35924-2d85-4eff-943d-93c0e3926455).
// The previous token has been rotated in Shopify admin; this file no longer holds a live credential.
const SHOPIFY_CONFIG = {
  domain: 'faith-in-the-kitchen.myshopify.com',
  storefrontAccessToken: '', // inject at deploy (e.g. Vercel env var substitution or serverless proxy)
  apiVersion: '2025-01',
};

// Shopify product handle map (URL slugs from your Shopify store)
const SHOPIFY_PRODUCT_HANDLES = {
  'dinkp': 'dink-with-purpose-tee',
  'servp': 'serve-with-purpose-tee',
  'sgsg': 'soft-game-strong-faith-tee',
  '4glory': 'for-his-glory-tee',
  'drop': 'trust-the-drop-tee',
  'hoodie': 'hoodie',
};

let shopifyCart = null;
let shopifyReady = false;

// ============================================================
// Storefront API - GraphQL Helper
// ============================================================
async function storefrontFetch(query, variables) {
  const url = 'https://' + SHOPIFY_CONFIG.domain + '/api/' + SHOPIFY_CONFIG.apiVersion + '/graphql.json';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontAccessToken,
    },
    body: JSON.stringify({ query: query, variables: variables }),
  });

  if (!response.ok) {
    throw new Error('Storefront API error: ' + response.status);
  }

  const json = await response.json();
  if (json.errors) {
    console.error('Storefront API GraphQL errors:', json.errors);
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

// ============================================================
// Initialize - Create or restore a cart
// ============================================================
async function initShopify() {
  if (!SHOPIFY_CONFIG.storefrontAccessToken) {
    console.warn('FITK Cart: No Storefront API token. Using placeholder cart.');
    initPlaceholderCart();
    return;
  }

  try {
    // Try to restore existing cart
    const savedCartId = sessionStorage.getItem('fitk_cart_id');
    if (savedCartId) {
      const data = await storefrontFetch(
        'query($id: ID!) { cart(id: $id) { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } image { url altText } product { title } selectedOptions { name value } } } } } } cost { subtotalAmount { amount currencyCode } } } }',
        { id: savedCartId }
      );

      if (data.cart) {
        shopifyCart = data.cart;
        shopifyReady = true;
        updateCartCount();
        console.log('FITK Cart: Restored existing cart');
        return;
      }
    }

    // Create new cart
    await createNewCart();
  } catch (err) {
    console.error('FITK Cart: Failed to initialize Shopify -', err.message);
    console.log('FITK Cart: Falling back to placeholder cart');
    initPlaceholderCart();
  }
}

async function createNewCart() {
  const data = await storefrontFetch(
    'mutation { cartCreate { cart { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } image { url altText } product { title } selectedOptions { name value } } } } } } cost { subtotalAmount { amount currencyCode } } } userErrors { field message } } }',
    {}
  );

  if (data.cartCreate.userErrors.length > 0) {
    throw new Error(data.cartCreate.userErrors[0].message);
  }

  shopifyCart = data.cartCreate.cart;
  shopifyReady = true;
  sessionStorage.setItem('fitk_cart_id', shopifyCart.id);
  updateCartCount();
  console.log('FITK Cart: New cart created');
}

// ============================================================
// Fetch product by handle to find variant IDs
// ============================================================
async function fetchProductByHandle(handle) {
  const data = await storefrontFetch(
    'query($handle: String!) { product(handle: $handle) { id title variants(first: 50) { edges { node { id title availableForSale price { amount currencyCode } selectedOptions { name value } image { url altText } } } } } }',
    { handle: handle }
  );
  return data.product;
}

// ============================================================
// Add to Cart
// ============================================================
async function addToCart(productId, color, size) {
  if (!shopifyReady) {
    addToPlaceholderCart(productId, color, size);
    return;
  }

  const handle = SHOPIFY_PRODUCT_HANDLES[productId];
  if (!handle) {
    console.error('FITK Cart: Unknown product ID:', productId);
    showCartNotification('Product not found.');
    return;
  }

  try {
    // Fetch product variants from Shopify
    const product = await fetchProductByHandle(handle);
    if (!product) {
      console.error('FITK Cart: Product not found on Shopify:', handle);
      showCartNotification('Product not available.');
      return;
    }

    // Find matching variant by size AND color
    const variant = product.variants.edges.find(function(edge) {
      const v = edge.node;
      var sizeMatch = false;
      var colorMatch = false;
      v.selectedOptions.forEach(function(opt) {
        if (opt.name.toLowerCase() === 'size' && opt.value.toLowerCase() === size.toLowerCase()) sizeMatch = true;
        if (opt.name.toLowerCase() === 'color' && opt.value.toLowerCase() === color.toLowerCase()) colorMatch = true;
      });
      return sizeMatch && colorMatch;
    });

    if (!variant) {
      console.error('FITK Cart: Variant not found for color:', color, 'size:', size);
      showCartNotification('This color/size combination is currently unavailable.');
      return;
    }

    if (!variant.node.availableForSale) {
      showCartNotification('This size is sold out.');
      return;
    }

    // Add line item to cart
    const data = await storefrontFetch(
      'mutation($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } image { url altText } product { title } selectedOptions { name value } } } } } } cost { subtotalAmount { amount currencyCode } } } userErrors { field message } } }',
      {
        cartId: shopifyCart.id,
        lines: [{ merchandiseId: variant.node.id, quantity: 1 }],
      }
    );

    if (data.cartLinesAdd.userErrors.length > 0) {
      throw new Error(data.cartLinesAdd.userErrors[0].message);
    }

    shopifyCart = data.cartLinesAdd.cart;
    sessionStorage.setItem('fitk_cart_id', shopifyCart.id);
    updateCartCount();
    showCartNotification('Added to cart');

    // Meta Pixel - AddToCart event
    if (typeof fbq === 'function') {
      var priceAmount = variant.node.price ? parseFloat(variant.node.price.amount) : 0;
      fbq('track', 'AddToCart', {
        content_ids: [productId],
        content_name: handle,
        content_type: 'product',
        value: priceAmount,
        currency: 'USD'
      });
    }

    openCartDrawer();

  } catch (err) {
    console.error('FITK Cart: Error adding to cart -', err.message);
    showCartNotification('Something went wrong. Please try again.');
  }
}

// ============================================================
// Remove from Cart
// ============================================================
async function removeCartItem(lineItemId) {
  if (!shopifyReady || !shopifyCart) return;

  try {
    const data = await storefrontFetch(
      'mutation($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } image { url altText } product { title } selectedOptions { name value } } } } } } cost { subtotalAmount { amount currencyCode } } } userErrors { field message } } }',
      {
        cartId: shopifyCart.id,
        lineIds: [lineItemId],
      }
    );

    if (data.cartLinesRemove.userErrors.length > 0) {
      throw new Error(data.cartLinesRemove.userErrors[0].message);
    }

    shopifyCart = data.cartLinesRemove.cart;
    updateCartCount();
    renderCartItems();
  } catch (err) {
    console.error('FITK Cart: Error removing item -', err.message);
  }
}

// ============================================================
// Checkout - redirect to Shopify checkout
// ============================================================
function goToCheckout() {
  if (shopifyReady && shopifyCart && shopifyCart.checkoutUrl) {
    // Meta Pixel - InitiateCheckout event
    if (typeof fbq === 'function') {
      var checkoutValue = shopifyCart.cost && shopifyCart.cost.subtotalAmount ? parseFloat(shopifyCart.cost.subtotalAmount.amount) : 0;
      var contentIds = [];
      if (shopifyCart.lines && shopifyCart.lines.edges) {
        shopifyCart.lines.edges.forEach(function(edge) {
          if (edge.node && edge.node.merchandise && edge.node.merchandise.id) {
            contentIds.push(edge.node.merchandise.id);
          }
        });
      }
      fbq('track', 'InitiateCheckout', {
        content_ids: contentIds,
        content_type: 'product',
        num_items: contentIds.length,
        value: checkoutValue,
        currency: 'USD'
      });
    }
    window.location.href = shopifyCart.checkoutUrl;
  } else if (placeholderCart.length > 0) {
    showCartNotification('Checkout is not available yet. Please try again.');
  }
}

// ============================================================
// Cart Drawer UI
// ============================================================
function createCartDrawer() {
  if (document.getElementById('cart-drawer')) return;

  // Create overlay as a sibling (not child) of the drawer
  const overlay = document.createElement('div');
  overlay.className = 'cart-overlay';
  overlay.onclick = closeCartDrawer;
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.id = 'cart-drawer';
  drawer.innerHTML = '\
    <div class="cart-panel">\
      <div class="cart-header">\
        <h3>Your Cart</h3>\
        <button class="cart-close" onclick="closeCartDrawer()" aria-label="Close cart">\
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
            <line x1="18" y1="6" x2="6" y2="18"></line>\
            <line x1="6" y1="6" x2="18" y2="18"></line>\
          </svg>\
        </button>\
      </div>\
      <div class="cart-items" id="cart-items">\
        <p class="cart-empty">Your cart is empty</p>\
      </div>\
      <div class="cart-footer" id="cart-footer" style="display: none;">\
        <div class="cart-subtotal">\
          <span>Subtotal</span>\
          <span id="cart-subtotal-amount">$0.00</span>\
        </div>\
        <button class="btn cart-checkout-btn" id="cart-checkout-btn" onclick="goToCheckout()">\
          Checkout\
        </button>\
        <p class="cart-shipping-note">Shipping calculated at checkout</p>\
      </div>\
    </div>\
  ';
  document.body.appendChild(drawer);
}

function openCartDrawer() {
  createCartDrawer();
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.querySelector('.cart-overlay');
  drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.querySelector('.cart-overlay');
  if (drawer) {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (overlay) overlay.classList.remove('open');
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');

  if (shopifyReady && shopifyCart && shopifyCart.lines.edges.length > 0) {
    // Shopify cart
    container.innerHTML = shopifyCart.lines.edges.map(function(edge) {
      var item = edge.node;
      var merch = item.merchandise;
      var imgSrc = merch.image ? merch.image.url : '';
      var options = merch.selectedOptions.map(function(o) { return o.value; }).join(' / ');
      return '\
        <div class="cart-item">\
          ' + (imgSrc ? '<img src="' + imgSrc + '" alt="' + merch.product.title + '" class="cart-item-image">' : '') + '\
          <div class="cart-item-details">\
            <h4>' + merch.product.title + '</h4>\
            <p>' + options + '</p>\
            <p class="cart-item-price">$' + parseFloat(merch.price.amount).toFixed(2) + '</p>\
            <p class="cart-item-qty">Qty: ' + item.quantity + '</p>\
          </div>\
          <button class="cart-item-remove" onclick="removeCartItem(\'' + item.id + '\')" aria-label="Remove">\
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
              <line x1="18" y1="6" x2="6" y2="18"></line>\
              <line x1="6" y1="6" x2="18" y2="18"></line>\
            </svg>\
          </button>\
        </div>\
      ';
    }).join('');

    document.getElementById('cart-subtotal-amount').textContent = '$' + parseFloat(shopifyCart.cost.subtotalAmount.amount).toFixed(2);
    footer.style.display = 'block';

  } else if (placeholderCart.length > 0) {
    // Placeholder cart
    var subtotal = 0;
    container.innerHTML = placeholderCart.map(function(item, idx) {
      subtotal += item.price;
      return '\
        <div class="cart-item">\
          <div class="cart-item-details">\
            <h4>' + item.name + '</h4>\
            <p>' + item.size + ' / ' + item.color + '</p>\
            <p class="cart-item-price">$' + item.price.toFixed(2) + '</p>\
          </div>\
          <button class="cart-item-remove" onclick="removePlaceholderItem(' + idx + ')" aria-label="Remove">\
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
              <line x1="18" y1="6" x2="6" y2="18"></line>\
              <line x1="6" y1="6" x2="18" y2="18"></line>\
            </svg>\
          </button>\
        </div>\
      ';
    }).join('');

    document.getElementById('cart-subtotal-amount').textContent = '$' + subtotal.toFixed(2);
    footer.style.display = 'block';
  } else {
    container.innerHTML = '<p class="cart-empty">Your cart is empty</p>';
    footer.style.display = 'none';
  }
}

// ============================================================
// Cart Count Badge
// ============================================================
function updateCartCount() {
  var count = 0;

  if (shopifyReady && shopifyCart) {
    count = shopifyCart.lines.edges.reduce(function(total, edge) {
      return total + edge.node.quantity;
    }, 0);
  } else {
    count = placeholderCart.length;
  }

  var cartIcon = document.querySelector('.cart-icon');
  if (!cartIcon) return;

  var badge = document.querySelector('.cart-badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-badge';
      cartIcon.parentNode.style.position = 'relative';
      cartIcon.parentNode.appendChild(badge);
    }
    badge.textContent = count;
    badge.style.display = 'flex';
  } else if (badge) {
    badge.style.display = 'none';
  }
}

// ============================================================
// Cart Notification
// ============================================================
function showCartNotification(message) {
  var existing = document.querySelector('.cart-notification');
  if (existing) existing.remove();

  var notification = document.createElement('div');
  notification.className = 'cart-notification';
  notification.innerHTML = '\
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\
      <polyline points="20 6 9 17 4 12"></polyline>\
    </svg>\
    <span>' + message + '</span>\
  ';
  document.body.appendChild(notification);

  requestAnimationFrame(function() {
    notification.classList.add('show');
  });

  setTimeout(function() {
    notification.classList.remove('show');
    setTimeout(function() { notification.remove(); }, 300);
  }, 3000);
}

// ============================================================
// Placeholder Cart (fallback if Shopify API fails)
// ============================================================
var placeholderCart = [];

function initPlaceholderCart() {
  var saved = sessionStorage.getItem('fitk_placeholder_cart');
  if (saved) {
    try { placeholderCart = JSON.parse(saved); } catch(e) {}
  }
  updateCartCount();
}

function addToPlaceholderCart(productId, color, size) {
  var product = products.find(function(p) { return p.id === productId; });
  if (!product) return;

  placeholderCart.push({
    productId: productId,
    name: product.name,
    price: product.price,
    color: color,
    size: size,
  });

  sessionStorage.setItem('fitk_placeholder_cart', JSON.stringify(placeholderCart));
  updateCartCount();
  showCartNotification('Added to cart');
  openCartDrawer();
}

function removePlaceholderItem(index) {
  placeholderCart.splice(index, 1);
  sessionStorage.setItem('fitk_placeholder_cart', JSON.stringify(placeholderCart));
  updateCartCount();
  renderCartItems();
}

// ============================================================
// Founder's List Signup (Shopify Customer API)
// ============================================================
function handleFoundersListSignup(form) {
  var emailInput = form.querySelector('input[type="email"]');
  var submitBtn = form.querySelector('button[type="submit"]');
  var email = emailInput.value.trim();

  if (!email) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing Up...';

  var query = 'mutation customerCreate($input: CustomerCreateInput!) { customerCreate(input: $input) { customer { id email acceptsMarketing } customerUserErrors { code field message } } }';

  // Generate a random password - required by Shopify to create the customer
  // record. These are email subscribers, not account logins.
  var pass = 'FITK!' + Math.random().toString(36).slice(2) + Date.now().toString(36);

  var variables = {
    input: {
      email: email,
      password: pass,
      acceptsMarketing: true
    }
  };

  fetch('https://' + SHOPIFY_CONFIG.domain + '/api/' + (SHOPIFY_CONFIG.apiVersion || '2025-01') + '/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_CONFIG.storefrontAccessToken,
    },
    body: JSON.stringify({ query: query, variables: variables }),
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var result = data.data && data.data.customerCreate;
    var errors = result && result.customerUserErrors;
    if (errors && errors.length > 0 && errors[0].code !== 'TAKEN') {
      submitBtn.textContent = 'Try Again';
      submitBtn.disabled = false;
      showCartNotification('Something went wrong. Please try again.');
    } else {
      emailInput.value = '';
      submitBtn.textContent = "You're In!";
      showCartNotification("Welcome to the Founder's List!");
      setTimeout(function() {
        submitBtn.textContent = 'Sign Me Up';
        submitBtn.disabled = false;
      }, 3000);
    }
  })
  .catch(function() {
    submitBtn.textContent = 'Try Again';
    submitBtn.disabled = false;
    showCartNotification('Connection error. Please try again.');
  });
}

// ============================================================
// Initialize on page load
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  initShopify();

  // Make cart icon clickable
  var cartIcon = document.querySelector('.cart-icon');
  if (cartIcon) {
    cartIcon.addEventListener('click', function() {
      openCartDrawer();
    });
  }
});
