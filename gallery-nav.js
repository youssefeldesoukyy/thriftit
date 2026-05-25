/**
 * Shared product image carousel + lightbox (admin + product page).
 */
(function () {
  function placeholderImg() {
    return (
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
          '<rect fill="%23e8e4dc" width="100%" height="100%"/>' +
          '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
          'fill="%235a5345" font-family="sans-serif" font-size="16">No photo</text></svg>'
      )
    );
  }

  function galleryNavControlsHtml(showControls) {
    if (!showControls) return "";
    return (
      '<button type="button" class="thriftit-gallery-nav__btn thriftit-gallery-nav__btn--prev" aria-label="Previous photo">' +
      '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>' +
      '<button type="button" class="thriftit-gallery-nav__btn thriftit-gallery-nav__btn--next" aria-label="Next photo">' +
      '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>'
    );
  }

  function setTrackIndex(track, index, count) {
    if (!track || count < 1) return;
    track.style.transform = "translate3d(-" + index * 100 + "%, 0, 0)";
  }

  function wireGalleryCarousel(carouselEl, urls, openLightbox) {
    if (!carouselEl || !urls.length) return;
    var inner = carouselEl.querySelector(".carousel-inner");
    var track = inner ? inner.querySelector(".thriftit-gallery-track") : null;
    var slides = track ? track.querySelectorAll(".thriftit-gallery-slide") : [];
    if (!track || !slides.length) return;

    var idx = 0;
    var count = slides.length;

    function goTo(i) {
      var next = (i + count) % count;
      if (next === idx) return;
      idx = next;
      setTrackIndex(track, idx, count);
      carouselEl.querySelectorAll(".thriftit-gallery-nav__dot").forEach(function (dot, j) {
        dot.classList.toggle("is-active", j === idx);
        dot.setAttribute("aria-current", j === idx ? "true" : "false");
      });
    }

    var prevBtn = carouselEl.querySelector(".thriftit-gallery-nav__btn--prev");
    var nextBtn = carouselEl.querySelector(".thriftit-gallery-nav__btn--next");
    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        goTo(idx - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        goTo(idx + 1);
      });
    }

    var oldDots = carouselEl.querySelector(".thriftit-gallery-nav__dots");
    if (oldDots) oldDots.remove();
    if (count > 1) {
      var dotsWrap = document.createElement("div");
      dotsWrap.className = "thriftit-gallery-nav__dots";
      urls.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "thriftit-gallery-nav__dot" + (i === 0 ? " is-active" : "");
        dot.setAttribute("aria-label", "Show photo " + (i + 1));
        dot.addEventListener("click", function (e) {
          e.stopPropagation();
          goTo(i);
        });
        dotsWrap.appendChild(dot);
      });
      carouselEl.appendChild(dotsWrap);
    }

    if (typeof openLightbox === "function") {
      track.querySelectorAll("img").forEach(function (img, i) {
        img.classList.add("thriftit-gallery-nav__clickable");
        img.title = "Click to enlarge";
        img.addEventListener("click", function (e) {
          e.stopPropagation();
          openLightbox(urls, i);
        });
      });
    }
  }

  function mountThriftitGallery(carouselEl, urls, imgClass, openLightbox) {
    if (!carouselEl) return;
    carouselEl.classList.add("thriftit-gallery-carousel");
    var inner = carouselEl.querySelector(".carousel-inner");
    if (!inner) return;
    inner.innerHTML = "";

    var track = document.createElement("div");
    track.className = "thriftit-gallery-track";
    var ph = placeholderImg();

    urls.forEach(function (src, index) {
      var slide = document.createElement("div");
      slide.className = "thriftit-gallery-slide";
      var image = document.createElement("img");
      image.src = src;
      image.className = imgClass;
      image.alt = "Photo " + (index + 1);
      image.decoding = "async";
      image.onerror = function () {
        this.onerror = null;
        this.src = ph;
      };
      slide.appendChild(image);
      track.appendChild(slide);
    });

    inner.appendChild(track);
    setTrackIndex(track, 0, urls.length);
    wireGalleryCarousel(carouselEl, urls, openLightbox);
  }

  function createImageLightbox(rootId) {
    var urls = [];
    var index = 0;
    var box = document.getElementById(rootId);
    if (!box) return null;

    function update() {
      var img = box.querySelector(".thriftit-image-lightbox__img");
      var count = box.querySelector(".thriftit-image-lightbox__count");
      if (!img || !urls.length) return;
      index = ((index % urls.length) + urls.length) % urls.length;
      img.src = urls[index];
      if (count) {
        count.textContent = index + 1 + " / " + urls.length;
      }
      var prev = box.querySelector(".thriftit-image-lightbox__nav--prev");
      var next = box.querySelector(".thriftit-image-lightbox__nav--next");
      var multi = urls.length > 1;
      if (prev) prev.style.display = multi ? "" : "none";
      if (next) next.style.display = multi ? "" : "none";
    }

    function open(startUrls, startIndex) {
      if (!startUrls || !startUrls.length) return;
      urls = startUrls.slice();
      index = startIndex || 0;
      box.classList.remove("d-none");
      box.setAttribute("aria-hidden", "false");
      document.body.classList.add("thriftit-image-lightbox-open");
      update();
    }

    function close() {
      box.classList.add("d-none");
      box.setAttribute("aria-hidden", "true");
      document.body.classList.remove("thriftit-image-lightbox-open");
      urls = [];
    }

    var closeBtn = box.querySelector(".thriftit-image-lightbox__close");
    if (closeBtn) closeBtn.addEventListener("click", close);
    var prevBtn = box.querySelector(".thriftit-image-lightbox__nav--prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        index -= 1;
        update();
      });
    }
    var nextBtn = box.querySelector(".thriftit-image-lightbox__nav--next");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        index += 1;
        update();
      });
    }
    box.addEventListener("click", function (e) {
      if (e.target === box) close();
    });
    document.addEventListener("keydown", function (e) {
      if (box.classList.contains("d-none")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") {
        index -= 1;
        update();
      }
      if (e.key === "ArrowRight") {
        index += 1;
        update();
      }
    });

    return { open: open, close: close };
  }

  window.thriftitGalleryPlaceholder = placeholderImg;
  window.galleryNavControlsHtml = galleryNavControlsHtml;
  window.mountThriftitGallery = mountThriftitGallery;
  window.wireThriftitGallery = wireGalleryCarousel;
  window.createThriftitImageLightbox = createImageLightbox;
})();
