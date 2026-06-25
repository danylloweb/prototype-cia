/* ============================================================
   CIA DO CORPO — Telemetria ponta a ponta + Consent (LGPD)
   - Google Consent Mode v2 (default denied -> update on consent)
   - GTM + GA4, Meta Pixel, Microsoft Clarity (carregados após consentimento)
   - dataLayer de eventos de conversão (whatsapp_click, call_click, etc.)
   - Banner de consentimento com escolha granular
   IDs vêm de CDC.data.get().telemetry (editáveis no admin).
   ============================================================ */

(function (w, d) {
  var CONSENT_KEY = "cdc_consent_v1";
  var tel = (w.CDC && w.CDC.data) ? w.CDC.data.get().telemetry : {};

  /* ---- dataLayer + Consent Mode default (antes de qualquer tag) ---- */
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;

  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });

  function loadScript(src, attrs) {
    var s = d.createElement("script"); s.async = true; s.src = src;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    d.head.appendChild(s);
  }

  var loaded = false;
  function loadTags() {
    if (loaded) return; loaded = true;

    // Google Tag Manager
    if (tel.gtmId) {
      (function (w2, d2, i) {
        w2.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
        loadScript("https://www.googletagmanager.com/gtm.js?id=" + i);
      })(w, d, tel.gtmId);
    }
    // GA4 direto (se configurado sem GTM)
    if (tel.ga4Id && !tel.gtmId) {
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + tel.ga4Id);
      gtag("js", new Date());
      gtag("config", tel.ga4Id, { anonymize_ip: true });
    }
    // Meta Pixel
    if (tel.metaPixelId) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(w, d, "script", "https://connect.facebook.net/en_US/fbevents.js");
      w.fbq("init", tel.metaPixelId);
      w.fbq("track", "PageView");
    }
    // Microsoft Clarity
    if (tel.clarityId) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(w, d, "clarity", "script", tel.clarityId);
    }
  }

  /* ---- API pública de tracking ---- */
  // Log first-party de eventos (alimenta o dashboard do admin sem backend)
  function logFirstParty(name, params) {
    try {
      var key = "cdc_events";
      var arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.push({ e: name, t: Date.now(), p: params || {} });
      if (arr.length > 2000) arr = arr.slice(arr.length - 2000);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
  }

  var Track = {
    event: function (name, params) {
      params = params || {};
      logFirstParty(name, params);
      w.dataLayer.push(Object.assign({ event: name }, params));
      if (w.fbq) {
        var fbMap = { whatsapp_click: "Contact", call_click: "Contact", lead_submit: "Lead",
          trial_request: "Lead", plan_view: "ViewContent", popup_cta: "Lead" };
        if (fbMap[name]) w.fbq("track", fbMap[name], params);
        else w.fbq("trackCustom", name, params);
      }
    },
    pageView: function () {
      var src = "Direto";
      try {
        var q = new URLSearchParams(location.search);
        var utm = q.get("utm_source");
        if (utm) src = utm.charAt(0).toUpperCase() + utm.slice(1);
        else if (d.referrer) {
          var h = new URL(d.referrer).hostname;
          if (/google\./.test(h)) src = "Google (orgânico)";
          else if (/facebook\.|instagram\.|fb\./.test(h)) src = "Meta (social)";
          else if (/bing\.|yahoo\./.test(h)) src = "Outros buscadores";
          else if (h && h.indexOf(location.hostname) === -1) src = "Referência";
        }
      } catch (e) {}
      logFirstParty("page_view", { source: src, page: location.pathname });
      w.dataLayer.push({ event: "page_view", page_path: location.pathname, page_title: d.title, traffic_source: src });
    }
  };
  w.CDC = w.CDC || {}; w.CDC.track = Track;

  /* ---- Consentimento ---- */
  function applyConsent(granted) {
    gtag("consent", "update", {
      ad_storage: granted ? "granted" : "denied",
      ad_user_data: granted ? "granted" : "denied",
      ad_personalization: granted ? "granted" : "denied",
      analytics_storage: granted ? "granted" : "denied"
    });
    if (granted) loadTags();
  }

  function getStored() { try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch (e) { return null; } }
  function setStored(v) { localStorage.setItem(CONSENT_KEY, JSON.stringify(v)); }

  function buildBanner() {
    if (d.querySelector(".consent")) return;
    var el = d.createElement("div");
    el.className = "consent";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Aviso de privacidade");
    el.innerHTML =
      '<h4>Sua privacidade importa 🍪</h4>' +
      '<p>Usamos cookies para medir resultados de campanhas e melhorar sua experiência, conforme a LGPD. ' +
      'Você pode aceitar ou recusar os cookies de marketing e análise. ' +
      '<a href="#" data-cdc="privacy">Saiba mais</a>.</p>' +
      '<div class="consent-actions">' +
        '<button class="btn btn-primary" data-consent="accept">Aceitar tudo</button>' +
        '<button class="btn btn-ghost" data-consent="reject">Só essenciais</button>' +
      '</div>';
    d.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-consent]");
      if (!b) return;
      var accept = b.getAttribute("data-consent") === "accept";
      setStored({ granted: accept, ts: Date.now() });
      applyConsent(accept);
      Track.event("consent_choice", { consent: accept ? "accept" : "essential" });
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 400);
    });
  }

  function initConsent() {
    var stored = getStored();
    var required = tel.consentRequired !== false;
    if (!required) { applyConsent(true); return; }
    if (stored && typeof stored.granted === "boolean") { applyConsent(stored.granted); return; }
    if (d.body) buildBanner(); else d.addEventListener("DOMContentLoaded", buildBanner);
  }

  // expõe reabrir preferências
  w.CDC.openConsent = function () { setStored(null); buildBanner(); };

  initConsent();
  if (d.readyState !== "loading") Track.pageView();
  else d.addEventListener("DOMContentLoaded", Track.pageView);
})(window, document);
