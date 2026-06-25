/* ============================================================
   CIA DO CORPO — Prova social viva (Google Reviews)
   Puxa avaliações reais via Google Maps JavaScript API (Places).
   Configurar no admin: Integrações > Google Places (API key + Place ID por unidade).
   Sem configuração, mantém os depoimentos estáticos do HTML (fallback).
   ============================================================ */
(function (w, d) {
  var DATA = w.CDC.data;
  var host = d.querySelector('[data-cdc="reviews"]');
  if (!host) return;
  var gp = (DATA.get().integrations || {}).googlePlaces || {};
  if (!gp.apiKey) return; // mantém fallback estático

  // escolhe a unidade: a "minha unidade" salva, senão a 1ª com Place ID
  var placeId = "";
  var ids = gp.unitPlaceIds || {};
  var my = localStorage.getItem("cdc_my_unit");
  if (my && ids[my]) placeId = ids[my];
  if (!placeId) { for (var k in ids) { if (ids[k]) { placeId = ids[k]; break; } } }
  if (!placeId) return;

  function stars(n) {
    n = Math.round(n || 0); var s = "";
    for (var i = 0; i < 5; i++) s += i < n ? "★" : "☆";
    return s;
  }
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  w.__cdcReviewsInit = function () {
    try {
      var svc = new w.google.maps.places.PlacesService(d.createElement("div"));
      svc.getDetails({ placeId: placeId, fields: ["reviews", "rating", "user_ratings_total", "name", "url"] }, function (place, status) {
        if (status !== w.google.maps.places.PlacesServiceStatus.OK || !place || !place.reviews) return;
        var revs = place.reviews.slice(0, 6);
        host.innerHTML = revs.map(function (r) {
          return '<div class="testi reveal in">' +
            '<div class="stars">' + stars(r.rating) + '</div>' +
            '<p>"' + esc(r.text || "") + '"</p>' +
            '<div class="who">' +
              (r.profile_photo_url ? '<img class="av" src="' + esc(r.profile_photo_url) + '" alt="" referrerpolicy="no-referrer">' : '<div class="av">' + esc((r.author_name || "?").charAt(0)) + '</div>') +
              '<div><b>' + esc(r.author_name || "Aluno") + '</b><span>' + esc(r.relative_time_description || "Avaliação do Google") + '</span></div>' +
            '</div></div>';
        }).join("");
        // cabeçalho com nota agregada
        var head = d.querySelector('[data-cdc="reviews-head"]');
        if (head && place.rating) {
          head.innerHTML = '<a href="' + esc(place.url || "#") + '" target="_blank" rel="noopener" class="g-rating">' +
            '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>' +
            '<b>' + place.rating.toFixed(1) + '</b> <span class="gst">' + stars(place.rating) + '</span>' +
            '<span class="gtot">' + (place.user_ratings_total || 0) + ' avaliações no Google</span></a>';
        }
      });
    } catch (e) { /* mantém fallback */ }
  };

  var s = d.createElement("script");
  s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(gp.apiKey) + "&libraries=places&callback=__cdcReviewsInit&loading=async";
  s.async = true; s.defer = true; d.head.appendChild(s);
})(window, document);
