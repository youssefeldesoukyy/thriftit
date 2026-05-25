function goToSearch(event) {
  event.preventDefault();
  var input = document.getElementById("searchInput");
  if (!input) return;
  window.location.href =
    "search.html?query=" + encodeURIComponent(input.value);
}

(function renderHomeCategories() {
  var row = document.getElementById("home-categories-row");
  if (!row) return;
  var cats = [
    { type: "jackets", label: "Jackets", img: "images/category/jackets.png" },
    { type: "shirts", label: "Shirts", img: "images/category/shirts.png" },
    { type: "tshirts", label: "Tshirts", img: "images/category/tshirts.png" },
    { type: "sweatshirts", label: "Sweatshirts", img: "images/category/sweatshirts.png" },
    { type: "bottoms", label: "Bottoms", img: "images/category/pants.png" },
    { type: "dresses", label: "Dresses", img: "images/category/dresses.png" },
    { type: "tops", label: "Tops", img: "images/category/tops.png" },
    { type: "accessories", label: "Accessories", img: "images/category/accessories.png" },
  ];
  row.innerHTML = cats
    .map(function (c) {
      return (
        '<div class="col-6 col-md-4 col-lg-3">' +
        '<a href="category.html?type=' +
        encodeURIComponent(c.type) +
        '" class="category-link">' +
        '<div class="category-card">' +
        '<img src="' +
        c.img +
        '?v=gen" alt="' +
        c.label +
        '">' +
        '<div class="category-text">' +
        c.label +
        "</div></div></a></div>"
      );
    })
    .join("");
})();