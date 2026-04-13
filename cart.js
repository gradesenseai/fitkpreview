// Faith in the Kitchen - Shopify Buy Button SDK Integration
// =========================================================
// This file handles cart functionality via Shopify's headless checkout.
//
// TO ACTIVATE: Replace the placeholder values below with your actual
// Shopify Storefront Access Token and domain.
//
// Steps to get your token:
// 1. Shopify Admin → Settings → Apps and sales channels
// 2. Click "Develop apps" → Create an app
// 3. Configure Storefront API scopes: unauthenticated_read_product_listings,
//    unauthenticated_write_checkouts, unauthenticated_read_checkouts
// 4. Install the app and copy the Storefront access token

const SHOPIFY_CONFIG = {
  domain: 'faith-in-the-kitchen.myshopify.com', // Your Shopify domain
  storefrontAccessToken: '843036e6e5826887cff08bb03a6b36b0', // Storefront API access token (Headless channel)
};

// Map our product IDs to Shopify variant IDs
// You'll need to fill these in from your Shopify admin
// Shopify Admin → Products → [Product] → Variants → each variant has a numeric ID
const SHOPIFY_VARIANT_MAP = {
  // Format: 'productId-colorCode-size': 'shopifyVariantId'
  // Example: 'dinkp-heather-olive-M': 'gid://shopify/ProductVariant/12345678'
  //
  // These will be populated once we connect to the Shopify Storefront API
  // For now, we'll use the API to fetch variants dynamically
};

// Shopify product handle map (URL slugs from your Shopify store)
const SHOPIFY_PRODUCT_HANDLES = {
  'dinkp': 'dink-with-purpose-tee',
  'servp': 'serve-with-purpose-tee',
  'sgsg': 'soft-game-strong-faith-tee',
  '4glory': 'for-his-glory-tee',
  'drop': 'trust-the-drop-tee',
  'hoodie': 'fitk-flagship-hoodie',
};

let shopifyClient = null;
let cart = null;
let cartUI = null;

// ============================================================
// Initialize Shopify Buy SDK
// ============================================================
function initShopify() {
  if (!SHOPIFY_CONFIG.storefrontAccessToken || SHOPIFY_CONFIG.storefrontAccessToken === 'PASTE_YOUR_TOKEN_HERE') {
    console.warn('FITK Cart: Shopify not configured. Using placeholder cart.');
    initPlaceholderCart();
    return;
  }

  // Load Shopify Buy SDK from CDN
  const script = document.createElement('script');
  script.src = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
  script.async = true;
  script.onload = function() {
    shopifyClient = ShopifyBuy.buildClient({
      domain: SHOPIFY_CONFIG.domain,
      storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken,
    });

    // Create or restore cart
    const savedCartId = sessionStorage.getItem('fitk_cart_id');
    if (savedCartId) {
      shopifyClient.checkout.fetch(savedCartId).then(function(checkout) {
        if (checkout && !checkout.completedAt) {
          cart = checkout;
          updateCartCount();
        } else {
          createNewCart();
        }
      }).catch(function() {
        createNewCart();
      });
    } else {
      createNewCart();
    }

    console.log('FITK Cart: Shopify SDK initialized');
  };
  script.onerror = function() {
    console.error('FITK Cart: Failed to load Shopify SDK');
    initPlaceholderCart();
  };
  document.head.appendChild(script);
}

function createNewCart() {
  shopifyClient.checkout.create().then(function(checkout) {
    cart = checkout;
    sessionStorage.setItem('fitk_cart_id', checkout.id);
    updateCartCount();
  });
}

// ============================================================
// Add to Cart
// ============================================================
function addToCart(productId, color, size) {
  if (!shopifyClient) {
    // Placeholder mode
    addToPlaceholderCart(productId, color, size);
    return;
  }

  const handle = SHOPIFY_PRODUCT_HANDLES[productId];
  if (!handle) {
    console.error('FITK Cart: Unknown product ID:', productId);
    return;
  }

  // Fetch the product from Shopify to get variant IDs
  shopifyClient.product.fetchByHandle(handle).then(function(product) {
    if (!product) {
      console.error('FITK Cart: Product not found on Shopify:', handle);
      showCartNotification('Product not available. Please try again.');
      return;
    }

    // Find the matching variant (by size — Shopify variants are typically by size)
    const variant = product.variants.find(function(v) {
      return v.title.toLowerCase().includes(size.toLowerCase()) ||
             v.selectedOptions.some(function(opt) {
               return opt.name.toLowerCase() === 'size' && opt.value.toLowerCase() === size.toLowerCase();
             });
    });

    if (!variant) {
      console.error('FITK Cart: Variant not found for size:', size);
      showCartNotification('This size is currently unavailable.');
      return;
    }

    // Add to Shopify checkout
    const lineItemsToAdd = [{
      variantId: variant.id,
      quantity: 1,
    }];

    shopifyClient.checkout.addLineItems(cart.id, lineItemsToAdd).then(function(updatedCheckout) {
      cart = updatedCheckout;
      sessionStorage.setItem('fitk_cart_id', cart.id);
      updateCartCount();
      showCartNotification('Added to cart');
      openCartDrawer();
    });
  }).catch(function(err) {
    console.error('FITK Cart: Error adding to cart:', err);
    showCartNotification('Something went wrong. Please try again.');
  });
}

