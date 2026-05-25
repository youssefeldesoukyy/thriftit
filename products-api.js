(function () {
  function isNetworkFetchFailure(err) {
    return (
      err &&
      (err.name === "TypeError" ||
        /failed to fetch|networkerror|load failed/i.test(
          String(err.message || "")
        ))
    );
  }

  function networkFetchMessage() {
    var base =
      typeof thriftitApiBase === "function"
        ? thriftitApiBase()
        : typeof API_BASE !== "undefined" && API_BASE
          ? API_BASE
          : "http://localhost:4000";
    if (/:5173(\/|$)/.test(base)) {
      base = "http://localhost:4000";
    }
    var lines = [
      "Cannot reach the backend at " + base + ".",
      "• Start the API on port 4000 (see config.js API_BASE).",
      "• Open the site at http://localhost:5173 (run npm start), not file://.",
    ];
    if (
      typeof location !== "undefined" &&
      location.protocol === "file:"
    ) {
      lines.push(
        "• You are on file:// — use npm start, or set ALLOW_FILE_ORIGIN_CORS=true in the backend .env."
      );
    }
    return lines.join(" ");
  }

  function authHeadersForFetch() {
    var h = {};
    if (typeof storedAuthToken !== "function") return h;
    var tok = String(storedAuthToken() || "").trim();
    if (tok.toLowerCase().indexOf("bearer ") === 0) {
      tok = tok.slice(7).trim();
    }
    if (tok) h.Authorization = "Bearer " + tok;
    return h;
  }

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

  /**
   * Backend (lama1606/node-js-project) stores ProductImage.imageURL as a filename
   * and serves files at GET {API_BASE}/uploads/{filename}.
   */
  function resolveProductImageUrl(v) {
    if (v == null || v === "") return "";
    var s = "";
    if (typeof v === "string") {
      s = v.trim();
    } else if (typeof v === "object") {
      s = (
        (typeof v.imageURL === "string" && v.imageURL) ||
        (typeof v.imageUrl === "string" && v.imageUrl) ||
        (typeof v.url === "string" && v.url) ||
        (typeof v.secure_url === "string" && v.secure_url) ||
        (typeof v.path === "string" && v.path) ||
        (typeof v.src === "string" && v.src) ||
        (typeof v.href === "string" && v.href) ||
        ""
      ).trim();
    }
    if (!s) return "";
    if (/^data:image\//i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    var apiRoot =
      typeof thriftitApiBase === "function"
        ? thriftitApiBase()
        : typeof API_BASE === "string"
          ? API_BASE.replace(/\/$/, "")
          : "";
    if (apiRoot === "" && s) {
      var directBase =
        typeof API_BASE === "string" && API_BASE
          ? String(API_BASE).replace(/\/$/, "")
          : "http://localhost:4000";
      var path;
      if (s.charAt(0) === "/") {
        path = s;
      } else if (/^uploads\//i.test(s)) {
        path = "/" + s.replace(/^\/+/, "");
      } else {
        path = "/uploads/" + s.replace(/^\/+/, "");
      }
      return directBase + path;
    }
    if (typeof API_BASE === "string" && /^https?:\/\//i.test(API_BASE)) {
      var base = API_BASE.replace(/\/$/, "");
      if (s.charAt(0) === "/") return base + s;
      if (/^uploads\//i.test(s)) return base + "/" + s.replace(/^\/+/, "");
      return base + "/uploads/" + s.replace(/^\/+/, "");
    }
    return s;
  }

  function coerceImageUrl(v) {
    return resolveProductImageUrl(v);
  }

  function uniqueImageUrls(urls) {
    var out = [];
    var seen = {};
    (urls || []).forEach(function (u) {
      var url = String(u || "").trim();
      if (!url || seen[url]) return;
      seen[url] = true;
      out.push(url);
    });
    return out;
  }

  function collectImagesFromDoc(doc) {
    var out = [];
    var seen = {};
    function addUrl(url) {
      if (!url || seen[url]) return;
      seen[url] = true;
      out.push(url);
    }
    function pushMaybe(val) {
      if (val == null) return;
      if (Array.isArray(val)) {
        for (var i = 0; i < val.length; i++) {
          addUrl(coerceImageUrl(val[i]));
        }
        return;
      }
      addUrl(coerceImageUrl(val));
    }
    if (Array.isArray(doc.images) && doc.images.length) {
      pushMaybe(doc.images);
    } else {
      pushMaybe(doc.image);
      pushMaybe(doc.imageUrl);
      pushMaybe(doc.photo);
      pushMaybe(doc.photos);
      pushMaybe(doc.pictures);
    }
    return out;
  }

  function isProductListedOnShop(product) {
    if (!product) return false;
    var s = (
      product.status != null ? String(product.status) : ""
    ).toLowerCase().trim();
    if (
      s === "pending" ||
      s === "rejected" ||
      s === "draft" ||
      s === "sold" ||
      s === "reserved"
    ) {
      return false;
    }
    return true;
  }

  /** Shop-facing labels for the 8 home/seller categories. */
  function formatCategoryDisplayName(value) {
    var key = categorySlug(value);
    if (!key) return "";
    var labels = {
      jackets: "Jackets",
      shirts: "Shirts",
      tshirts: "Tshirts",
      sweatshirts: "Sweatshirts",
      bottoms: "Bottoms",
      pants: "Bottoms",
      pant: "Bottoms",
      bottom: "Bottoms",
      dresses: "Dresses",
      tops: "Tops",
      accessories: "Accessories",
      accessory: "Accessories",
      bags: "Accessories",
      bag: "Accessories",
      shoes: "Accessories",
      shoe: "Accessories",
    };
    if (labels[key]) return labels[key];
    return String(value || "")
      .trim()
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  /** Normalize category labels for comparison (jackets, sweatshirts, …). */
  function categorySlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }

  function categorySlugVariants(typeParam) {
    var s = categorySlug(typeParam);
    if (!s) return [];
    var set = [s];
    if (s.length > 3 && s.endsWith("s")) {
      var singular = s.slice(0, -1);
      if (set.indexOf(singular) < 0) set.push(singular);
    } else if (s && set.indexOf(s + "s") < 0) {
      set.push(s + "s");
    }
    var aliasGroups = {
      jacket: ["jacket", "jackets"],
      jackets: ["jacket", "jackets"],
      shirt: ["shirt", "shirts"],
      shirts: ["shirt", "shirts"],
      tshirt: ["tshirt", "tshirts"],
      tshirts: ["tshirt", "tshirts"],
      top: ["top", "tops"],
      tops: ["top", "tops"],
      accessory: ["accessories", "accessory"],
      accessories: ["accessories", "accessory"],
      dress: ["dress", "dresses"],
      dresses: ["dress", "dresses"],
      bottom: ["bottom", "bottoms", "pants", "pant"],
      bottoms: ["bottom", "bottoms", "pants", "pant"],
      pants: ["bottom", "bottoms", "pants", "pant"],
      pant: ["bottom", "bottoms", "pants", "pant"],
      sweatshirt: ["sweatshirt", "sweatshirts"],
      sweatshirts: ["sweatshirt", "sweatshirts"],
    };
    var extra = aliasGroups[s];
    if (extra) {
      extra.forEach(function (a) {
        if (set.indexOf(a) < 0) set.push(a);
      });
    }
    return set;
  }

  /** Match home/category links (?type=Jackets) to API subcategory (e.g. jackets). */
  function productMatchesCategoryType(product, typeParam) {
    if (!product || !typeParam) return false;
    var want = categorySlugVariants(typeParam);
    if (!want.length) return false;
    var fields = [
      product.subcategory,
      product.category,
      product.categoryDisplay,
      product.productCategory,
    ];
    for (var i = 0; i < fields.length; i++) {
      var slug = categorySlug(fields[i]);
      if (slug && want.indexOf(slug) >= 0) return true;
    }
    return false;
  }

  /** Display label for stored size codes (m → Medium, l → Large, shoe numbers unchanged). */
  function formatProductSize(size) {
    if (size == null) return "—";
    var s = String(size).trim();
    if (!s || s === "-") return "—";
    if (/^\d+$/.test(s)) return s;
    var key = s.toLowerCase().replace(/[\s._+\-]+/g, "");
    var labels = {
      xs: "Extra Small",
      xsmall: "Extra Small",
      extrasmall: "Extra Small",
      s: "Small",
      small: "Small",
      m: "Medium",
      medium: "Medium",
      l: "Large",
      large: "Large",
      xl: "Extra Large",
      xlarge: "Extra Large",
      extralarge: "Extra Large",
      xxl: "XXL",
      "2xl": "XXL",
      xxxl: "XXXL",
      "3xl": "XXXL",
      onesize: "One size",
      os: "One size",
    };
    if (labels[key]) return labels[key];
    return s;
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
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
              '<rect fill="%23e8e4dc" width="100%" height="100%"/>' +
              '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
              'fill="%235a5345" font-family="sans-serif" font-size="18">No photo</text></svg>'
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
    if (
      doc.isApproved === false ||
      doc.isApproved === "false" ||
      doc.approved === false
    ) {
      status = "pending";
    }

    var category = doc.category != null ? String(doc.category) : "";
    if (!category && doc.productCategory != null) {
      category = String(doc.productCategory);
    }
    var gender =
      doc.gender != null ? String(doc.gender).trim().toLowerCase() : "";

    /** Subcategory only (e.g. Jackets), not Men/Women parent section */
    var subcategory = "";
    if (doc.categoryId && typeof doc.categoryId === "object") {
      if (doc.categoryId.categoryName != null) {
        subcategory = String(doc.categoryId.categoryName).trim();
      }
    }
    if (!subcategory && doc.subcategoryName != null) {
      subcategory = String(doc.subcategoryName).trim();
    }
    if (!subcategory && category) {
      subcategory = category.replace(/[-_]/g, " ").trim();
    }
    if (!category && subcategory) {
      category = subcategory;
    }
    var categoryDisplay = formatCategoryDisplayName(subcategory || category);

    var description =
      doc.description != null
        ? String(doc.description).trim()
        : doc.richDescription != null
          ? String(doc.richDescription).trim()
          : "";

    var sellerUser =
      doc.userId && typeof doc.userId === "object" ? doc.userId : null;
    var sellerId = sellerUser
      ? coerceId(sellerUser._id) || coerceId(sellerUser.id) || ""
      : coerceId(doc.userId) || "";
    var sellerFirst =
      sellerUser && sellerUser.firstName != null
        ? String(sellerUser.firstName).trim()
        : "";
    var sellerLast =
      sellerUser && sellerUser.lastName != null
        ? String(sellerUser.lastName).trim()
        : "";
    var sellerName = [sellerFirst, sellerLast].filter(Boolean).join(" ").trim();
    if (!sellerName && doc.sellerName != null) {
      sellerName = String(doc.sellerName).trim();
    }

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
                : description
                  ? description.slice(0, 80)
                  : "Untitled",
      description: description,
      brand: doc.brand != null ? String(doc.brand).trim() : "",
      material: doc.material != null ? String(doc.material).trim() : "",
      price:
        doc.price != null
          ? doc.price
          : doc.priceEGP != null
            ? doc.priceEGP
            : doc.amount != null
              ? doc.amount
              : "",
      color: doc.color != null ? doc.color : "-",
      size: formatProductSize(doc.size != null ? doc.size : "-"),
      sizeCode: doc.size != null ? String(doc.size).trim() : "",
      condition:
        doc.condition != null ? doc.condition : doc.state != null ? doc.state : "Good",
      category: category,
      subcategory: subcategory,
      categoryDisplay: categoryDisplay,
      gender: gender,
      images: images,
      status: status,
      sellerId: sellerId,
      sellerName: sellerName,
      email:
        doc.email != null
          ? String(doc.email)
          : sellerUser && sellerUser.email != null
            ? String(sellerUser.email)
            : doc.sellerEmail != null
              ? String(doc.sellerEmail)
              : "",
      sellerEmail:
        sellerUser && sellerUser.email != null
          ? String(sellerUser.email)
          : doc.sellerEmail != null
            ? String(doc.sellerEmail)
            : "",
      createdAt:
        doc.createdAt != null
          ? doc.createdAt
          : doc.created_at != null
            ? doc.created_at
            : "",
      updatedAt:
        doc.updatedAt != null
          ? doc.updatedAt
          : doc.updated_at != null
            ? doc.updated_at
            : "",
    };
  }

  function productSortTime(p) {
    if (!p || typeof p !== "object") return 0;
    var t = p.createdAt || p.updatedAt;
    if (t) {
      var ms = Date.parse(t);
      if (!Number.isNaN(ms)) return ms;
    }
    return 0;
  }

  function sortProductsNewestFirst(list) {
    return list.slice().sort(function (a, b) {
      var tb = productSortTime(b);
      var ta = productSortTime(a);
      if (tb !== ta) return tb - ta;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

  async function fetchProductsPage(apiRoot, productsPath, page, limit, fetchOpts) {
    var sep = productsPath.indexOf("?") >= 0 ? "&" : "?";
    var url =
      apiRoot +
      productsPath +
      sep +
      "limit=" +
      encodeURIComponent(String(limit)) +
      "&page=" +
      encodeURIComponent(String(page));
    var res;
    try {
      res = await fetch(url, fetchOpts);
    } catch (fetchErr) {
      if (isNetworkFetchFailure(fetchErr)) {
        throw new Error(networkFetchMessage());
      }
      throw fetchErr;
    }
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var payload;
    try {
      if (ct.includes("application/json")) payload = await res.json();
      else payload = JSON.parse(await res.text());
    } catch (parseErr) {
      throw new Error(
        "/api/products did not return JSON (status " +
          res.status +
          "). Is the backend URL correct?"
      );
    }

    if (payload != null && payload.status === "error") {
      return [];
    }

    if (!res.ok) {
      return [];
    }

    return unwrapProducts(payload).map(normalizeUiProduct).filter(Boolean);
  }

  async function fetchProductsFromBackend() {
    if (
      typeof THRIFTIT_STATIC_DESIGN_ONLY !== "undefined" &&
      THRIFTIT_STATIC_DESIGN_ONLY
    ) {
      return [];
    }
    if (typeof API_BASE === "undefined") {
      throw new Error("API_BASE is missing (load config.js before products-api.js)");
    }
    var productsPath =
      typeof API_PRODUCTS_PATH !== "undefined"
        ? API_PRODUCTS_PATH
        : "/api/products";
    var apiRoot =
      typeof thriftitApiBase === "function"
        ? thriftitApiBase()
        : String(API_BASE).replace(/\/$/, "");
    var fetchOpts = { method: "GET", headers: authHeadersForFetch() };
    // Backend defaults to limit=10 per page — load every page so new listings appear in Shop All.
    var pageLimit = 50;
    var page = 1;
    var rows = [];
    var seenIds = {};
    var safetyMaxPages = 40;

    while (page <= safetyMaxPages) {
      var batch = await fetchProductsPage(
        apiRoot,
        productsPath,
        page,
        pageLimit,
        fetchOpts
      );
      if (!batch.length) break;
      batch.forEach(function (p) {
        var sid = String(p.id || "");
        if (!sid || seenIds[sid]) return;
        seenIds[sid] = true;
        rows.push(p);
      });
      if (batch.length < pageLimit) break;
      page += 1;
    }

    return sortProductsNewestFirst(rows);
  }

  async function fetchProductById(id) {
    var pid = coerceId(id);
    if (!pid) return null;
    if (
      typeof THRIFTIT_STATIC_DESIGN_ONLY !== "undefined" &&
      THRIFTIT_STATIC_DESIGN_ONLY
    ) {
      return null;
    }
    if (typeof API_BASE === "undefined") {
      throw new Error("API_BASE is missing (load config.js before products-api.js)");
    }
    var productsPath =
      typeof API_PRODUCTS_PATH !== "undefined"
        ? API_PRODUCTS_PATH
        : "/api/products";
    var apiRoot =
      typeof thriftitApiBase === "function"
        ? thriftitApiBase()
        : String(API_BASE).replace(/\/$/, "");
    var url = apiRoot + productsPath + "/" + encodeURIComponent(pid);
    var fetchOpts = { method: "GET", headers: authHeadersForFetch() };
    var res;
    try {
      res = await fetch(url, fetchOpts);
    } catch (fetchErr) {
      if (isNetworkFetchFailure(fetchErr)) {
        throw new Error(networkFetchMessage());
      }
      throw fetchErr;
    }
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    var payload;
    try {
      if (ct.includes("application/json")) payload = await res.json();
      else payload = JSON.parse(await res.text());
    } catch (parseErr) {
      return null;
    }
    if (
      !res.ok ||
      payload.status === "error" ||
      String(payload.status || "").toUpperCase() === "FAIL"
    ) {
      return null;
    }
    var doc =
      payload.data && payload.data.product
        ? payload.data.product
        : payload.product || payload.data;
    return normalizeUiProduct(doc);
  }

  async function fetchProductsMerged() {
    var remote = [];
    try {
      remote = await fetchProductsFromBackend();
    } catch (e) {
      if (
        !(typeof THRIFTIT_STATIC_DESIGN_ONLY !== "undefined" &&
          THRIFTIT_STATIC_DESIGN_ONLY)
      ) {
        throw e;
      }
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

    return sortProductsNewestFirst(merged);
  }

  function formatShopCardTitle(product) {
    if (!product) return "—";
    var labeled =
      (product.categoryDisplay && String(product.categoryDisplay).trim()) ||
      formatCategoryDisplayName(product.subcategory || product.category);
    return labeled || "—";
  }

  function formatShopCardValue(val) {
    if (val == null || String(val).trim() === "") return "—";
    var s = String(val).trim();
    return typeof escapeHtml === "function" ? escapeHtml(s) : s;
  }

  function productMatchesGender(product, genders) {
    if (!genders || !genders.length) return true;
    var g = String(product.gender || "").trim().toLowerCase();
    return genders.indexOf(g) !== -1;
  }

  function productPassesShopFilter(product, opts) {
    if (!isProductListedOnShop(product)) return false;
    if (!productMatchesGender(product, opts.genders || null)) return false;
    if (opts.categoryType && !productMatchesCategoryType(product, opts.categoryType)) {
      return false;
    }
    if (opts.searchQuery != null) {
      var q = String(opts.searchQuery).toLowerCase().trim();
      if (!q) return false;
      var name = String(product.name || "").toLowerCase();
      var cat = String(
        product.category || product.subcategory || product.categoryDisplay || ""
      ).toLowerCase();
      if (name.indexOf(q) === -1 && cat.indexOf(q) === -1) return false;
    }
    if (typeof opts.match === "function" && !opts.match(product)) return false;
    return true;
  }

  async function renderShopProductGrid(containerId, opts) {
    opts = opts || {};
    var container = document.getElementById(containerId);
    if (!container) return;
    var prefix = opts.carouselPrefix || "shop";
    var emptyMessage = opts.emptyMessage || "No items yet";
    var emptyHint = opts.emptyHint || "";
    var emptyHtml = opts.emptyHtml || "";
    try {
      var products = await fetchProductsMerged();
      var shown = 0;
      container.innerHTML = "";
      products.forEach(function (product, index) {
        if (!productPassesShopFilter(product, opts)) return;
        var carouselId = prefix + "-carousel-" + index;
        var imgs = product.images || [];
        var carouselInner = imgs
          .map(function (img, i) {
            return (
              '<div class="carousel-item' +
              (i === 0 ? " active" : "") +
              '">' +
              '<a href="product.html?id=' +
              encodeURIComponent(product.id) +
              '">' +
              '<img src="' +
              (typeof escapeHtml === "function" ? escapeHtml(img) : img) +
              '" alt="" class="d-block w-100">' +
              "</a></div>"
            );
          })
          .join("");
        var hideControls = imgs.length <= 1 ? " d-none" : "";
        var price =
          product.price != null && product.price !== ""
            ? formatShopCardValue(product.price) + " EGP"
            : "—";
        var col = document.createElement("div");
        col.className = "col-12 col-sm-6 col-lg-4 col-xl-3";
        col.innerHTML =
          '<article class="shop-card h-100">' +
          '<div class="shop-card__media">' +
          '<div id="' +
          carouselId +
          '" class="carousel slide" data-bs-interval="false">' +
          '<div class="carousel-inner">' +
          carouselInner +
          "</div>" +
          '<button class="carousel-control-prev' +
          hideControls +
          '" type="button" data-bs-target="#' +
          carouselId +
          '" data-bs-slide="prev">' +
          '<span class="carousel-control-prev-icon"></span></button>' +
          '<button class="carousel-control-next' +
          hideControls +
          '" type="button" data-bs-target="#' +
          carouselId +
          '" data-bs-slide="next">' +
          '<span class="carousel-control-next-icon"></span></button>' +
          "</div></div>" +
          '<div class="shop-card__body">' +
          '<h2 class="shop-card__title">' +
          formatShopCardValue(formatShopCardTitle(product)) +
          "</h2>" +
          '<ul class="shop-card__meta">' +
          '<li><span class="shop-card__label">Size</span><span class="shop-card__value">' +
          formatShopCardValue(product.size) +
          "</span></li>" +
          '<li><span class="shop-card__label">Color</span><span class="shop-card__value">' +
          formatShopCardValue(product.color) +
          "</span></li>" +
          "</ul>" +
          '<p class="shop-card__price">' +
          price +
          "</p>" +
          '<a href="product.html?id=' +
          encodeURIComponent(product.id) +
          '" class="shop-card__cta">View product</a>' +
          "</div></article>";
        container.appendChild(col);
        shown++;
      });
      if (shown === 0) {
        container.innerHTML = emptyHtml
          ? emptyHtml
          : '<div class="col-12 py-5 text-center text-white">' +
            '<p class="fs-5 fw-bold">' +
            (typeof escapeHtml === "function" ? escapeHtml(emptyMessage) : emptyMessage) +
            "</p>" +
            (emptyHint
              ? '<p class="text-white-50 small">' + emptyHint + "</p>"
              : "") +
            "</div>";
      }
    } catch (err) {
      console.error(err);
      var msg =
        err && err.message ? err.message : "Something went wrong. Please try again.";
      container.innerHTML =
        '<div class="col-12 py-5 text-center text-white">' +
        '<p class="fs-5 fw-bold">Could not load products</p>' +
        '<p class="text-white-50 small" style="max-width:32rem;margin:0 auto;">' +
        (typeof escapeHtml === "function" ? escapeHtml(msg) : msg) +
        "</p></div>";
    }
  }

  window.formatProductSize = formatProductSize;
  window.formatCategoryDisplayName = formatCategoryDisplayName;
  window.resolveProductImageUrl = resolveProductImageUrl;
  window.uniqueImageUrls = uniqueImageUrls;
  window.isProductListedOnShop = isProductListedOnShop;
  window.productMatchesCategoryType = productMatchesCategoryType;
  window.categorySlug = categorySlug;
  window.__normalizeUiProduct = normalizeUiProduct;
  window.fetchProductsFromBackend = fetchProductsFromBackend;
  window.fetchProductsMerged = fetchProductsMerged;
  window.fetchProductById = fetchProductById;
  window.renderShopProductGrid = renderShopProductGrid;
})();
