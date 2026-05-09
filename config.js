/**
 * Local dev uses your machine. Production (e.g. *.vercel.app) uses your deployed API — HTTPS only.
 * Put your live backend URL here (Render, Railway, Fly.io, or an API deployed on Vercel).
 */
const API_BASE_PRODUCTION = "https://node-js-project-m50xr6vl8-youssefeldesoukyys-projects.vercel.app/";

const API_BASE =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:4000"
    : API_BASE_PRODUCTION;

/** Sell listing: max length of each base64 image string (JSON payload must fit server body limit). Lower if 413 persists. */
const API_LISTING_MAX_IMAGE_CHARS = 220000;

/**
 * Optional: map seller category slug → backend subcategory id (Mongo id string).
 * If set for the chosen category, `categoryid` is sent and satisfies validation.
 * Fill from your DB / API when productCategory alone is not accepted.
 */
const API_CATEGORY_IDS = {};

/**
 * Optional: fixed parentRoot for every listing (must match your API).
 * Leave "" to auto-set from gender: Women | Men (female → Women, male → Men).
 */
const API_LISTING_PARENT_ROOT = "";

/**
 * POST /products: send photos as multipart files (matches Express + multer).
 * Set false only if your API expects base64 inside JSON.
 */
const API_PRODUCTS_USE_MULTIPART = true;

/** Multer file field name — must match upload.array('…') / upload.fields([{ name: '…' }]). */
const API_PRODUCTS_FILE_FIELD = "images";

/**
 * Optional second file field (e.g. upload.fields includes both). Leave "" — duplicating the first
 * file under "image" causes MulterError "Unexpected field" when only "images" is registered.
 */
const API_PRODUCTS_FILE_FIELD_SINGLE = "";
/** Change if your Express routes differ (check your backend router). */
const API_LOGIN_PATH = "/api/users/login";
const API_REGISTER_PATH = "/api/users/register";
/** Products collection — same base as GET /api/products */
const API_PRODUCTS_PATH = "/api/products";
/** Place order */
const API_ORDERS_PATH = "/api/orders";
/** Shopping cart — GET list, DELETE clear; add/remove paths below (backend uses /api/carts) */
const API_CART_PATH = "/api/carts";
/** POST add item — same as base path on this backend (not /add) */
const API_CART_ADD_PATH = "/api/carts";
/**
 * Wishlist (auth required). Frontend expects:
 *   GET  {API_WISHLIST_PATH}           — list entries (array or { items: [...] }, products may be populated like cart)
 *   POST {API_WISHLIST_PATH}/add       — JSON { productId }
 *   POST {API_WISHLIST_PATH}/remove    — JSON { productId }
 *   Optional: DELETE {API_WISHLIST_PATH}/items/:id — same idea as cart line delete
 * Override paths below if your backend uses different URLs.
 */
const API_WISHLIST_PATH = "/api/wishlist";
/** POST add — backend is POST /api/wishlist (not /add) */
const API_WISHLIST_ADD_PATH = "/api/wishlist";

/**
 * Authenticated user's reviews — e.g. reviews they wrote after purchase,
 * or your backend may combine reviews about them as seller. Response: array or { reviews | items | data }.
 */
const API_USER_REVIEWS_PATH = "/api/users/me/reviews";

// const API_WISHLIST_ADD_PATH = "/api/wishlist";
// const API_WISHLIST_REMOVE_PATH = "/api/wishlist/remove";
/** Optional: if add is POST /api/cart (not /api/cart/add), set e.g. "/api/cart" */
// const API_CART_ADD_PATH = "/api/cart/add";
/** Optional: if remove differs from default POST /api/cart/remove */
// const API_CART_REMOVE_PATH = "/api/cart/remove";
