(function () {
  function designOnly() {
    return (
      typeof THRIFTIT_STATIC_DESIGN_ONLY !== "undefined" &&
      THRIFTIT_STATIC_DESIGN_ONLY
    );
  }

  function baseUrl() {
    if (typeof thriftitApiBase === "function") {
      return thriftitApiBase();
    }
    if (typeof API_BASE === "undefined" || !API_BASE) {
      throw new Error("Missing API_BASE — load config.js before auth-api.js");
    }
    var b = String(API_BASE).replace(/\/$/, "");
    if (/:5173(\/|$)/.test(b)) {
      return "http://localhost:4000";
    }
    return b;
  }

  function loginPath() {
    return typeof API_LOGIN_PATH !== "undefined"
      ? API_LOGIN_PATH
      : "/api/users/login";
  }

  function registerPath() {
    return typeof API_REGISTER_PATH !== "undefined"
      ? API_REGISTER_PATH
      : "/api/users/register";
  }

  function forgotPasswordPath() {
    return typeof API_FORGOT_PASSWORD_PATH !== "undefined"
      ? API_FORGOT_PASSWORD_PATH
      : "/api/users/forgot-password";
  }

  function resetPasswordPath() {
    return typeof API_RESET_PASSWORD_PATH !== "undefined"
      ? API_RESET_PASSWORD_PATH
      : "/api/users/reset-password";
  }

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
      typeof API_BASE !== "undefined" && API_BASE ? API_BASE : "your API";
    var lines = [
      "Cannot reach the API at " + base + " (port 4000).",
      "• Backend: cd node-js-project → npm run run:dev",
      "• Frontend: cd thriftit → npm start → open http://localhost:5173 (not file://)",
    ];
    if (
      typeof location !== "undefined" &&
      location.protocol === "file:"
    ) {
      lines.push(
        "• Using file://? Add ALLOW_FILE_ORIGIN_CORS=true to the backend .env."
      );
    }
    return lines.join(" ");
  }

  async function apiFetch(url, options) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (isNetworkFetchFailure(err)) {
        throw new Error(networkFetchMessage());
      }
      throw err;
    }
  }

  function stringId(v) {
    if (v == null) return undefined;
    if (typeof v === "object" && v.$oid) return String(v.$oid);
    return String(v);
  }

  function normalizeTokenString(t) {
    if (t == null || typeof t !== "string") return "";
    var s = t.trim();
    if (s.toLowerCase().indexOf("bearer ") === 0) {
      s = s.slice(7).trim();
    }
    return s;
  }

  function pickTokenFromObject(o) {
    if (!o || typeof o !== "object") return "";
    var t =
      o.token ||
      o.accessToken ||
      o.access_token ||
      o.jwt ||
      o.authToken ||
      "";
    return typeof t === "string" ? t : "";
  }

  /** Handles token on root, inside data, or beside nested user (common Express shapes). */
  function extractToken(body) {
    if (!body || typeof body !== "object") return "";
    var root = body;
    var inner =
      body.data && typeof body.data === "object" ? body.data : null;
    /** Backend register: `{ data: { user: { token } } }` */
    var innerUser =
      inner && inner.user && typeof inner.user === "object" ? inner.user : null;

    var t =
      pickTokenFromObject(root) ||
      (inner ? pickTokenFromObject(inner) : "") ||
      (innerUser ? pickTokenFromObject(innerUser) : "") ||
      "";
    if (
      !t &&
      inner &&
      inner.data &&
      typeof inner.data === "object"
    ) {
      t = pickTokenFromObject(inner.data);
    }
    return normalizeTokenString(t);
  }

  function isEmailLikeName(name, email) {
    var n = String(name || "").trim();
    var e = String(email || "").trim().toLowerCase();
    if (!n) return false;
    if (e && n.toLowerCase() === e) return true;
    return n.indexOf("@") !== -1;
  }

  function firstNameFromEmail(email) {
    var e = String(email || "").trim();
    var at = e.indexOf("@");
    if (at <= 0) return "";
    var local = e
      .slice(0, at)
      .replace(/[._+\-]+/g, " ")
      .trim();
    if (!local) return "";
    return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
  }

  function rememberProfileHint(user) {
    if (!user || !user.email || !user.firstName) return;
    try {
      var map = JSON.parse(localStorage.getItem("thriftitProfileHints") || "{}");
      map[String(user.email).toLowerCase()] = {
        firstName: String(user.firstName).trim(),
        lastName: String(user.lastName || "").trim(),
      };
      localStorage.setItem("thriftitProfileHints", JSON.stringify(map));
    } catch (_) {}
  }

  function applyProfileHint(user) {
    if (!user || !user.email || String(user.firstName || "").trim()) return user;
    try {
      var hint =
        JSON.parse(localStorage.getItem("thriftitProfileHints") || "{}")[
          String(user.email).toLowerCase()
        ];
      if (hint && hint.firstName) {
        user.firstName = String(hint.firstName).trim();
        user.lastName = String(hint.lastName || "").trim();
      }
    } catch (_) {}
    return user;
  }

  /** Greeting label: first name only, never the email address. */
  function userDisplayName(user) {
    if (!user || typeof user !== "object") return "User";
    user = applyProfileHint(Object.assign({}, user));
    var email = String(user.email || "").toLowerCase();
    var first = String(user.firstName || "").trim();
    if (first) return first;
    var combined = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (combined) return combined.split(/\s+/)[0];
    var n = String(user.name || "").trim();
    if (n && !isEmailLikeName(n, email)) return n.split(/\s+/)[0];
    var fromEmail = firstNameFromEmail(email);
    if (fromEmail) return fromEmail.split(/\s+/)[0];
    return "User";
  }

  function normalizeStoredUser(user, opts) {
    opts = opts || {};
    if (!user || !user.email) return user;
    user.email = String(user.email).toLowerCase();
    if (opts.firstName) user.firstName = String(opts.firstName).trim();
    if (opts.lastName) user.lastName = String(opts.lastName).trim();
    user.firstName = String(user.firstName || "").trim();
    user.lastName = String(user.lastName || "").trim();
    user.name = userDisplayName(user);
    return user;
  }

  function extractUser(body, emailFallback, nameFallback) {
    if (!body || typeof body !== "object") return null;
    var wrap = body.data && typeof body.data === "object" ? body.data : body;
    var u = wrap.user || wrap.profile || null;
    var email = String(
      (u && u.email) || wrap.email || emailFallback || ""
    ).toLowerCase();

    if (u && typeof u === "object") {
      return normalizeStoredUser(
        {
          email: email,
          firstName: u.firstName,
          lastName: u.lastName,
          name: u.name || u.username || u.fullName || nameFallback || "",
          id: stringId(u.id != null ? u.id : u._id),
          role: u.role != null ? String(u.role) : "",
        },
        { firstName: nameFallback, lastName: "" }
      );
    }

    if (wrap.email) {
      return normalizeStoredUser(
        {
          email: email,
          firstName: wrap.firstName,
          lastName: wrap.lastName,
          name: wrap.name || nameFallback || "",
          id: stringId(wrap.id != null ? wrap.id : wrap._id),
          role: wrap.role != null ? String(wrap.role) : "",
        },
        { firstName: nameFallback, lastName: "" }
      );
    }

    return null;
  }

  async function parseJsonResponse(res) {
    var text = await res.text();
    if (!text || !String(text).trim()) {
      throw new Error(
        "Empty response from API (HTTP " +
          res.status +
          "). Run backend: npm run run:dev (port 4000). Restart frontend: npm start (proxies /api to 4000). Hard-refresh Ctrl+F5."
      );
    }
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      var snippet = String(text).replace(/\s+/g, " ").trim().slice(0, 160);
      if (snippet.indexOf("<") !== -1 || res.status === 405) {
        throw new Error(
          "Got HTML instead of API JSON (HTTP " +
            res.status +
            "). Stop reopening HTML as file://. Use: (1) npm run run:dev in backend, (2) npm start in thriftit folder, (3) http://localhost:5173/login.html"
        );
      }
      throw new Error(
        "Server did not return JSON (HTTP " + res.status + "): " + snippet
      );
    }
  }

  function firstErrorMessage(body) {
    if (!body || typeof body !== "object") return "";
    if (typeof body.message === "string") return body.message;
    if (typeof body.error === "string") return body.error;
    if (typeof body.msg === "string") return body.msg;
    if (Array.isArray(body.errors) && body.errors.length) {
      var e = body.errors[0];
      if (e && typeof e.msg === "string") return e.msg;
      if (e && typeof e.message === "string") return e.message;
    }
    return "";
  }

  function persistSession(user, token) {
    if (!user || !user.email) return;
    user = applyProfileHint(user);
    user = normalizeStoredUser(user, {});
    rememberProfileHint(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("jwt");
    var clean = normalizeTokenString(
      typeof token === "string" ? token : ""
    );
    if (clean) {
      localStorage.setItem("token", clean);
      localStorage.setItem("accessToken", clean);
    }
  }

  function ensureUserShape(user, email, nameGuess) {
    if (user && user.email) return normalizeStoredUser(user, {});
    return normalizeStoredUser(
      {
        email: email,
        firstName: nameGuess || "",
        lastName: "",
        name: nameGuess || "",
      },
      {}
    );
  }

  async function apiLogin(email, password) {
    if (designOnly()) {
      throw new Error(
        "Design-only mode — set THRIFTIT_STATIC_DESIGN_ONLY = false in config.js to log in."
      );
    }
    var res = await apiFetch(baseUrl() + loginPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });

    var body = await parseJsonResponse(res);

    if (
      !res.ok ||
      (body &&
        (body.status === "error" ||
          String(body.status || "").toUpperCase() === "FAIL"))
    ) {
      throw new Error(firstErrorMessage(body) || "Login failed");
    }

    var token = extractToken(body);
    var user = extractUser(body, email, "");
    user = ensureUserShape(user, email, "");
    if (user && !user.firstName && user.email) {
      var guessed = firstNameFromEmail(user.email);
      if (guessed) {
        user.firstName = guessed;
        user.name = userDisplayName(user);
      }
    }
    persistSession(user, token);
    return { user: user, token: token };
  }

  async function apiRegister(firstName, lastName, email, password) {
    if (designOnly()) {
      throw new Error(
        "Design-only mode — set THRIFTIT_STATIC_DESIGN_ONLY = false in config.js to sign up."
      );
    }
    var displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
    var res = await apiFetch(baseUrl() + registerPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      }),
    });

    var body = await parseJsonResponse(res);

    if (
      !res.ok ||
      (body &&
        (body.status === "error" ||
          String(body.status || "").toUpperCase() === "FAIL"))
    ) {
      throw new Error(firstErrorMessage(body) || "Sign up failed");
    }

    var token = extractToken(body);
    var user = extractUser(body, email, firstName);
    user = normalizeStoredUser(user, {
      firstName: firstName,
      lastName: lastName,
    });
    if (token && user && user.email) {
      persistSession(user, token);
      return { user: user, token: token };
    }
    if (user && user.email) {
      persistSession(user, token || "");
      return { user: user, token: token || "" };
    }

    try {
      return await apiLogin(email, password);
    } catch (loginErr) {
      throw new Error(
        "Account created. Please log in with your email and password."
      );
    }
  }

  function authLogout() {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("jwt");
    if (typeof window !== "undefined") {
      window.currentUser = null;
    }
  }

  function roleFromJwt(token) {
    try {
      var t = normalizeTokenString(token);
      if (!t) return "";
      var parts = t.split(".");
      if (parts.length < 2) return "";
      var b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var payload = JSON.parse(atob(b64));
      return payload.role != null ? String(payload.role) : "";
    } catch (_) {
      return "";
    }
  }

  function storedAuthToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      ""
    );
  }

  function isAdminUser(user) {
    if (user && String(user.role || "").toUpperCase() === "ADMIN") {
      return true;
    }
    return roleFromJwt(storedAuthToken()).toUpperCase() === "ADMIN";
  }

  function readStoredUser() {
    try {
      var raw = localStorage.getItem("currentUser");
      if (!raw) return null;
      var user = applyProfileHint(JSON.parse(raw));
      user = normalizeStoredUser(user, {});
      if (user && !String(user.role || "").trim()) {
        var fromJwt = roleFromJwt(storedAuthToken());
        if (fromJwt) user.role = fromJwt;
      }
      return user;
    } catch (e) {
      return null;
    }
  }

  async function apiForgotPassword(email) {
    if (designOnly()) {
      throw new Error(
        "Design-only mode — set THRIFTIT_STATIC_DESIGN_ONLY = false in config.js."
      );
    }
    var res = await apiFetch(baseUrl() + forgotPasswordPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email || "").trim().toLowerCase() }),
    });
    var body = await parseJsonResponse(res);
    if (
      !res.ok ||
      (body &&
        (body.status === "error" ||
          String(body.status || "").toUpperCase() === "FAIL"))
    ) {
      throw new Error(firstErrorMessage(body) || "Could not send reset email");
    }
    var data = body.data || body;
    return (
      (data && data.message) ||
      "If an account exists for that email, we sent a reset link."
    );
  }

  async function apiResetPassword(token, password) {
    if (designOnly()) {
      throw new Error(
        "Design-only mode — set THRIFTIT_STATIC_DESIGN_ONLY = false in config.js."
      );
    }
    var res = await apiFetch(baseUrl() + resetPasswordPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, password: password }),
    });
    var body = await parseJsonResponse(res);
    if (
      !res.ok ||
      (body &&
        (body.status === "error" ||
          String(body.status || "").toUpperCase() === "FAIL"))
    ) {
      throw new Error(firstErrorMessage(body) || "Could not reset password");
    }
    var data = body.data || body;
    return (
      (data && data.message) ||
      "Password updated. You can log in with your new password."
    );
  }

  function isLoggedIn() {
    return !!(readStoredUser() && String(storedAuthToken() || "").trim());
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return String(str || "").replace(/"/g, "&quot;");
  }

  function thriftitUserMessage(err, fallback) {
    if (err && typeof err.message === "string" && err.message.trim()) {
      return err.message.trim();
    }
    return fallback || "Something went wrong. Please try again.";
  }

  function showToast(message) {
    var msg = String(message || "");
    var toastEl = document.getElementById("liveToast");
    var toastMsg = document.getElementById("toast-msg");
    if (!toastEl || !toastMsg) {
      if (msg) window.alert(msg);
      return;
    }
    toastMsg.innerText = msg;
    try {
      if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
        bootstrap.Toast.getOrCreateInstance(toastEl).show();
      } else if (msg) {
        window.alert(msg);
      }
    } catch (_) {
      if (msg) window.alert(msg);
    }
  }

  var BAG_IMG_PLACEHOLDER =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
        '<rect fill="%23e8e4dc" width="100%" height="100%"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
        'fill="%235a5345" font-family="sans-serif" font-size="11">No photo</text></svg>'
    );

  window.apiLogin = apiLogin;
  window.apiRegister = apiRegister;
  window.apiForgotPassword = apiForgotPassword;
  window.apiResetPassword = apiResetPassword;
  window.authLogout = authLogout;
  window.userDisplayName = userDisplayName;
  window.readStoredUser = readStoredUser;
  window.isAdminUser = isAdminUser;
  window.roleFromJwt = roleFromJwt;
  function ensureNavbarAdminLink() {
    var nav = document.querySelector("#navbarSupportedContent .navbar-nav");
    if (!nav) return null;
    var existing = document.getElementById("navbar-admin-item");
    if (existing) return existing;
    var li = document.createElement("li");
    li.className = "nav-item";
    li.id = "navbar-admin-item";
    li.innerHTML =
      '<a class="nav-link navbar-admin-nav" href="admin.html">' +
      '<i class="fa-solid fa-shield-halved me-1" aria-hidden="true"></i>Admin</a>';
    nav.appendChild(li);
    return li;
  }

  function applyNavbarAuth() {
    window.currentUser = readStoredUser();
    var loginBtn = document.getElementById("loginBtn");
    var signupBtn = document.getElementById("signupBtn");
    var username = document.getElementById("username");
    var adminItem = document.getElementById("navbar-admin-item");

    if (window.currentUser && isAdminUser(window.currentUser)) {
      adminItem = ensureNavbarAdminLink();
      if (adminItem) adminItem.classList.remove("d-none");
      if (
        adminItem &&
        typeof location !== "undefined" &&
        /admin\.html$/i.test(location.pathname || "")
      ) {
        var adminLink = adminItem.querySelector("a");
        if (adminLink) adminLink.classList.add("active");
      }
    } else if (adminItem) {
      adminItem.remove();
    }

    if (!loginBtn && !signupBtn && !username) return;
    if (window.currentUser) {
      if (loginBtn) loginBtn.style.display = "none";
      if (signupBtn) signupBtn.style.display = "none";
      if (username) {
        username.style.display = "inline-block";
        username.innerText = "Hi, " + userDisplayName(window.currentUser);
      }
    } else {
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (signupBtn) signupBtn.style.display = "inline-block";
      if (username) username.style.display = "none";
    }
  }

  window.currentUser = readStoredUser();
  window.storedAuthToken = storedAuthToken;
  window.isLoggedIn = isLoggedIn;
  window.escapeHtml = escapeHtml;
  window.escapeAttr = escapeAttr;
  window.showToast = showToast;
  window.thriftitUserMessage = thriftitUserMessage;
  window.BAG_IMG_PLACEHOLDER = BAG_IMG_PLACEHOLDER;
  window.applyNavbarAuth = applyNavbarAuth;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyNavbarAuth);
    } else {
      applyNavbarAuth();
    }
  }
})();
