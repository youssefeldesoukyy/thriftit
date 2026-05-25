(function () {
  if (document.querySelector(".thriftit-footer")) return;

  var footer = document.createElement("footer");
  footer.className = "thriftit-footer mt-5 pt-5 pb-4 border-top";
  footer.setAttribute("data-thriftit-footer", "1");
  footer.innerHTML =
    '<div class="container">' +
    '<div class="row">' +
    '<div class="col-md-4 mb-3">' +
    '<h4 class="fw-bold">Thrift It</h4>' +
    '<p class="text-light">Buy and sell second-hand fashion safely, easily, and affordably.</p>' +
    '<div class="d-flex gap-3 mt-3">' +
    '<a href="#" class="text-light fs-5" aria-label="Facebook"><i class="fa-brands fa-facebook"></i></a>' +
    '<a href="#" class="text-light fs-5" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>' +
    '<a href="#" class="text-light fs-5" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>' +
    "</div></div>" +
    '<div class="col-md-4 mb-3">' +
    '<h5 class="fw-bold">Payment &amp; Delivery</h5>' +
    '<ul class="list-unstyled text-light">' +
    "<li>Cash on Delivery &amp; Visa payments available</li>" +
    "<li>You can inspect the item with the courier (5–10 minutes)</li>" +
    "<li>Delivery available in Cairo &amp; Giza only</li>" +
    "</ul></div>" +
    '<div class="col-md-4 mb-3">' +
    '<h5 class="fw-bold">Quick Links</h5>' +
    '<ul class="list-unstyled">' +
    '<li><a href="index.html" class="text-light text-decoration-none">Home</a></li>' +
    '<li><a href="women.html" class="text-light text-decoration-none">Women</a></li>' +
    '<li><a href="men.html" class="text-light text-decoration-none">Men</a></li>' +
    '<li><a href="shopall.html" class="text-light text-decoration-none">Shop all</a></li>' +
    "</ul></div></div>" +
    '<hr class="border-light">' +
    '<div class="text-center text-light">' +
    "<small>&copy; 2026 Thrift It. All rights reserved.</small>" +
    "</div></div>";

  document.body.appendChild(footer);
})();
