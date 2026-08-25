/* ============================================================
   CIA DO CORPO — Telemetria + Consentimento (LGPD)
   v2 · 25/08/2026

   O que este arquivo faz
   - Consentimento granular: essenciais (sempre), análise e marketing.
     Recusar é tão fácil quanto aceitar — um clique — como manda a LGPD.
   - Google Consent Mode v2 em "denied" antes de qualquer tag subir.
   - Sob "análise": GA4 direto e Microsoft Clarity.
     Sob "marketing": Pixel da Meta.
     O GTM sobe se qualquer uma das duas for aceita — ele é um contêiner
     e respeita os sinais do Consent Mode para as tags de dentro.
   - Eventos de conversão no dataLayer + eventos padrão do Pixel, com
     eventID para deduplicar com a API de Conversões (CAPI).
   - Reage ao config publicado pelo painel: se o Pixel ID chegar depois
     (fetch do config.json do S3), as tags sobem sem precisar recarregar.

   Os IDs vêm de CDC.data.get().telemetry — editáveis no painel admin.
   Nada de ID hard-coded aqui.
   ============================================================ */

(function (w, d) {
  "use strict";

  var CONSENT_KEY = "cdc_consent_v2";
  var CONSENT_VERSION = 2;

  /* ============================================================
     1. IDs publicados pelo painel
     ============================================================ */

  /* Os IDs precisam ter o formato real da plataforma. Placeholders que
     já foram publicados no config (ex.: "xxxxxxxx", "asxasxasxas") são
     ignorados em vez de injetar tags quebradas no site. */
  function validId(v, re) {
    return (typeof v === "string" && re.test(v.trim())) ? v.trim() : "";
  }

  function readTelemetry() {
    var raw = ((w.CDC && w.CDC.data) ? (w.CDC.data.get().telemetry || {}) : {});
    return {
      gtmId: validId(raw.gtmId, /^GTM-[A-Z0-9]{4,}$/i),
      ga4Id: validId(raw.ga4Id, /^G-[A-Z0-9]{4,}$/i),
      metaPixelId: validId(raw.metaPixelId, /^\d{5,20}$/),
      clarityId: validId(raw.clarityId, /^(?=.*\d)[a-z0-9]{6,20}$/i),
      consentRequired: raw.consentRequired !== false
    };
  }

  var tel = readTelemetry();

  /* ============================================================
     2. dataLayer + Consent Mode v2 (antes de qualquer tag)
     ============================================================ */

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

  /* ============================================================
     3. Carregamento das tags, por categoria
     ============================================================ */

  var up = { gtm: false, ga4: false, clarity: false, pixel: false };

  function loadScript(src, attrs) {
    var s = d.createElement("script");
    s.async = true; s.src = src;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    (d.head || d.documentElement).appendChild(s);
  }

  function loadGTM() {
    if (up.gtm || !tel.gtmId) return;
    up.gtm = true;
    w.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    loadScript("https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(tel.gtmId));
  }

  /* GA4 direto só faz sentido quando não há GTM — senão duplica hits. */
  function loadGA4() {
    if (up.ga4 || !tel.ga4Id || tel.gtmId) return;
    up.ga4 = true;
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(tel.ga4Id));
    gtag("js", new Date());
    gtag("config", tel.ga4Id, { anonymize_ip: true });
  }

  function loadClarity() {
    if (up.clarity || !tel.clarityId) return;
    up.clarity = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(w, d, "clarity", "script", tel.clarityId);
  }

  function loadPixel() {
    if (up.pixel || !tel.metaPixelId) return;
    up.pixel = true;
    /* Snippet oficial da Meta. O stub fbq já enfileira chamadas feitas
       antes do fbevents.js terminar de carregar — não precisamos de
       buffer próprio aqui. */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(w, d, "script", "https://connect.facebook.net/en_US/fbevents.js");
    w.fbq("init", tel.metaPixelId);
    w.fbq("track", "PageView", {}, { eventID: newEventId() });
  }

  /* ============================================================
     4. API pública de tracking
     ============================================================ */

  /* Eventos do site -> eventos padrão do Pixel. O que não estiver aqui
     vai como evento personalizado (trackCustom). */
  var FB_STANDARD = {
    lead_submit: "Lead",
    trial_request: "Lead",
    partner_lead: "Lead",
    popup_cta: "Lead",
    whatsapp_click: "Contact",
    call_click: "Contact",
    unit_selected: "ViewContent",
    geo_unit_selected: "ViewContent",
    plan_view: "ViewContent",
    schedule_visit: "Schedule",
    checkout_start: "InitiateCheckout",
    checkout_complete: "Purchase",
    anamnese_submit: "CompleteRegistration"
  };

  /* Nunca vão pro Pixel: page_view já é enviado como PageView no init e
     consent_choice é um evento interno de auditoria do consentimento. */
  var FB_SKIP = { page_view: 1, consent_choice: 1 };

  function newEventId() {
    try {
      if (w.crypto && typeof w.crypto.randomUUID === "function") return w.crypto.randomUUID();
    } catch (e) { /* ignore */ }
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* Log first-party dos eventos (alimenta o dashboard do admin sem backend) */
  function logFirstParty(name, params) {
    try {
      var key = "cdc_events";
      var arr = JSON.parse(localStorage.getItem(key) || "[]");
      arr.push({ e: name, t: Date.now(), p: params || {} });
      if (arr.length > 2000) arr = arr.slice(arr.length - 2000);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) { /* ignore */ }
  }

  var Track = {
    /* Devolve o eventID gerado — use o mesmo id no envio server-side
       (CAPI) para a Meta deduplicar navegador + servidor. */
    event: function (name, params) {
      params = params || {};
      var eventId = newEventId();

      logFirstParty(name, params);
      w.dataLayer.push(Object.assign({ event: name, event_id: eventId }, params));

      /* "up.pixel" so diz que o pixel ja subiu; quem manda e o consentimento
         de agora. Sem checar current.marketing, revogar o consentimento no
         meio da sessao nao interrompia os envios ate a proxima recarga. */
      if (!FB_SKIP[name] && up.pixel && current && current.marketing && w.fbq) {
        var std = FB_STANDARD[name];
        if (std) w.fbq("track", std, params, { eventID: eventId });
        else w.fbq("trackCustom", name, params, { eventID: eventId });
      }
      return eventId;
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
      } catch (e) { /* ignore */ }
      logFirstParty("page_view", { source: src, page: location.pathname });
      w.dataLayer.push({
        event: "page_view", page_path: location.pathname,
        page_title: d.title, traffic_source: src
      });
    }
  };

  w.CDC = w.CDC || {};
  w.CDC.track = Track;

  /* ============================================================
     5. Consentimento
     ============================================================ */

  var current = null; // { analytics: bool, marketing: bool }

  function applyConsent(c) {
    current = { analytics: !!c.analytics, marketing: !!c.marketing };

    gtag("consent", "update", {
      analytics_storage: current.analytics ? "granted" : "denied",
      ad_storage: current.marketing ? "granted" : "denied",
      ad_user_data: current.marketing ? "granted" : "denied",
      ad_personalization: current.marketing ? "granted" : "denied"
    });

    if (current.analytics || current.marketing) loadGTM();
    if (current.analytics) { loadGA4(); loadClarity(); }
    if (current.marketing) loadPixel();

    w.CDC.consent = { analytics: current.analytics, marketing: current.marketing };
  }

  function getStored() {
    try {
      var s = JSON.parse(localStorage.getItem(CONSENT_KEY));
      if (s && s.v === CONSENT_VERSION &&
          typeof s.analytics === "boolean" && typeof s.marketing === "boolean") return s;
    } catch (e) { /* ignore */ }
    return null;
  }

  function setStored(c) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        v: CONSENT_VERSION,
        analytics: !!c.analytics,
        marketing: !!c.marketing,
        ts: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function optRow(cat, titulo, texto, checked, fixo) {
    return '<label class="consent-opt">' +
      '<span class="consent-opt-txt"><strong>' + titulo + '</strong><em>' + texto + '</em></span>' +
      '<input type="checkbox"' + (cat ? ' data-cat="' + cat + '"' : "") +
        (checked ? " checked" : "") + (fixo ? " disabled" : "") + '>' +
      '</label>';
  }

  function buildBanner(openPrefs) {
    var el = d.querySelector(".consent");
    if (el) el.remove();

    var atual = getStored() || { analytics: false, marketing: false };

    el = d.createElement("div");
    el.className = "consent";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.setAttribute("aria-label", "Preferências de privacidade");
    el.innerHTML =
      '<h4>Sua privacidade importa 🍪</h4>' +
      '<p>Usamos cookies essenciais para o site funcionar. Com a sua autorização, ' +
      'usamos também cookies de <strong>análise</strong>, para entender como o site é usado, ' +
      'e de <strong>marketing</strong>, para medir e personalizar nossos anúncios. ' +
      'A escolha é sua e pode ser mudada quando quiser em ' +
      '<a href="#" data-cdc="privacy">Preferências de privacidade</a>.</p>' +

      '<div class="consent-prefs"' + (openPrefs ? "" : " hidden") + '>' +
        optRow("", "Essenciais", "Necessários para o site funcionar. Sempre ativos.", true, true) +
        optRow("analytics", "Análise", "Métricas de uso do site (Google Analytics, Clarity).", atual.analytics, false) +
        optRow("marketing", "Marketing", "Medição e personalização de anúncios (Pixel da Meta).", atual.marketing, false) +
      '</div>' +

      '<div class="consent-actions">' +
        '<button type="button" class="btn btn-primary" data-consent="accept">Aceitar tudo</button>' +
        '<button type="button" class="btn btn-ghost" data-consent="reject">Só essenciais</button>' +
        '<button type="button" class="btn-text" data-consent="prefs"' + (openPrefs ? " hidden" : "") + '>Personalizar</button>' +
        '<button type="button" class="btn-text" data-consent="save"' + (openPrefs ? "" : " hidden") + '>Salvar preferências</button>' +
      '</div>';

    d.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });

    function fechar() {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 400);
    }

    function decidir(c, origem) {
      setStored(c);
      applyConsent(c);
      Track.event("consent_choice", {
        consent_analytics: c.analytics ? "granted" : "denied",
        consent_marketing: c.marketing ? "granted" : "denied",
        consent_source: origem
      });
      fechar();
    }

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-consent]");
      if (!b) return;
      var acao = b.getAttribute("data-consent");

      if (acao === "prefs") {
        el.querySelector(".consent-prefs").hidden = false;
        el.querySelector('[data-consent="prefs"]').hidden = true;
        el.querySelector('[data-consent="save"]').hidden = false;
        return;
      }
      if (acao === "accept") return decidir({ analytics: true, marketing: true }, "aceitar_tudo");
      if (acao === "reject") return decidir({ analytics: false, marketing: false }, "so_essenciais");
      if (acao === "save") {
        var c = { analytics: false, marketing: false };
        el.querySelectorAll("[data-cat]").forEach(function (i) { c[i.getAttribute("data-cat")] = i.checked; });
        return decidir(c, "personalizado");
      }
    });
  }

  function showBanner(openPrefs) {
    if (d.body) buildBanner(openPrefs);
    else d.addEventListener("DOMContentLoaded", function () { buildBanner(openPrefs); });
  }

  function initConsent() {
    if (!tel.consentRequired) { applyConsent({ analytics: true, marketing: true }); return; }
    var stored = getStored();
    if (stored) { applyConsent(stored); return; }
    applyConsent({ analytics: false, marketing: false }); // registra o "denied" explícito
    showBanner(false);
  }

  /* Reabrir as preferências (link "Preferências de privacidade" no rodapé).
     Não apaga a escolha anterior: o painel abre já refletindo o que está salvo. */
  w.CDC.openConsent = function () { showBanner(true); };

  /* ============================================================
     6. Reagir ao config publicado pelo painel
     ============================================================
     O config.json do S3 chega por fetch, depois deste script rodar.
     Sem isto, um Pixel ID recém-publicado só valeria no próximo
     carregamento de página. */
  w.addEventListener("cdc:config-updated", function () {
    var next = readTelemetry();
    var mudou = next.gtmId !== tel.gtmId || next.ga4Id !== tel.ga4Id ||
                next.metaPixelId !== tel.metaPixelId || next.clarityId !== tel.clarityId ||
                next.consentRequired !== tel.consentRequired;
    if (!mudou) return;
    tel = next;
    if (current) applyConsent(current); // sobe o que ainda não tinha subido
    else initConsent();
  });

  /* ============================================================
     7. Boot
     ============================================================ */
  initConsent();
  if (d.readyState !== "loading") Track.pageView();
  else d.addEventListener("DOMContentLoaded", Track.pageView);
})(window, document);
