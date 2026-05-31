(function () {
  function designOnly() {
    return (
      typeof THRIFTIT_STATIC_DESIGN_ONLY !== "undefined" &&
      THRIFTIT_STATIC_DESIGN_ONLY
    );
  }

  function base() {
    if (typeof thriftitApiBase === "function") {
      return thriftitApiBase();
    }
    if (typeof API_BASE === "undefined" || !API_BASE) {
      throw new Error("Missing API_BASE — load config.js first");
    }
    var b = String(API_BASE).replace(/\/$/, "");
    if (/:5173(\/|$)/.test(b)) {
      return "http://localhost:4000";
    }
    return b;
  }

  function productsPath() {
    return typeof API_PRODUCTS_PATH !== "undefined"
      ? API_PRODUCTS_PATH
      : "/api/products";
  }

  function suggestPricePath() {
    return typeof API_SUGGEST_PRICE_PATH !== "undefined"
      ? API_SUGGEST_PRICE_PATH
      : "/api/products/suggest-price";
  }

  function unwrapPriceSuggestion(body) {
    if (!body || typeof body !== "object") return null;
    if (body.suggestion && typeof body.suggestion === "object") {
      return body.suggestion;
    }
    if (body.data && body.data.suggestion && typeof body.data.suggestion === "object") {
      return body.data.suggestion;
    }
    if (typeof body.minPrice === "number" && typeof body.maxPrice === "number") {
      return body;
    }
    return null;
  }

  function ordersPath() {
    return typeof API_ORDERS_PATH !== "undefined"
      ? API_ORDERS_PATH
      : "/api/orders";
  }

  function myOrdersPath() {
    return typeof API_MY_ORDERS_PATH !== "undefined"
      ? API_MY_ORDERS_PATH
      : "/api/orders/myorders";
  }

  function paymentsPath() {
    return typeof API_PAYMENTS_PATH !== "undefined"
      ? API_PAYMENTS_PATH
      : "/api/payments";
  }

  function extractOrderId(body) {
    if (!body || typeof body !== "object") return "";
    var wrap = body.data && typeof body.data === "object" ? body.data : body;
    var order = wrap.order || wrap;
    var raw = order._id != null ? order._id : order.id;
    if (raw && typeof raw === "object" && typeof raw.toString === "function") {
      return String(raw.toString()).trim();
    }
    return raw != null ? String(raw).trim() : "";
  }

  function cartPath() {
    return typeof API_CART_PATH !== "undefined"
      ? API_CART_PATH
      : "/api/cart";
  }

  /** POST body target — default /api/cart/add */
  function cartAddPath() {
    if (typeof API_CART_ADD_PATH !== "undefined") return API_CART_ADD_PATH;
    return cartPath();
  }

  /** POST body — default /api/cart/remove */
  function cartRemovePath() {
    if (typeof API_CART_REMOVE_PATH !== "undefined") return API_CART_REMOVE_PATH;
    return cartPath() + "/remove";
  }

  function wishlistPath() {
    return typeof API_WISHLIST_PATH !== "undefined"
      ? API_WISHLIST_PATH
      : "/api/wishlist";
  }

  function wishlistAddPath() {
    if (typeof API_WISHLIST_ADD_PATH !== "undefined")
      return API_WISHLIST_ADD_PATH;
    return wishlistPath();
  }

  function wishlistRemovePath() {
    if (typeof API_WISHLIST_REMOVE_PATH !== "undefined")
      return API_WISHLIST_REMOVE_PATH;
    return wishlistPath() + "/remove";
  }

  function readStoredBearerToken() {
    if (typeof storedAuthToken === "function") {
      var tok = String(storedAuthToken() || "").trim();
      if (tok.toLowerCase().indexOf("bearer ") === 0) {
        tok = tok.slice(7).trim();
      }
      return tok;
    }
    var raw =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt");
    if (!raw || typeof raw !== "string") return "";
    var s = raw.trim();
    if (s.toLowerCase().indexOf("bearer ") === 0) {
      s = s.slice(7).trim();
    }
    return s;
  }

  function authHeaders() {
    var tok = readStoredBearerToken();
    var h = {};
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

  function parseMessage(data, fallback) {
    if (!data || typeof data !== "object") return fallback;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
    return fallback;
  }

  function handleApiResponse(res, text) {
    var data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseErr) {
      if (!res.ok) {
        var snippet = (text || "").slice(0, 280);
        if (
          res.status === 413 ||
          /too large|payload too large|request entity/i.test(snippet)
        ) {
          throw new Error(
            "Request too large — shrink photos in seller form or raise server body size limit (e.g. express.json limit / nginx client_max_body_size)."
          );
        }
        throw new Error(snippet || "Request failed (" + res.status + ")");
      }
      data = {};
    }
    if (
      !res.ok ||
      data.status === "error" ||
      String(data.status || "").toUpperCase() === "FAIL"
    ) {
      if (
        res.status === 413 ||
        /too large|payload too large|request entity/i.test(
          String(parseMessage(data, "") || "")
        )
      ) {
        throw new Error(
          parseMessage(
            data,
            "Request too large — shrink photos or raise the server body size limit."
          )
        );
      }
      throw new Error(
        parseMessage(data, "Request failed (" + res.status + ")")
      );
    }
    return data;
  }

  function isNetworkFetchFailure(err) {
    return (
      err &&
      (err.name === "TypeError" ||
        /failed to fetch|networkerror|load failed/i.test(String(err.message || "")))
    );
  }

  function apiUrl(path) {
    var root = base();
    return (root || "") + path;
  }

  /** Large multipart through http-server -P proxy often drops; POST straight to :4000 (CORS allows 5173). */
  function multipartUploadUrl(path) {
    if (
      typeof location !== "undefined" &&
      location.port === "5173" &&
      location.protocol !== "file:"
    ) {
      var direct =
        typeof API_BASE !== "undefined" && API_BASE
          ? String(API_BASE).replace(/\/$/, "")
          : "http://localhost:4000";
      return direct + path;
    }
    return apiUrl(path);
  }

  async function apiFetch(path, opts, fullUrl) {
    var url = fullUrl || apiUrl(path);
    try {
      return await fetch(url, opts);
    } catch (err) {
      if (isNetworkFetchFailure(err)) {
        var hint =
          typeof API_BASE !== "undefined" && API_BASE ? API_BASE : "your API";
        throw new Error(
          "Cannot reach the API at " +
            hint +
            ". In node-js-project run: npm run run:dev (port 4000). In thriftit run: npm start, then open http://localhost:5173 (not file://)."
        );
      }
      throw err;
    }
  }

  async function apiRequest(method, path, bodyObj) {
    if (designOnly()) {
      if (String(method || "").toUpperCase() === "GET") return [];
      throw new Error(
        "Design-only mode — set THRIFTIT_STATIC_DESIGN_ONLY = false in config.js to use the API."
      );
    }
    var headers = Object.assign({}, authHeaders());
    var opts = { method: method, headers: headers };
    if (bodyObj !== undefined && bodyObj !== null) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(bodyObj);
    }
    var res = await apiFetch(path, opts);
    var text = await res.text();
    return handleApiResponse(res, text);
  }

  async function apiRequestMultipart(method, path, fields, blobs) {
    if (designOnly()) {
      throw new Error(
        "Design-only mode — set THRIFTIT_STATIC_DESIGN_ONLY = false in config.js to list items."
      );
    }
    var headers = Object.assign({}, authHeaders());
    var fd = new FormData();
    var k, v;
    for (k in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      if (k === "images" || k === "image") continue;
      v = fields[k];
      if (v === undefined || v === null) continue;
      if (
        typeof v === "object" &&
        !(v instanceof File) &&
        !(v instanceof Blob)
      ) {
        fd.append(k, JSON.stringify(v));
      } else {
        fd.append(k, String(v));
      }
    }
    var fieldName =
      typeof API_PRODUCTS_FILE_FIELD !== "undefined" && API_PRODUCTS_FILE_FIELD
        ? API_PRODUCTS_FILE_FIELD
        : "images";
    var fieldSingle =
      typeof API_PRODUCTS_FILE_FIELD_SINGLE !== "undefined" &&
      API_PRODUCTS_FILE_FIELD_SINGLE
        ? String(API_PRODUCTS_FILE_FIELD_SINGLE).trim()
        : "";
    blobs.forEach(function (blob, i) {
      fd.append(fieldName, blob, "image-" + i + ".jpg");
    });
    if (fieldSingle && blobs[0]) {
      fd.append(fieldSingle, blobs[0], "image-0.jpg");
    }
    var res = await apiFetch(
      path,
      {
        method: method,
        headers: headers,
        body: fd,
      },
      multipartUploadUrl(path)
    );
    var text = await res.text();
    return handleApiResponse(res, text);
  }

  function unwrapCartPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    /** Backend cart payload: `{ data: { cart: { products } } }` */
    if (
      data.data &&
      typeof data.data === "object" &&
      data.data.cart &&
      typeof data.data.cart === "object" &&
      Array.isArray(data.data.cart.products)
    ) {
      return data.data.cart.products;
    }
    if (
      data.cart &&
      typeof data.cart === "object" &&
      Array.isArray(data.cart.products)
    ) {
      return data.cart.products;
    }
    if (Array.isArray(data.items)) return data.items;
    if (data.cart && Array.isArray(data.cart.items)) return data.cart.items;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.cartItems && Array.isArray(data.cartItems)) return data.cartItems;
    return [];
  }

  function unwrapWishlistPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    /** Backend wishlist: `{ data: { products: [...] } }` */
    if (
      data.data &&
      typeof data.data === "object" &&
      Array.isArray(data.data.products)
    ) {
      return data.data.products;
    }
    if (Array.isArray(data.items)) return data.items;
    if (data.wishlist && Array.isArray(data.wishlist.items))
      return data.wishlist.items;
    if (data.wishlist && Array.isArray(data.wishlist)) return data.wishlist;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.wishlistItems)) return data.wishlistItems;
    if (data.saved && Array.isArray(data.saved)) return data.saved;
    return unwrapCartPayload(data);
  }

  function coerceImg(v) {
    if (typeof window.resolveProductImageUrl === "function") {
      return window.resolveProductImageUrl(v);
    }
    if (v == null || v === "") return "";
    if (typeof v === "string") {
      var s = v.trim();
      if (
        s &&
        !/^https?:\/\//i.test(s) &&
        !/^data:image\//i.test(s) &&
        typeof API_BASE === "string" &&
        /^https?:\/\//i.test(API_BASE)
      ) {
        var base = API_BASE.replace(/\/$/, "");
        if (s.charAt(0) === "/") return base + s;
        if (/^uploads\//i.test(s)) return base + "/" + s.replace(/^\/+/, "");
        return base + "/uploads/" + s.replace(/^\/+/, "");
      }
      return s;
    }
    if (typeof v === "object") {
      if (typeof v.imageURL === "string") return coerceImg(v.imageURL);
      if (typeof v.imageUrl === "string") return coerceImg(v.imageUrl);
      if (typeof v.url === "string") return coerceImg(v.url);
      if (typeof v.secure_url === "string") return coerceImg(v.secure_url);
    }
    return "";
  }

  function formatSizeForDisplay(size) {
    if (typeof window.formatProductSize === "function") {
      return window.formatProductSize(size);
    }
    return size != null && String(size).trim() !== "" ? String(size).trim() : "—";
  }

  function extractMongoId(doc) {
    if (doc == null) return "";
    if (typeof doc === "string" || typeof doc === "number") {
      return String(doc).trim();
    }
    if (typeof doc !== "object") return "";
    if (doc.$oid) return String(doc.$oid).trim();
    var raw =
      doc._id != null
        ? doc._id
        : doc.id != null
          ? doc.id
          : doc.productId != null
            ? doc.productId
            : "";
    if (raw && typeof raw === "object") {
      if (raw.$oid) return String(raw.$oid).trim();
      if (typeof raw.toString === "function") {
        var hex = String(raw.toString()).trim();
        if (/^[a-f0-9]{24}$/i.test(hex)) return hex;
      }
    }
    return raw != null ? String(raw).trim() : "";
  }

  function isPopulatedProductDoc(obj) {
    return !!(
      obj &&
      typeof obj === "object" &&
      (obj._id != null || obj.id != null) &&
      (obj.price != null ||
        obj.name != null ||
        obj.description != null ||
        obj.brand != null)
    );
  }

  function firstImageFromProductDoc(p) {
    if (!p || typeof p !== "object") return "";
    if (typeof window.__normalizeUiProduct === "function") {
      var ui = window.__normalizeUiProduct(p);
      if (ui && Array.isArray(ui.images) && ui.images.length) {
        return ui.images[0];
      }
    }
    if (Array.isArray(p.images) && p.images.length) {
      return coerceImg(p.images[0]);
    }
    return coerceImg(p.image);
  }

  async function enrichBagRowsWithCatalogImages(rows) {
    if (!rows || !rows.length) return rows;
    var needsImage = rows.some(function (r) {
      return r && r.id && !r.image;
    });
    if (!needsImage) return rows;
    if (typeof window.fetchProductsMerged !== "function") return rows;
    try {
      var catalog = await window.fetchProductsMerged();
      var byId = {};
      catalog.forEach(function (p) {
        if (p && p.id) byId[String(p.id)] = p;
      });
      return rows.map(function (r) {
        if (!r || r.image) return r;
        var full = byId[String(r.id)];
        if (full && Array.isArray(full.images) && full.images.length) {
          return Object.assign({}, r, { image: full.images[0] });
        }
        return r;
      });
    } catch (enrichErr) {
      return rows;
    }
  }

  function bagItemTitleFromProduct(p) {
    if (!p || typeof p !== "object") return "Item";
    if (typeof window.__normalizeUiProduct === "function") {
      var ui = window.__normalizeUiProduct(p);
      if (ui && typeof window.productDisplayTitle === "function") {
        return window.productDisplayTitle(ui);
      }
      if (ui && ui.name) return String(ui.name).trim() || "Item";
    }
    if (typeof window.productDisplayTitle === "function") {
      return window.productDisplayTitle(p);
    }
    var brand = typeof p.brand === "string" ? p.brand.trim() : "";
    var rawName = typeof p.name === "string" ? p.name.trim() : "";
    if (rawName) return rawName;
    if (brand) return brand;
    return "Item";
  }

  function normalizeCartLine(row) {
    if (!row || typeof row !== "object") return null;
    var p = row.product;
    /** Cart lines: `{ productId: populatedProduct, quantity }`; wishlist GET returns product docs directly */
    var rawPid = row.productId;
    if (
      (!p || typeof p !== "object") &&
      rawPid &&
      typeof rawPid === "object" &&
      !(rawPid instanceof File) &&
      (rawPid._id != null || rawPid.id != null || rawPid.price != null)
    ) {
      p = rawPid;
    }
    if (!p && isPopulatedProductDoc(row)) {
      p = row;
    }
    if (p && typeof p === "object") {
      var img = firstImageFromProductDoc(p);
      var title = bagItemTitleFromProduct(p);
      var pid = extractMongoId(p);
      return {
        id: pid,
        _lineId: String(row._id != null ? row._id : row.id || pid),
        name: title,
        price: p.price != null ? p.price : row.price,
        image: img,
        color: p.color != null ? p.color : "-",
        size: formatSizeForDisplay(p.size != null ? p.size : "-"),
      };
    }
    var fallbackId = extractMongoId(
      typeof row.productId === "object" ? row.productId : row
    );
    return {
      id: fallbackId,
      _lineId: String(row._id != null ? row._id : row.cartItemId || fallbackId),
      name: row.name || "Item",
      price: row.price,
      image: coerceImg(row.image),
      color: row.color || "-",
      size: formatSizeForDisplay(row.size || "-"),
    };
  }

  async function getCartItems() {
    var data = await apiRequest("GET", cartPath());
    var rows = unwrapCartPayload(data);
    var lines = rows
      .map(function (row) {
        try {
          return normalizeCartLine(row);
        } catch (lineErr) {
          return null;
        }
      })
      .filter(function (r) {
        return r && r.id;
      });
    try {
      return await enrichBagRowsWithCatalogImages(lines);
    } catch (enrichErr) {
      return lines;
    }
  }

  async function addProductToCart(product) {
    var pid = extractMongoId(product);
    if (!pid) throw new Error("Invalid product");
    if (!/^[a-f0-9]{24}$/i.test(pid)) {
      throw new Error(
        "Invalid product id — open the item from Shop All and try again."
      );
    }
    var payload = {
      productId: pid,
      quantity: 1,
    };
    return apiRequest("POST", cartAddPath(), payload);
  }

  async function removeCartLine(lineId, productId) {
    var pid = String(productId || "");
    var lid = lineId != null ? String(lineId) : "";
    // Backend: DELETE /api/carts/:productId
    if (pid && /^[a-f0-9]{24}$/i.test(pid)) {
      try {
        return await apiRequest(
          "DELETE",
          cartPath() + "/" + encodeURIComponent(pid)
        );
      } catch (e0) {}
    }
    if (lid && lid.length > 4) {
      try {
        return await apiRequest(
          "DELETE",
          cartPath() + "/items/" + encodeURIComponent(lid)
        );
      } catch (e1) {}
    }
    return apiRequest("POST", cartRemovePath(), { productId: pid });
  }

  async function clearServerCart() {
    try {
      await apiRequest("DELETE", cartPath());
      return;
    } catch (e1) {}
    try {
      await apiRequest("POST", cartPath() + "/clear", {});
    } catch (e2) {}
  }

  async function getWishlistItems() {
    var data = await apiRequest("GET", wishlistPath());
    var rows = unwrapWishlistPayload(data);
    return rows
      .map(normalizeCartLine)
      .filter(function (r) {
        return r && r.id;
      });
  }

  async function addProductToWishlist(product) {
    var pid = extractMongoId(product);
    if (!pid) throw new Error("Invalid product");
    if (!/^[a-f0-9]{24}$/i.test(pid)) {
      throw new Error(
        "This item cannot be saved to your wishlist. Open it from Shop All or search."
      );
    }
    if (product && String(product.status || "").toLowerCase() === "sold") {
      throw new Error("This item has been sold");
    }
    var payload = { productId: pid };
    return apiRequest("POST", wishlistAddPath(), payload);
  }

  async function removeWishlistLine(lineId, productId) {
    var pid = String(productId || "");
    var lid = lineId != null ? String(lineId) : "";
    // Backend: DELETE /api/wishlist/:productId
    if (pid && /^[a-f0-9]{24}$/i.test(pid)) {
      try {
        return await apiRequest(
          "DELETE",
          wishlistPath() + "/" + encodeURIComponent(pid)
        );
      } catch (e0) {}
    }
    if (lid && lid.length > 4) {
      try {
        return await apiRequest(
          "DELETE",
          wishlistPath() + "/items/" + encodeURIComponent(lid)
        );
      } catch (e1) {}
    }
    return apiRequest("POST", wishlistRemovePath(), { productId: pid });
  }

  function reviewsPath() {
    return typeof API_REVIEWS_PATH !== "undefined"
      ? API_REVIEWS_PATH
      : "/api/reviews";
  }

  function userReviewsPath() {
    return typeof API_USER_REVIEWS_PATH !== "undefined"
      ? API_USER_REVIEWS_PATH
      : "/api/reviews/mine";
  }

  function reviewablePath() {
    return typeof API_REVIEWABLE_PATH !== "undefined"
      ? API_REVIEWABLE_PATH
      : "/api/reviews/reviewable";
  }

  function unwrapReviewsPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data.reviews)) return data.reviews;
    if (Array.isArray(data.items)) return data.items;
    var wrap = data.data && typeof data.data === "object" ? data.data : null;
    if (wrap) {
      if (Array.isArray(wrap.reviews)) return wrap.reviews;
      if (Array.isArray(wrap.items)) return wrap.items;
    }
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function reviewProductRef(row) {
    if (!row || typeof row !== "object") return null;
    if (row.product && typeof row.product === "object") return row.product;
    if (
      row.productId &&
      typeof row.productId === "object" &&
      (row.productId._id != null || row.productId.description || row.productId.brand)
    ) {
      return row.productId;
    }
    return null;
  }

  function normalizePublicSellerReview(row) {
    if (!row || typeof row !== "object") return null;
    var product = reviewProductRef(row);
    var pid = product
      ? extractMongoId(product)
      : extractMongoId(row.productId != null ? row.productId : row.product_id);
    var pname = product
      ? String(
          product.description ||
            product.brand ||
            product.name ||
            product.title ||
            ""
        ).trim()
      : "";
    var rating =
      row.rating != null
        ? Number(row.rating)
        : row.stars != null
        ? Number(row.stars)
        : NaN;
    var text = typeof row.comment === "string" ? row.comment : "";
    var id = String(row._id != null ? row._id : row.id || "");
    var at =
      row.createdAt ||
      row.created ||
      row.date ||
      row.updatedAt ||
      "";
    var buyer =
      row.buyerId && typeof row.buyerId === "object" ? row.buyerId : null;
    var buyerLabel =
      buyer && (buyer.firstName || buyer.lastName)
        ? [buyer.firstName, buyer.lastName].filter(Boolean).join(" ").trim()
        : "Buyer";
    return {
      id: id,
      rating: Number.isFinite(rating) ? rating : null,
      text: text,
      productId: pid,
      productName: pname || (pid ? "Item" : ""),
      createdAt: at,
      buyerLabel: buyerLabel || "Buyer",
    };
  }

  function normalizeReview(row) {
    if (!row || typeof row !== "object") return null;
    var product = reviewProductRef(row);
    var pid = product
      ? extractMongoId(product)
      : extractMongoId(row.productId != null ? row.productId : row.product_id);
    var pname = product
      ? String(
          product.description ||
            product.brand ||
            product.name ||
            product.title ||
            ""
        ).trim()
      : String(row.productName || row.productTitle || "").trim();
    var rating =
      row.rating != null
        ? Number(row.rating)
        : row.stars != null
        ? Number(row.stars)
        : row.score != null
        ? Number(row.score)
        : NaN;
    var text =
      typeof row.comment === "string"
        ? row.comment
        : typeof row.text === "string"
        ? row.text
        : typeof row.body === "string"
        ? row.body
        : typeof row.message === "string"
        ? row.message
        : "";
    var id = String(row._id != null ? row._id : row.id || "");
    var at =
      row.createdAt ||
      row.created ||
      row.date ||
      row.updatedAt ||
      "";
    var seller =
      row.sellerId && typeof row.sellerId === "object" ? row.sellerId : null;
    var otherParty =
      seller && (seller.firstName || seller.lastName)
        ? [seller.firstName, seller.lastName].filter(Boolean).join(" ").trim()
        : typeof row.fromUser === "object" &&
          row.fromUser !== null &&
          typeof row.fromUser.name === "string"
        ? row.fromUser.name
        : typeof row.reviewer === "object" &&
          row.reviewer !== null &&
          (row.reviewer.name || row.reviewer.email)
        ? String(row.reviewer.name || row.reviewer.email || "")
        : typeof row.buyer === "object" &&
          row.buyer !== null &&
          (row.buyer.name || row.buyer.email)
        ? String(row.buyer.name || row.buyer.email || "")
        : String(row.reviewerName || row.sellerName || row.fromName || "").trim();
    return {
      id: id,
      rating: Number.isFinite(rating) ? rating : null,
      text: text,
      productId: pid,
      productName: pname || (pid ? "Product" : ""),
      createdAt: at,
      sellerLabel: otherParty,
    };
  }

  function unwrapReviewablePayload(data) {
    if (!data || typeof data !== "object") return [];
    var wrap = data.data && typeof data.data === "object" ? data.data : data;
    if (Array.isArray(wrap.items)) return wrap.items;
    if (Array.isArray(wrap)) return wrap;
    return [];
  }

  function normalizeReviewableItem(row) {
    if (!row || typeof row !== "object") return null;
    return {
      orderId: String(row.orderId || ""),
      productId: String(row.productId || ""),
      sellerId: String(row.sellerId || ""),
      sellerName: String(row.sellerName || "Seller").trim() || "Seller",
      productName: String(row.productName || "Item").trim() || "Item",
      orderDate: row.orderDate || "",
    };
  }

  function unwrapOrdersPayload(data) {
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data.orders)) return data.orders;
    if (data.data && Array.isArray(data.data.orders)) return data.data.orders;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalizeOrderRow(row) {
    if (!row || typeof row !== "object") return null;
    var id = extractMongoId(row);
    if (!id) return null;
    var items = [];
    var lines = row.products || [];
    lines.forEach(function (line) {
      if (!line) return;
      var p = line.productId;
      var pid = "";
      var name = "Item";
      var price = 0;
      if (p && typeof p === "object" && !(p instanceof File)) {
        pid = extractMongoId(p);
        name =
          String(
            (typeof p.name === "string" && p.name) ||
              (typeof p.description === "string" && p.description.trim()) ||
              (typeof p.brand === "string" && p.brand) ||
              "Item"
          ).trim() || "Item";
        price = p.price != null ? Number(p.price) : 0;
      } else {
        pid = extractMongoId(p);
        price = line.price != null ? Number(line.price) : 0;
      }
      if (pid) {
        items.push({
          productId: pid,
          name: name,
          price: price,
          quantity: line.quantity || 1,
        });
      }
    });
    return {
      id: id,
      status: String(row.status || "pending").toLowerCase(),
      amount: row.amount != null ? Number(row.amount) : 0,
      address: String(row.address || "").trim(),
      createdAt: row.createdAt || row.updatedAt || "",
      items: items,
    };
  }

  async function getMyOrders() {
    var data = await apiRequest("GET", myOrdersPath());
    return unwrapOrdersPayload(data)
      .map(normalizeOrderRow)
      .filter(function (o) {
        return o && o.id;
      });
  }

  async function getOrderById(orderId) {
    var id = encodeURIComponent(String(orderId));
    var data = await apiRequest("GET", ordersPath() + "/" + id);
    var wrap = data && data.data ? data.data : data;
    return wrap.order || wrap;
  }

  function normalizeAdminOrderRow(row) {
    var base = normalizeOrderRow(row);
    if (!base) return null;
    var u = row.userId;
    var buyerName = "";
    var buyerEmail = "";
    if (u && typeof u === "object") {
      buyerEmail = String(u.email || "").trim();
      var first = u.firstName ? String(u.firstName).trim() : "";
      var last = u.lastName ? String(u.lastName).trim() : "";
      buyerName = [first, last].filter(Boolean).join(" ").trim();
    }
    base.buyerName = buyerName || buyerEmail || "Buyer";
    base.buyerEmail = buyerEmail;
    return base;
  }

  async function getAllOrdersAdmin() {
    var data = await apiRequest("GET", ordersPath());
    return unwrapOrdersPayload(data)
      .map(normalizeAdminOrderRow)
      .filter(function (o) {
        return o && o.id;
      });
  }

  async function approveOrderAdmin(orderId) {
    var id = encodeURIComponent(String(orderId));
    return apiRequest("PATCH", ordersPath() + "/" + id + "/approve");
  }

  async function rejectOrderAdmin(orderId) {
    var id = encodeURIComponent(String(orderId));
    return apiRequest("PATCH", ordersPath() + "/" + id + "/reject");
  }

  async function updateOrderStatusAdmin(orderId, status) {
    var id = encodeURIComponent(String(orderId));
    return apiRequest("PATCH", ordersPath() + "/" + id + "/status", {
      status: status,
    });
  }

  async function getReviewablePurchases() {
    var data = await apiRequest("GET", reviewablePath());
    return unwrapReviewablePayload(data)
      .map(normalizeReviewableItem)
      .filter(function (r) {
        return r && r.orderId && r.productId && r.sellerId;
      });
  }

  async function submitSellerReview(payload) {
    return apiRequest("POST", reviewsPath(), {
      sellerId: payload.sellerId,
      orderId: payload.orderId,
      productId: payload.productId,
      rating: payload.rating,
      comment: payload.comment || "",
    });
  }

  function sellerReviewsPath(sellerId) {
    var id = encodeURIComponent(String(sellerId));
    return reviewsPath() + "/seller/" + id;
  }

  function sellerRatingPath(sellerId) {
    var id = encodeURIComponent(String(sellerId));
    return reviewsPath() + "/seller/" + id + "/rating";
  }

  /** Public reviews left for a seller (buyers who purchased). */
  async function getSellerReviews(sellerId) {
    if (!sellerId) return [];
    try {
      var data = await apiRequest("GET", sellerReviewsPath(sellerId));
      var rows = unwrapReviewsPayload(data);
      return rows
        .map(normalizePublicSellerReview)
        .filter(function (r) {
          return r != null && (r.id || r.rating != null || r.text);
        });
    } catch (e) {
      var msg = String((e && e.message) || "");
      if (/404|not found|Cannot GET|invalid seller/i.test(msg)) {
        return [];
      }
      throw e;
    }
  }

  /** Average rating + count for a seller. */
  async function getSellerRating(sellerId) {
    if (!sellerId) {
      return { averageRating: 0, totalReviews: 0 };
    }
    try {
      var data = await apiRequest("GET", sellerRatingPath(sellerId));
      var wrap = data && data.data ? data.data : data;
      var block = wrap && wrap.rating ? wrap.rating : wrap;
      return {
        averageRating:
          block && block.averageRating != null
            ? Number(block.averageRating)
            : 0,
        totalReviews:
          block && block.totalReviews != null ? Number(block.totalReviews) : 0,
      };
    } catch (e) {
      var msg = String((e && e.message) || "");
      if (/404|not found|Cannot GET|invalid seller/i.test(msg)) {
        return { averageRating: 0, totalReviews: 0 };
      }
      throw e;
    }
  }

  /** GET reviews the logged-in user wrote — [] if none. */
  async function getMyReviews() {
    try {
      var data = await apiRequest("GET", userReviewsPath());
      var rows = unwrapReviewsPayload(data);
      return rows
        .map(normalizeReview)
        .filter(function (r) {
          return r != null && (r.id || r.rating != null || r.text);
        });
    } catch (e) {
      var msg = String((e && e.message) || "");
      if (/404|not found|Cannot GET/i.test(msg)) {
        return [];
      }
      throw e;
    }
  }

  /**
   * AI price suggestion from brand, productName, material, condition (new|used).
   * Requires login (Bearer token). Returns { minPrice, maxPrice, suggestedPrice?, currency, reason }.
   */
  async function suggestListingPrice(fields) {
    var body = await apiRequest("POST", suggestPricePath(), {
      brand: fields.brand,
      productName: fields.productName || fields.name,
      name: fields.productName || fields.name,
      material: fields.material,
      condition: fields.condition,
      currency: fields.currency || "EGP",
    });
    var suggestion = unwrapPriceSuggestion(body);
    if (!suggestion) {
      throw new Error("Could not read price suggestion from the API.");
    }
    return suggestion;
  }

  async function createProductListing(payload, imageBlobs) {
    var useMultipart =
      typeof API_PRODUCTS_USE_MULTIPART === "undefined" ||
      API_PRODUCTS_USE_MULTIPART;
    if (
      useMultipart &&
      imageBlobs &&
      Array.isArray(imageBlobs) &&
      imageBlobs.length > 0
    ) {
      return apiRequestMultipart("POST", productsPath(), payload, imageBlobs);
    }
    return apiRequest("POST", productsPath(), payload);
  }

  function adminPendingProductsPath() {
    return typeof API_ADMIN_PENDING_PRODUCTS_PATH !== "undefined"
      ? API_ADMIN_PENDING_PRODUCTS_PATH
      : "/api/products/admin/pending";
  }

  async function fetchAdminPendingListings() {
    var data = await apiRequest("GET", adminPendingProductsPath());
    var wrap = data && data.data ? data.data : data;
    var rows = wrap.products || wrap.items || [];
    if (!Array.isArray(rows)) return [];
    var norm =
      typeof window.__normalizeUiProduct === "function"
        ? window.__normalizeUiProduct
        : function (d) {
            return d;
          };
    return rows.map(norm).filter(Boolean);
  }

  async function approveProductListing(productId) {
    var id = encodeURIComponent(String(productId));
    return apiRequest("PATCH", productsPath() + "/" + id + "/approve");
  }

  async function updateProductStatus(productId, status) {
    var id = encodeURIComponent(String(productId));
    return apiRequest("PATCH", productsPath() + "/" + id, { status: status });
  }

  async function deleteProduct(productId) {
    var id = encodeURIComponent(String(productId));
    return apiRequest("DELETE", productsPath() + "/" + id);
  }

  function formatShippingAddress(shippingAddress) {
    if (!shippingAddress) return "";
    if (typeof shippingAddress === "string") return String(shippingAddress).trim();
    var city = shippingAddress.city;
    if (city === "cairo") city = "Cairo";
    else if (city === "giza") city = "Giza";
    else if (city) city = String(city);
    var parts = [
      shippingAddress.street,
      shippingAddress.apartment,
      shippingAddress.region,
      city,
      shippingAddress.phone,
    ].filter(function (p) {
      return p != null && String(p).trim() !== "";
    });
    return parts.join(", ");
  }

  async function fetchStripePublishableKey() {
    try {
      var body = await apiRequest("GET", paymentsPath() + "/stripe/config");
      var data = body && body.data ? body.data : body;
      return data && data.publishableKey ? String(data.publishableKey).trim() : "";
    } catch (_) {
      return "";
    }
  }

  async function createCashPayment(orderId) {
    return apiRequest("POST", paymentsPath() + "/cash", {
      orderId: String(orderId),
    });
  }

  async function createStripePayment(orderId) {
    var body = await apiRequest("POST", paymentsPath() + "/stripe", {
      orderId: String(orderId),
    });
    var data = body && body.data ? body.data : body;
    return {
      clientSecret: data && data.clientSecret,
      transactionId:
        data && data.payment && data.payment.transactionId
          ? data.payment.transactionId
          : "",
      payment: data && data.payment,
    };
  }

  async function confirmStripePayment(transactionId) {
    return apiRequest("POST", paymentsPath() + "/stripe/confirm", {
      transactionId: String(transactionId),
    });
  }

  async function placeOrder(orderPayload) {
    var address =
      (orderPayload && orderPayload.address) ||
      formatShippingAddress(orderPayload && orderPayload.shippingAddress);
    if (!address) {
      throw new Error("Delivery address is required");
    }

    try {
      return await apiRequest("POST", cartPath() + "/checkout", { address: address });
    } catch (checkoutErr) {
      var items = (orderPayload && orderPayload.items) || [];
      var products = items
        .map(function (item) {
          var pid = item.id || item.productId;
          if (!pid) return null;
          return { productId: String(pid), quantity: item.quantity || 1 };
        })
        .filter(Boolean);
      if (!products.length) throw checkoutErr;
      return apiRequest("POST", ordersPath(), { address: address, products: products });
    }
  }

  window.getCartItems = getCartItems;
  window.addProductToCart = addProductToCart;
  window.removeCartLine = removeCartLine;
  window.clearServerCart = clearServerCart;

  window.getWishlistItems = getWishlistItems;
  window.addProductToWishlist = addProductToWishlist;
  window.removeWishlistLine = removeWishlistLine;

  window.getMyReviews = getMyReviews;
  window.getSellerReviews = getSellerReviews;
  window.getSellerRating = getSellerRating;

  window.suggestListingPrice = suggestListingPrice;
  window.createProductListing = createProductListing;
  window.fetchAdminPendingListings = fetchAdminPendingListings;
  window.approveProductListing = approveProductListing;
  window.updateProductStatus = updateProductStatus;
  window.deleteProduct = deleteProduct;
  window.placeOrder = placeOrder;
  window.extractOrderId = extractOrderId;
  window.getMyOrders = getMyOrders;
  window.getOrderById = getOrderById;
  window.getAllOrdersAdmin = getAllOrdersAdmin;
  window.approveOrderAdmin = approveOrderAdmin;
  window.rejectOrderAdmin = rejectOrderAdmin;
  window.updateOrderStatusAdmin = updateOrderStatusAdmin;
  window.getReviewablePurchases = getReviewablePurchases;
  window.submitSellerReview = submitSellerReview;
  window.fetchStripePublishableKey = fetchStripePublishableKey;
  window.createCashPayment = createCashPayment;
  window.createStripePayment = createStripePayment;
  window.confirmStripePayment = confirmStripePayment;
})();
