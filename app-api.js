(function () {
  function base() {
    if (typeof API_BASE === "undefined" || !API_BASE) {
      throw new Error("Missing API_BASE — load config.js first");
    }
    return String(API_BASE).replace(/\/$/, "");
  }

  function productsPath() {
    return typeof API_PRODUCTS_PATH !== "undefined"
      ? API_PRODUCTS_PATH
      : "/api/products";
  }

  function ordersPath() {
    return typeof API_ORDERS_PATH !== "undefined"
      ? API_ORDERS_PATH
      : "/api/orders";
  }

  function cartPath() {
    return typeof API_CART_PATH !== "undefined"
      ? API_CART_PATH
      : "/api/cart";
  }

  /** POST body target — default /api/cart/add */
  function cartAddPath() {
    if (typeof API_CART_ADD_PATH !== "undefined") return API_CART_ADD_PATH;
    return cartPath() + "/add";
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
    return wishlistPath() + "/add";
  }

  function wishlistRemovePath() {
    if (typeof API_WISHLIST_REMOVE_PATH !== "undefined")
      return API_WISHLIST_REMOVE_PATH;
    return wishlistPath() + "/remove";
  }

  function readStoredBearerToken() {
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
    if (!res.ok || data.status === "error") {
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

  async function apiRequest(method, path, bodyObj) {
    var headers = Object.assign({}, authHeaders());
    var opts = { method: method, headers: headers };
    if (bodyObj !== undefined && bodyObj !== null) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(bodyObj);
    }
    var res = await fetch(base() + path, opts);
    var text = await res.text();
    return handleApiResponse(res, text);
  }

  async function apiRequestMultipart(method, path, fields, blobs) {
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
    var res = await fetch(base() + path, {
      method: method,
      headers: headers,
      body: fd,
    });
    var text = await res.text();
    return handleApiResponse(res, text);
  }

  function unwrapCartPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data.items)) return data.items;
    if (data.cart && Array.isArray(data.cart.items)) return data.cart.items;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.cartItems && Array.isArray(data.cartItems)) return data.cartItems;
    return [];
  }

  function unwrapWishlistPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
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
    if (v == null || v === "") return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "object") {
      if (typeof v.url === "string") return v.url.trim();
      if (typeof v.secure_url === "string") return v.secure_url.trim();
    }
    return "";
  }

  function normalizeCartLine(row) {
    if (!row || typeof row !== "object") return null;
    var p = row.product;
    if (p && typeof p === "object") {
      var img = "";
      if (Array.isArray(p.images) && p.images.length)
        img = coerceImg(p.images[0]);
      else img = coerceImg(p.image);
      return {
        id: String(p.id != null ? p.id : p._id || ""),
        _lineId: String(row._id != null ? row._id : row.id || ""),
        name: p.name || "Item",
        price: p.price != null ? p.price : row.price,
        image: img,
        color: p.color != null ? p.color : "-",
        size: p.size != null ? p.size : "-",
      };
    }
    return {
      id: String(row.productId != null ? row.productId : row.id || ""),
      _lineId: String(row._id != null ? row._id : row.cartItemId || ""),
      name: row.name || "Item",
      price: row.price,
      image: coerceImg(row.image),
      color: row.color || "-",
      size: row.size || "-",
    };
  }

  async function getCartItems() {
    var data = await apiRequest("GET", cartPath());
    var rows = unwrapCartPayload(data);
    return rows
      .map(normalizeCartLine)
      .filter(function (r) {
        return r && r.id;
      });
  }

  async function addProductToCart(product) {
    if (!product || !product.id) throw new Error("Invalid product");
    var payload = {
      productId: String(product.id),
      quantity: 1,
    };
    return apiRequest("POST", cartAddPath(), payload);
  }

  async function removeCartLine(lineId, productId) {
    var pid = String(productId || "");
    var lid = lineId != null ? String(lineId) : "";
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
    if (!product || !product.id) throw new Error("Invalid product");
    var payload = { productId: String(product.id) };
    return apiRequest("POST", wishlistAddPath(), payload);
  }

  async function removeWishlistLine(lineId, productId) {
    var pid = String(productId || "");
    var lid = lineId != null ? String(lineId) : "";
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

  function userReviewsPath() {
    return typeof API_USER_REVIEWS_PATH !== "undefined"
      ? API_USER_REVIEWS_PATH
      : "/api/users/me/reviews";
  }

  function unwrapReviewsPayload(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data.reviews)) return data.reviews;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function normalizeReview(row) {
    if (!row || typeof row !== "object") return null;
    var product =
      row.product && typeof row.product === "object" ? row.product : null;
    var pid = product
      ? String(product._id != null ? product._id : product.id || "")
      : String(
          row.productId != null ? row.productId : row.product_id || ""
        );
    var pname = product
      ? String(product.name || product.title || "").trim()
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
    var otherParty =
      typeof row.fromUser === "object" &&
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
        : String(row.reviewerName || row.fromName || "").trim();
    return {
      id: id,
      rating: Number.isFinite(rating) ? rating : null,
      text: text,
      productId: pid,
      productName: pname || (pid ? "Product" : ""),
      createdAt: at,
      reviewerLabel: otherParty,
    };
  }

  /** GET auth user's reviews — [] if backend has none or returns unparsable (still throws on auth/network hard failures handled by caller). */
  async function getMyReviews() {
    var data = await apiRequest("GET", userReviewsPath());
    var rows = unwrapReviewsPayload(data);
    return rows
      .map(normalizeReview)
      .filter(function (r) {
        return r != null && (r.text || r.rating != null || r.productName || r.reviewerLabel);
      });
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

  async function updateProductStatus(productId, status) {
    var id = encodeURIComponent(String(productId));
    return apiRequest("PATCH", productsPath() + "/" + id, { status: status });
  }

  async function deleteProduct(productId) {
    var id = encodeURIComponent(String(productId));
    return apiRequest("DELETE", productsPath() + "/" + id);
  }

  async function placeOrder(orderPayload) {
    return apiRequest("POST", ordersPath(), orderPayload);
  }

  window.getCartItems = getCartItems;
  window.addProductToCart = addProductToCart;
  window.removeCartLine = removeCartLine;
  window.clearServerCart = clearServerCart;

  window.getWishlistItems = getWishlistItems;
  window.addProductToWishlist = addProductToWishlist;
  window.removeWishlistLine = removeWishlistLine;

  window.getMyReviews = getMyReviews;

  window.createProductListing = createProductListing;
  window.updateProductStatus = updateProductStatus;
  window.deleteProduct = deleteProduct;
  window.placeOrder = placeOrder;
})();
