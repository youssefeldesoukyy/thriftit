(function () {
  function coerceId(raw) {
    if (raw == null) return "";
    if (typeof raw === "string" || typeof raw === "number")
      return String(raw).trim();
    if (typeof raw === "object") {
      if (raw.$oid) return String(raw.$oid);
      if (typeof raw.toHexString === "function") return raw.toHexString();
    }
    return "";
  }

  function looksLikeProductRow(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return !!(
      item._id ||
      item.id ||
      item.name ||
      item.title ||
      item.price != null
    );
  }

  function scoreArrayAsProducts(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    var n = 0;
    for (var i = 0; i < Math.min(arr.length, 8); i++) {
      if (looksLikeProductRow(arr[i])) n++;
    }
    return n;
  }

  function findBestNestedProductArray(root, depth, best) {
    best = best || { arr: null, score: 0 };
    if (depth > 10 || root == null) return best;
    if (Array.isArray(root)) {
      var sc = scoreArrayAsProducts(root);
      if (sc > 0 && sc > best.score) {
        best.score = sc;
        best.arr = root;
      }
      return best;
    }
    if (typeof root !== "object") return best;
    for (var key in root) {
      if (!Object.prototype.hasOwnProperty.call(root, key)) continue;
      findBestNestedProductArray(root[key], depth + 1, best);
    }
    return best;
  }

  function unwrapProducts(payload, depth) {
    depth = depth || 0;
    if (payload == null) return [];
    if (Array.isArray(payload)) return payload;
    if (typeof payload !== "object") return [];
    if (depth > 8) return [];

    var keyOrder = [
      "products",
      "productList",
      "items",
      "data",
      "result",
      "results",
      "records",
      "list",
      "body",
      "rows",
      "documents",
      "payload",
      "content",
      "catalog",
    ];
    var ki,
      k,
      v,
      inner;
    for (ki = 0; ki < keyOrder.length; ki++) {
      k = keyOrder[ki];
      if (!Object.prototype.hasOwnProperty.call(payload, k)) continue;
      v = payload[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        inner = unwrapProducts(v, depth + 1);
        if (inner.length) return inner;
      }
    }

    var vals = Object.values(payload);
    for (ki = 0; ki < vals.length; ki++) {
      v = vals[ki];
      if (
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === "object" &&
        v[0] !== null &&
        !Array.isArray(v[0])
      ) {
        return v;
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        inner = unwrapProducts(v, depth + 1);
        if (inner.length) return inner;
      }
    }

    var guessed = findBestNestedProductArray(payload, 0, null);
    if (guessed && guessed.arr && guessed.arr.length) return guessed.arr;

    return [];
  }

  /** Shop pages: hide only seller-style pending/rejected drafts; API items without status still show */
  function coerceImageUrl(v) {
    if (v == null || v === "") return "";
    if (typeof v === "string") {
      var s = v.trim();
      if (
        s &&
        s.charAt(0) === "/" &&
        s.slice(0, 2) !== "//" &&
        typeof API_BASE === "string" &&
        /^https?:\/\//i.test(API_BASE)
      )
        return API_BASE.replace(/\/$/, "") + s;
      return s;
    }
    if (typeof v === "object") {
      var u =
        typeof v.url === "string"
          ? v.url
          : typeof v.secure_url === "string"
            ? v.secure_url
            : typeof v.path === "string"
              ? v.path
              : typeof v.src === "string"
                ? v.src
                : typeof v.href === "string"
                  ? v.href
                  : "";
      return typeof u === "string" ? u.trim() : "";
    }
    return "";
  }

  function collectImagesFromDoc(doc) {
    var out = [];
    function pushMaybe(val) {
      if (val == null) return;
      if (Array.isArray(val)) {
        for (var i = 0; i < val.length; i++) {
          var url = coerceImageUrl(val[i]);
          if (url) out.push(url);
        }
        return;
      }
      var one = coerceImageUrl(val);
      if (one) out.push(one);
    }
    pushMaybe(doc.images);
    pushMaybe(doc.image);
    pushMaybe(doc.imageUrl);
    pushMaybe(doc.photo);
    pushMaybe(doc.photos);
    pushMaybe(doc.pictures);
    return out;
  }

  function isProductListedOnShop(product) {
    if (!product) return false;
    var s = (
      product.status != null ? String(product.status) : ""
    ).toLowerCase().trim();
    if (s === "pending" || s === "rejected" || s === "draft") return false;
    return true;
  }

  function normalizeUiProduct(doc) {
    if (!doc || typeof doc !== "object") return null;
    var id =
      coerceId(doc.id) ||
      coerceId(doc._id) ||
      coerceId(doc.productId) ||
      coerceId(doc.sku) ||
      coerceId(doc.product_id);
    if (!id) return null;
    var images = collectImagesFromDoc(doc);
    if (images.length === 0 && id)
      images = [
        "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23222" width="100%" height="100%"/></svg>'
          ),
      ];

    var rawStatus =
      doc.status != null
        ? doc.status
        : doc.approvalStatus != null
          ? doc.approvalStatus
          : "";
    var status =
      rawStatus !== "" ? String(rawStatus).toLowerCase().trim() : "approved";

    var category = doc.category != null ? String(doc.category) : "";
    var gender = doc.gender != null ? String(doc.gender) : "";

    return {
      id: id,
      name:
        doc.name != null
          ? doc.name
          : doc.title != null
            ? doc.title
            : doc.productName != null
              ? doc.productName
              : doc.product_name != null
                ? doc.product_name
                : "Untitled",
      price:
        doc.price != null
          ? doc.price
          : doc.priceEGP != null
            ? doc.priceEGP
            : doc.amount != null
              ? doc.amount
              : "",
      color: doc.color != null ? doc.color : "-",
      size: doc.size != null ? doc.size : "-",
      condition:
        doc.condition != null ? doc.condition : doc.state != null ? doc.state : "Good",
      category: category,
      gender: gender,
      images: images,
      status: status,
      email:
        doc.email != null
          ? String(doc.email)
          : doc.sellerEmail != null
            ? String(doc.sellerEmail)
            : "",
      sellerEmail:
        doc.sellerEmail != null ? String(doc.sellerEmail) : "",
    };
  }

  async function fetchProductsFromBackend() {
    if (typeof API_BASE === "undefined") {
      throw new Error("API_BASE is missing (load config.js before products-api.js)");
    }
    var productsPath =
      typeof API_PRODUCTS_PATH !== "undefined"
        ? API_PRODUCTS_PATH
        : "/api/products";
    var url = String(API_BASE).replace(/\/$/, "") + productsPath;
    var fetchOpts = { method: "GET" };
    try {
      var raw =
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("jwt");
      var tok =
        raw && typeof raw === "string"
          ? raw.trim()
          : "";
      if (
        tok &&
        tok.toLowerCase().indexOf("bearer ") === 0
      ) {
        tok = tok.slice(7).trim();
      }
      if (tok) {
        fetchOpts.headers = { Authorization: "Bearer " + tok };
      }
    } catch (_) {}
    // If login uses cookies, turn this on AND set CORS to credentials + exact origin:
    // fetchOpts.credentials = "include";
    var res = await fetch(url, fetchOpts);
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var payload;
    try {
      if (ct.includes("application/json"))
        payload = await res.json();
      else payload = JSON.parse(await res.text());
    } catch (parseErr) {
      throw new Error(
        "/api/products did not return JSON (status " +
          res.status +
          "). Is the backend URL correct?"
      );
    }

    if (payload != null && payload.status === "error") {
      console.warn("[products-api] API error:", payload.message || payload);
      return [];
    }

    if (!res.ok) {
      console.warn("[products-api] HTTP", res.status, payload);
      return [];
    }

    var rows = unwrapProducts(payload)
      .map(normalizeUiProduct)
      .filter(Boolean);

    if (rows.length === 0 && !Array.isArray(payload)) {
      console.warn(
        "[products-api] Parsed 0 products. Top-level keys:",
        payload && typeof payload === "object"
          ? Object.keys(payload)
          : payload
      );
      try {
        console.warn(
          "[products-api] Response snippet:",
          JSON.stringify(payload).slice(0, 1200)
        );
      } catch (stringifyErr) {
        console.warn("[products-api] (could not stringify response)");
      }
    }

    return rows;
  }

  async function fetchProductsMerged() {
    var remote = [];
    try {
      remote = await fetchProductsFromBackend();
    } catch (e) {
      console.warn("[products-api] backend:", e.message);
    }
    var rawLocal = [];
    try {
      rawLocal = JSON.parse(localStorage.getItem("products")) || [];
    } catch (err) {
      rawLocal = [];
    }
    var local = rawLocal.map(normalizeUiProduct).filter(Boolean);

    var seen = {};
    var merged = [];

    remote.forEach(function (p) {
      var sid = String(p.id);
      if (!sid || seen[sid]) return;
      seen[sid] = true;
      merged.push(p);
    });

    local.forEach(function (p) {
      var sid = String(p.id || "");
      if (!sid || seen[sid]) return;
      seen[sid] = true;
      merged.push(p);
    });

    return merged;
  }

  window.isProductListedOnShop = isProductListedOnShop;
  window.__unwrapProductsPayload = unwrapProducts;
  window.__normalizeUiProduct = normalizeUiProduct;
  window.fetchProductsFromBackend = fetchProductsFromBackend;
  window.fetchProductsMerged = fetchProductsMerged;
})();
