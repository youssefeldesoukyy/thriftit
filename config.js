/** API on port 4000. Frontend: npm start → http://localhost:5173 (proxies /api). */
const API_BASE = "http://localhost:4000";

function thriftitApiBase() {
  if (typeof location !== "undefined" && location.protocol !== "file:") {
    var host = location.hostname;
    var port = location.port;
    if (
      (host === "localhost" || host === "127.0.0.1") &&
      port === "5173"
    ) {
      return "";
    }
  }
  var b =
    typeof API_BASE !== "undefined" && API_BASE
      ? String(API_BASE).replace(/\/$/, "")
      : "http://localhost:4000";
  if (/:5173(\/|$)/.test(b)) {
    return "http://localhost:4000";
  }
  return b;
}

if (typeof window !== "undefined") {
  window.thriftitApiBase = thriftitApiBase;
}

const THRIFTIT_STATIC_DESIGN_ONLY = false;
const API_LISTING_MAX_IMAGE_CHARS = 220000;
const API_CATEGORY_IDS = {};
const API_LISTING_PARENT_ROOT = "";
const API_PRODUCTS_USE_MULTIPART = true;
const API_PRODUCTS_FILE_FIELD = "images";
const API_PRODUCTS_FILE_FIELD_SINGLE = "";
const API_LOGIN_PATH = "/api/users/login";
const API_REGISTER_PATH = "/api/users/register";
const API_FORGOT_PASSWORD_PATH = "/api/users/forgot-password";
const API_RESET_PASSWORD_PATH = "/api/users/reset-password";
const API_PRODUCTS_PATH = "/api/products";
const API_SUGGEST_PRICE_PATH = "/api/products/suggest-price";
const API_ORDERS_PATH = "/api/orders";
const API_MY_ORDERS_PATH = "/api/orders/myorders";
const API_PAYMENTS_PATH = "/api/payments";
const STRIPE_PUBLISHABLE_KEY = "";
const API_CART_PATH = "/api/carts";
const API_CART_ADD_PATH = "/api/carts";
const API_WISHLIST_PATH = "/api/wishlist";
const API_USER_REVIEWS_PATH = "/api/reviews/mine";
const API_REVIEWABLE_PATH = "/api/reviews/reviewable";
const API_REVIEWS_PATH = "/api/reviews";
const API_ADMIN_PENDING_PRODUCTS_PATH = "/api/products/admin/pending";