// ============================================================
// Cart Drawer UI
// ============================================================
function createCartDrawer() {
  if (document.getElementById('cart-drawer')) return;

  const drawer = document.createElement('div');
  drawer.id = 'cart-drawer';
  drawer.innerHTML = `
    <div class="cart-overlay" onclick="closeCartDrawer()"></div>
    <div class="cart-panel">
      <div class="cart-header">
        <h3>Your Cart</h3>
        <button class="cart-close" onclick="closeCartDrawer()" aria-label="Close cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="cart-items" id="cart-items">
        <p class="cart-empty">Your cart is empty</p>
      </div>
      <div class="cart-footer" id="cart-footer" style="display: none;">
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <span id="cart-subtotal-amount">$0.00</span>
        </div>
        <button class="btn cart-checkout-btn" id="cart-checkout-btn" onclick="goToCheckout()">
          Checkout
        </button>
        <p class="cart-shipping-note">Shipping calculated at checkout</p>
      </div>
    </div>
  `;
  document.body.appendChild(drawer);
}

function openCartDrawer() {
  createCartDrawer();
  const drawer = document.getElementById('cart-drawer');
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');

  if (shopifyClient && cart && cart.lineItems.length > 0) {
    // Shopify cart
    container.innerHTML = cart.lineItems.map(function(item) {
      return `
        <div class="cart-item">
          <img src="${item.variant.image ? item.variant.image.src : ''}" alt="${item.title}" class="cart-item-image">
          <div class="cart-item-details">
            <h4>${item.title}</h4>
            <p>${item.variant.title}</p>
            <p class="cart-item-price">$${parseFloat(item.variant.price.amount).toFixed(2)}</p>
          </div>
          <button class="cart-item-remove" onclick="removeCartItem('${item.id}')" aria-label="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    document.getElementById('cart-subtotal-amount').textContent = '$' + parseFloat(cart.subtotalPrice.amount).toFixed(2);
    footer.style.display = 'block';
  } else if (placeholderCart.length > 0) {
    // Placeholder cart
    let subtotal = 0;
    container.innerHTML = placeholderCart.map(function(item, idx) {
      subtotal += item.price;
      return `
        <div class="cart-item">
          <div class="cart-item-details">
            <h4>${item.name}</h4>
            <p>${item.size} / ${item.color}</p>
            <p class="cart-item-price">$${item.price.toFixed(2)}</p>
          </div>
          <button class="cart-item-remove" onclick="removePlaceholderItem(${idx})" aria-label="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    document.getElementById('cart-subtotal-amount').textContent = '$' + subtotal.toFixed(2);
    footer.style.display = 'block';
  } else {
    container.innerHTML = '<p class="cart-empty">Your cart is empty</p>';
    footer.style.display = 'none';
  }
}

function removeCartItem(lineItemId) {
  if (!shopifyClient || !cart) return;

  shopifyClient.checkout.removeLineItems(cart.id, [lineItemId]).then(function(updatedCheckout) {
    cart = updatedCheckout;
    updateCartCount();
    renderCartItems();
  });
}

function goToCheckout() {
  if (shopifyClient && cart) {
    window.location.href = cart.webUrl;
  } else {
    // Placeholder - redirect to Shopify store
    window.location.href = 'https://' + SHOPIFY_CONFIG.domain + '/cart';
  }
}

// ============================================================
// Cart Count Badge
// ============================================================
function updateCartCount() {
  let count = 0;

  if (shopifyClient && cart) {
    count = cart.lineItems.reduce(function(total, item) {
      return total + item.quantity;
    }, 0);
  } else {
    count = placeholderCart.length;
  }

  // Update or create badge
  const cartIcon = document.querySelector('.cart-icon');
  if (!cartIcon) return;

  let badge = document.querySelector('.cart-badge');
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
  // Remove existing notification
  const existing = document.querySelector('.cart-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'cart-notification';
  notification.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);

  // Animate in
  requestAnimationFrame(function() {
    notification.classList.add('show');
  });

  // Remove after 3 seconds
  setTimeout(function() {
    notification.classList.remove('show');
    setTimeout(function() { notification.remove(); }, 300);
  }, 3000);
}

// ============================================================
// Placeholder Cart (before Shopify is connected)
// ============================================================
let placeholderCart = [];

function initPlaceholderCart() {
  // Load from sessionStorage
  const saved = sessionStorage.getItem('fitk_placeholder_cart');
  if (saved) {
    try { placeholderCart = JSON.parse(saved); } catch(e) {}
  }
  updateCartCount();
}

function addToPlaceholderCart(productId, color, size) {
  const product = products.find(function(p) { return p.id === productId; });
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
// Initialize on page load
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  initShopify();

  // Make cart icon clickable
  const cartIcon = document.querySelector('.cart-icon');
  if (cartIcon) {
    cartIcon.addEventListener('click', function() {
      openCartDrawer();
    });
  }
});
