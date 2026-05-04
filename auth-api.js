(function () {
  function baseUrl() {
    if (typeof API_BASE === "undefined" || !API_BASE) {
      throw new Error("Missing API_BASE — load config.js before auth-api.js");
    }
    return String(API_BASE).replace(/\/$/, "");
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

    var t =
      pickTokenFromObject(root) ||
      (inner ? pickTokenFromObject(inner) : "") ||
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

  function extractUser(body, emailFallback, nameFallback) {
    if (!body || typeof body !== "object") return null;
    var wrap = body.data && typeof body.data === "object" ? body.data : body;
    var u = wrap.user || wrap.profile || null;

    if (u && typeof u === "object") {
      var combined =
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      return {
        email: String(u.email || emailFallback || "").toLowerCase(),
        name:
          combined ||
          u.name ||
          u.username ||
          u.fullName ||
          nameFallback ||
          u.email ||
          "",
        id: stringId(u.id != null ? u.id : u._id),
      };
    }

    if (wrap.email) {
      var wrapCombined =
        [wrap.firstName, wrap.lastName].filter(Boolean).join(" ").trim();
      return {
        email: String(wrap.email).toLowerCase(),
        name:
          wrapCombined ||
          wrap.name ||
          nameFallback ||
          String(wrap.email).split("@")[0],
        id: stringId(wrap.id != null ? wrap.id : wrap._id),
      };
    }

    return null;
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
    if (user && user.email) return user;
    return {
      email: email,
      name:
        (nameGuess ||
          (email ? email.split("@")[0] : "")) ||
        "User",
    };
  }

  async function apiLogin(email, password) {
    var res = await fetch(baseUrl() + loginPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });

    var body;
    try {
      body = await res.json();
    } catch (parseErr) {
      throw new Error("Server did not return JSON");
    }

    if (!res.ok || (body && body.status === "error")) {
      throw new Error(firstErrorMessage(body) || "Login failed");
    }

    var token = extractToken(body);
    var user = extractUser(body, email, "");
    user = ensureUserShape(user, email, "");
    persistSession(user, token);
    return { user: user, token: token };
  }

  async function apiRegister(firstName, lastName, email, password) {
    var displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
    var res = await fetch(baseUrl() + registerPath(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      }),
    });

    var body;
    try {
      body = await res.json();
    } catch (parseErr) {
      throw new Error("Server did not return JSON");
    }

    if (!res.ok || (body && body.status === "error")) {
      throw new Error(firstErrorMessage(body) || "Sign up failed");
    }

    var token = extractToken(body);
    var user = extractUser(body, email, displayName);
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
  }

  window.apiLogin = apiLogin;
  window.apiRegister = apiRegister;
  window.authLogout = authLogout;
})();
