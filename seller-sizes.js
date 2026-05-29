/**
 * Sell Your Item — size options from category.
 * Loaded on seller.html; must run even when auth redirect runs later.
 */
(function (global) {
  function normalizeSellerSizeCode(raw) {
    if (raw == null) return "";
    var s = String(raw).trim();
    if (!s || s === "—" || s === "-") return "";
    if (/^\d+$/.test(s)) return s;
    var key = s.toLowerCase().replace(/[\s._+\-]+/g, "");
    var fromLabel = {
      extrasmall: "xs",
      xsmall: "xs",
      small: "s",
      medium: "m",
      large: "l",
      extralarge: "xl",
      xlarge: "xl",
      xxl: "xxl",
      "2xl": "xxl",
      xxxl: "xxxl",
      "3xl": "xxxl",
      onesize: "m",
      os: "m",
    };
    if (fromLabel[key]) return fromLabel[key];
    if (/^(xs|s|m|l|xl|xxl|xxxl)$/.test(key)) return key;
    return key;
  }

  function applySellerSizeValue(sizeEl, preserveSize) {
    var keep = normalizeSellerSizeCode(preserveSize);
    if (!keep) {
      sizeEl.value = "";
      return;
    }
    for (var i = 0; i < sizeEl.options.length; i++) {
      if (sizeEl.options[i].value === keep) {
        sizeEl.value = keep;
        return;
      }
    }
    var opt = document.createElement("option");
    opt.value = keep;
    opt.textContent = /^\d+$/.test(keep) ? keep : keep.toUpperCase();
    sizeEl.appendChild(opt);
    sizeEl.value = keep;
  }

  function updateSellerSizeOptions(preserveSize) {
    var category = document.getElementById("productCategory");
    var size = document.getElementById("productSize");
    if (!category || !size) return;

    var value = (category.value || "").trim().toLowerCase();
    var keep =
      preserveSize !== undefined
        ? preserveSize
        : normalizeSellerSizeCode(size.value);
    size.required = true;

    if (!value) {
      size.innerHTML = '<option value="">Choose category first</option>';
      size.value = "";
      size.disabled = true;
      return;
    }

    size.disabled = false;
    var html = '<option value="">Choose size</option>';
    var clothes = [
      "jackets",
      "shirts",
      "tshirts",
      "tops",
      "dresses",
      "bottoms",
      "sweatshirts",
    ];

    if (clothes.indexOf(value) >= 0) {
      ["xs", "s", "m", "l", "xl", "xxl", "xxxl"].forEach(function (k) {
        html += '<option value="' + k + '">' + k.toUpperCase() + "</option>";
      });
    } else if (value === "accessories") {
      html = '<option value="m">One size</option>';
      size.innerHTML = html;
      size.value = "m";
      return;
    } else if (value === "shoes") {
      var n;
      for (n = 36; n <= 48; n++) {
        html += '<option value="' + n + '">' + n + "</option>";
      }
    }

    size.innerHTML = html;
    applySellerSizeValue(size, keep);
  }

  function bindSellerSizeSelect() {
    var category = document.getElementById("productCategory");
    if (!category) return;
    category.addEventListener("change", function () {
      updateSellerSizeOptions();
    });
    category.addEventListener("input", function () {
      updateSellerSizeOptions();
    });
    var isEdit = /[?&]edit=/.test(window.location.search || "");
    if (!isEdit) {
      updateSellerSizeOptions();
    }
  }

  global.updateSellerSizeOptions = updateSellerSizeOptions;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSellerSizeSelect);
  } else {
    bindSellerSizeSelect();
  }
})(typeof window !== "undefined" ? window : this);
