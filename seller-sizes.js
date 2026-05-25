/**
 * Sell Your Item — size options from category.
 * Loaded on seller.html; must run even when auth redirect runs later.
 */
(function (global) {
  function updateSellerSizeOptions() {
    var category = document.getElementById("productCategory");
    var size = document.getElementById("productSize");
    if (!category || !size) return;

    var value = (category.value || "").trim().toLowerCase();
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
    size.value = "";
  }

  function bindSellerSizeSelect() {
    var category = document.getElementById("productCategory");
    if (!category) return;
    category.addEventListener("change", updateSellerSizeOptions);
    category.addEventListener("input", updateSellerSizeOptions);
    updateSellerSizeOptions();
  }

  global.updateSellerSizeOptions = updateSellerSizeOptions;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSellerSizeSelect);
  } else {
    bindSellerSizeSelect();
  }
})(typeof window !== "undefined" ? window : this);
