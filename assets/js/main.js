/* ============================================================
   CIA DO CORPO — Interações de UI
   Header scroll, menu mobile, reveal on scroll, FAQ, marquee.
   ============================================================ */
(function (w, d) {
  function onReady(fn) { d.readyState !== "loading" ? fn() : d.addEventListener("DOMContentLoaded", fn); }

  onReady(function () {
    // Header scrolled state
    var header = d.querySelector(".site-header");
    function onScroll() { if (header) header.classList.toggle("scrolled", w.scrollY > 30); }
    onScroll(); w.addEventListener("scroll", onScroll, { passive: true });

    // Mobile nav
    var toggle = d.querySelector(".nav-toggle");
    var links = d.querySelector(".nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", function () { links.classList.toggle("open"); });
      links.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { links.classList.remove("open"); });
      });
    }

    // Reveal on scroll
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    d.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

    // FAQ accordion
    d.querySelectorAll(".faq-item").forEach(function (item) {
      var q = item.querySelector(".faq-q");
      var a = item.querySelector(".faq-a");
      if (!q || !a) return;
      q.addEventListener("click", function () {
        var open = item.classList.toggle("open");
        a.style.maxHeight = open ? a.scrollHeight + "px" : null;
      });
    });

    // Footer year
    var y = d.querySelector("[data-year]");
    if (y) y.textContent = new Date().getFullYear();

    // Reabrir consentimento
    d.querySelectorAll('[data-cdc="privacy"]').forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); if (w.CDC && w.CDC.openConsent) w.CDC.openConsent(); });
    });
  });
})(window, document);
