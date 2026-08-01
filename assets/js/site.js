/* ============================================================
   CIA DO CORPO — Site engine (client-side, data-driven)
   Renderiza unidades, popups/campanhas, injeta oferta, schema
   LocalBusiness e telemetria de conversão (WhatsApp / ligar).
   ============================================================ */
(function (w, d) {
  var DATA = w.CDC.data;
  var ICON = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    whats: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.115zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };

  function el(html) { var t = d.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function waLink(num, text) { return "https://wa.me/" + num + (text ? "?text=" + encodeURIComponent(text) : ""); }
  function telLink(phone) { return "tel:+55" + phone.replace(/\D/g, ""); }
  function currentPage() {
    var p = location.pathname.split("/").pop().replace(".html", "");
    return p || "index";
  }

  /* ---------- Render unit cards ---------- */
  function unitCard(u) {
    var msg = "Olá! Vim pelo site e quero agendar minha aula experimental na unidade " + u.name + ".";
    var tierLabel = u.tier === "exclusive" ? '<span class="unit-chip exclusive">Exclusive</span>' : '<span class="unit-chip">' + u.city + '</span>';
    return el(
      '<article class="unit-card reveal">' +
        '<div class="unit-media">' + tierLabel +
          '<img loading="lazy" src="' + u.image + '" alt="Academia Cia do Corpo - unidade ' + u.name + ' em ' + u.city + '">' +
        '</div>' +
        '<div class="unit-body">' +
          '<h3><a href="unidade.html?u=' + u.id + '" style="color:inherit">' + u.name + '</a></h3>' +
          '<div class="unit-addr">' + ICON.pin + '<span>' + u.address + '</span></div>' +
          '<a href="unidade.html?u=' + u.id + '" class="unit-link">Ver página da unidade →</a>' +
          '<div class="unit-actions">' +
            '<a class="btn btn-whats" target="_blank" rel="noopener" href="' + waLink(u.whatsapp, msg) + '" ' +
              'data-cta="whatsapp_click" data-unit="' + u.id + '" data-unit-name="' + u.name + '">' + ICON.whats + ' Agendar aula</a>' +
            '<a class="icon-btn" href="' + telLink(u.phone) + '" aria-label="Ligar para ' + u.name + '" ' +
              'data-cta="call_click" data-unit="' + u.id + '" data-unit-name="' + u.name + '">' + ICON.phone + '</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderUnits() {
    var units = DATA.activeUnits();
    d.querySelectorAll('[data-cdc="units"]').forEach(function (box) {
      var limit = parseInt(box.getAttribute("data-limit") || "0", 10);
      var list = limit ? units.slice(0, limit) : units;
      box.innerHTML = "";
      list.forEach(function (u) { box.appendChild(unitCard(u)); });
      // re-observe reveals
      box.querySelectorAll(".reveal").forEach(function (e) { e.classList.add("in"); });
    });
    // counters
    d.querySelectorAll('[data-cdc="unit-count"]').forEach(function (e) { e.textContent = units.length; });
  }

  /* ---------- Oferta dinâmica ---------- */
  function applyOffer() {
    var cfg = DATA.get();
    var o = cfg.offer || {};
    d.querySelectorAll('[data-cdc="offer-badge"]').forEach(function (e) { e.textContent = o.badge || ""; });
    d.querySelectorAll('[data-cdc="years"]').forEach(function (e) { e.textContent = (cfg.meta.yearsActive || 13) + ""; });
    var du = DATA.defaultUnit();
    if (du) {
      var msg = "Olá! Vim pelo site da Cia do Corpo e quero agendar minha aula experimental gratuita.";
      d.querySelectorAll('[data-cdc="wa-default"]').forEach(function (a) {
        a.setAttribute("href", waLink(du.whatsapp, msg));
        a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener");
        a.setAttribute("data-cta", "whatsapp_click"); a.setAttribute("data-unit", du.id);
      });
    }
  }

  /* ---------- Telemetria de conversão (delegação) ---------- */
  d.addEventListener("click", function (e) {
    var t = e.target.closest("[data-cta]");
    if (!t || !w.CDC.track) return;
    w.CDC.track.event(t.getAttribute("data-cta"), {
      unit: t.getAttribute("data-unit") || "",
      unit_name: t.getAttribute("data-unit-name") || "",
      location_page: currentPage()
    });
  });

  /* ---------- Popups / Campanhas ---------- */
  function popupSeen(id, freq) {
    var key = "cdc_popup_" + id;
    try {
      var v = localStorage.getItem(key);
      if (!v) return false;
      if (freq === "always") return false;
      if (freq === "session") return sessionStorage.getItem(key) === "1";
      if (freq === "daily") return (Date.now() - parseInt(v, 10)) < 864e5;
      return true;
    } catch (e) { return false; }
  }
  function markSeen(id) {
    try { localStorage.setItem("cdc_popup_" + id, Date.now() + ""); sessionStorage.setItem("cdc_popup_" + id, "1"); } catch (e) {}
  }
  function dateOk(p) {
    var today = new Date().toISOString().slice(0, 10);
    if (p.startDate && today < p.startDate) return false;
    if (p.endDate && today > p.endDate) return false;
    return true;
  }
  function pageOk(p) {
    if (!p.pages || p.pages.indexOf("all") > -1) return true;
    return p.pages.indexOf(currentPage()) > -1;
  }

  function showPopup(p) {
    if (d.querySelector(".cdc-popup")) return;
    var href = "#";
    // CTA de WhatsApp da campanha passa pelo quiz (qualifica o lead) — ver handler abaixo.
    if (p.ctaType === "link") { href = p.ctaTarget || "#"; }

    var overlay = el(
      '<div class="cdc-popup" data-theme="' + (p.theme || "brand") + '">' +
        '<div class="cdc-popup-card">' +
          '<button class="cdc-popup-close" aria-label="Fechar">' + ICON.close + '</button>' +
          (p.image ? '<div class="cdc-popup-media"><img src="' + p.image + '" alt=""></div>' : '') +
          '<div class="cdc-popup-body">' +
            '<h3>' + p.headline + '</h3>' +
            '<p>' + p.body + '</p>' +
            '<a class="btn btn-primary btn-lg btn-block cdc-popup-cta" ' + (p.ctaType === "link" ? 'target="_blank" rel="noopener"' : '') + ' href="' + href + '">' + (p.ctaLabel || "Quero saber mais") + '</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    d.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add("show"); });
    markSeen(p.id);
    if (w.CDC.track) w.CDC.track.event("popup_view", { popup_id: p.id, popup_name: p.name });

    var card = overlay.querySelector(".cdc-popup-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", p.name || "Campanha");
    var opener = d.activeElement;
    function close() {
      d.removeEventListener("keydown", onKey, true);
      overlay.classList.remove("show"); setTimeout(function () { overlay.remove(); }, 300);
      if (opener && opener.focus) { try { opener.focus(); } catch (e) {} }
    }
    function onKey(e) { if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); close(); } }
    d.addEventListener("keydown", onKey, true);
    requestAnimationFrame(function () {
      var cta = overlay.querySelector(".cdc-popup-cta");
      try { (cta || card).focus({ preventScroll: true }); } catch (e) {}
    });
    overlay.querySelector(".cdc-popup-close").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.querySelector(".cdc-popup-cta").addEventListener("click", function (e) {
      if (w.CDC.track) w.CDC.track.event("popup_cta", { popup_id: p.id, popup_name: p.name });
      close();
      // CTA de WhatsApp da campanha: abre o quiz para qualificar o lead antes do WhatsApp
      if (p.ctaType === "whatsapp") {
        e.preventDefault();
        if (w.CDC.exp && w.CDC.exp.openQuiz) w.CDC.exp.openQuiz();
      }
    });
  }

  function schedulePopup(p) {
    if (p.trigger === "load") return showPopup(p);
    if (p.trigger === "time") return void setTimeout(function () { showPopup(p); }, (p.triggerValue || 5) * 1000);
    if (p.trigger === "scroll") {
      var fn = function () {
        var pct = (w.scrollY + w.innerHeight) / d.body.scrollHeight * 100;
        if (pct >= (p.triggerValue || 50)) { w.removeEventListener("scroll", fn); showPopup(p); }
      };
      return w.addEventListener("scroll", fn, { passive: true });
    }
    if (p.trigger === "exit") {
      var ex = function (e) { if (e.clientY <= 0) { d.removeEventListener("mouseout", ex); showPopup(p); } };
      return d.addEventListener("mouseout", ex);
    }
  }

  function initPopups() {
    if (sessionStorage.getItem("cdc_admin_preview")) return; // não disparar em preview
    var pops = (DATA.get().popups || []).filter(function (p) {
      return p.active && dateOk(p) && pageOk(p) && !popupSeen(p.id, p.frequency);
    });
    // agenda todos os elegíveis pelo próprio gatilho; showPopup garante 1 por vez
    pops.forEach(function (p) { schedulePopup(p); });
  }

  /* ---------- JSON-LD LocalBusiness por unidade (GEO/SEO) ---------- */
  function injectSchema() {
    var cfg = DATA.get();
    var units = DATA.activeUnits().map(function (u) {
      return {
        "@type": "ExerciseGym", "@id": cfg.meta.domain + "/#" + u.id,
        name: "Cia do Corpo — " + u.name,
        image: u.image, telephone: u.phone, address: { "@type": "PostalAddress", streetAddress: u.address, addressLocality: u.city, addressRegion: "PE", addressCountry: "BR" },
        areaServed: u.city, url: cfg.meta.domain + "/unidades",
        sameAs: [cfg.meta.instagram, cfg.meta.facebook]
      };
    });
    var graph = {
      "@context": "https://schema.org",
      "@graph": [{
        "@type": "Organization", "@id": cfg.meta.domain + "/#org", name: cfg.meta.siteName,
        legalName: cfg.meta.legalName, url: cfg.meta.domain, email: cfg.meta.email,
        sameAs: [cfg.meta.instagram, cfg.meta.facebook],
        foundingDate: (new Date().getFullYear() - (cfg.meta.yearsActive || 13)) + ""
      }].concat(units)
    };
    var s = d.createElement("script"); s.type = "application/ld+json";
    s.textContent = JSON.stringify(graph); d.head.appendChild(s);
  }

  /* ---------- Footer hours ---------- */
  function renderHours() {
    var cfg = DATA.get();
    d.querySelectorAll('[data-cdc="hours"]').forEach(function (ul) {
      ul.innerHTML = cfg.meta.hours.map(function (h) { return "<li><span>" + h.d + "</span><b>" + h.h + "</b></li>"; }).join("");
    });
    d.querySelectorAll('[data-cdc="cnpj"]').forEach(function (e) { e.textContent = cfg.meta.cnpj; });
    d.querySelectorAll('[data-cdc="legal"]').forEach(function (e) { e.textContent = cfg.meta.legalName; });
    d.querySelectorAll('[data-cdc="ig"]').forEach(function (e) { e.href = cfg.meta.instagram; });
    d.querySelectorAll('[data-cdc="fb"]').forEach(function (e) { e.href = cfg.meta.facebook; });
  }

  /* ---------- Logo oficial Cia do Corpo (lockup horizontal branco) ----------
     Usa o arquivo local (offline). Se ainda não existir, cai no link da Wix. */
  var LOCAL_LOGO = "assets/img/LOGO-HORI-BRA.png";
  var HOTLINK_LOGO = "https://static.wixstatic.com/media/837beb_b9d0229eec144443a8c5b28950c17874~mv2.png/v1/fill/w_550,h_130,al_c,q_90,enc_auto/logo-hori.png";
  function renderBrand() {
    d.querySelectorAll(".brand-logo").forEach(function (b) {
      if (b.querySelector("img.brand-img")) return;
      b.innerHTML = '<img class="brand-img" src="' + LOCAL_LOGO + '" alt="Cia do Corpo" onerror="this.onerror=null;this.src=\'' + HOTLINK_LOGO + '\'">';
    });
  }

  /* ---------- Planos por unidade (seletor + cards) ---------- */
  var CHK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>';
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function planCard(item, unit) {
    var badges = (item.badges || []).map(function (b) { return '<span class="plan-badge pb-' + (b.c || "blue") + '">' + esc(b.t) + '</span>'; }).join("");
    var feats = (item.features || []).map(function (f) { return '<li>' + CHK + ' ' + esc(f) + '</li>'; }).join("");
    var priceOld = item.old ? '<span class="old">' + esc(item.old) + '</span>' : '';
    var priceSmall = item.unit ? '<small>' + esc(item.unit) + '</small>' : '';
    return el(
      '<article class="plan' + (item.featured ? ' featured' : '') + ' reveal">' +
        (item.featured ? '<span class="ribbon">Mais escolhido</span>' : '') +
        '<h3>' + esc(item.name) + '</h3><p class="plan-desc">' + esc(item.desc) + '</p>' +
        '<div class="plan-price">' + esc(item.price) + priceSmall + priceOld + '</div>' +
        (item.note ? '<div class="plan-note">' + esc(item.note) + '</div>' : '') +
        (badges ? '<div class="plan-badges">' + badges + '</div>' : '') +
        '<ul>' + feats + '</ul>' +
        '<button type="button" class="btn ' + (item.featured ? 'btn-primary' : 'btn-ghost') + ' btn-block" ' +
          'data-plan-select data-plan-key="' + esc(item.key || "") + '" data-unit="' + unit.id + '" data-unit-name="' + esc(unit.name) + '">' + esc(item.cta || ("Quero o " + item.name)) + '</button>' +
      '</article>'
    );
  }
  function renderPlans() {
    var host = d.querySelector('[data-cdc="plans-grid"]');
    if (!host) return;
    var cfg = DATA.get();
    var plansCfg = cfg.plans || {};
    var byUnit = plansCfg.byUnit || {};
    var units = DATA.activeUnits().filter(function (u) { return byUnit[u.id]; });
    // Fallback: uma config salva no localStorage de versão antiga (ex.: ids de unidade
    // diferentes) deixaria a seção de planos vazia. Nesse caso, renderiza a partir do
    // seed (config.js) para a seção nunca sumir.
    if (!units.length && DATA.seed) {
      var seed = DATA.seed();
      plansCfg = (seed && seed.plans) || {};
      byUnit = plansCfg.byUnit || {};
      units = ((seed && seed.units) || []).filter(function (u) { return u.active !== false && byUnit[u.id]; });
    }
    if (!units.length) return;
    var selWrap = d.querySelector('[data-cdc="plan-unit-select"]');
    var titleEl = d.querySelector('[data-cdc="plan-unit-title"]');
    var incEl = d.querySelector('[data-cdc="plan-unit-included"]');
    var tierEl = d.querySelector('[data-cdc="plan-unit-tier"]');
    var groups = (plansCfg.groupsOrder || []).slice();
    units.forEach(function (u) { var t = byUnit[u.id].tierLabel || "Unidades"; if (groups.indexOf(t) < 0) groups.push(t); });
    if (selWrap) {
      selWrap.innerHTML = groups.map(function (g) {
        var us = units.filter(function (u) { return (byUnit[u.id].tierLabel || "Unidades") === g; });
        if (!us.length) return "";
        return '<div class="pus-group"><div class="pus-label">' + esc(g) + '</div><div class="pus-btns">' +
          us.map(function (u) { return '<button class="pus-btn" data-unit-btn="' + u.id + '">' + esc(u.name) + '</button>'; }).join("") +
          '</div></div>';
      }).join("");
    }
    function select(uid) {
      var u = units.filter(function (x) { return x.id === uid; })[0] || units[0];
      var pg = byUnit[u.id];
      if (tierEl) { var isExcl = /exclus/i.test(pg.tierLabel || ""); tierEl.textContent = pg.tierLabel || ""; tierEl.className = "plan-unit-tier" + (isExcl ? " excl" : ""); tierEl.style.display = pg.tierLabel ? "inline-block" : "none"; }
      if (titleEl) titleEl.textContent = u.name;
      if (incEl) incEl.innerHTML = pg.includedText ? ('Unidades incluídas: <b>' + esc(pg.includedText) + '</b>') : '';
      host.innerHTML = "";
      (pg.items || []).forEach(function (it) { host.appendChild(planCard(it, u)); });
      host.querySelectorAll(".reveal").forEach(function (e) { e.classList.add("in"); });
      if (selWrap) selWrap.querySelectorAll("[data-unit-btn]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-unit-btn") === u.id); });
    }
    if (selWrap) selWrap.querySelectorAll("[data-unit-btn]").forEach(function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-unit-btn")); });
    });
    var def = DATA.defaultUnit();
    select(def && byUnit[def.id] ? def.id : units[0].id);
  }

  function init() {
    renderBrand(); renderUnits(); renderPlans(); applyOffer(); renderHours(); injectSchema(); initPopups();
  }
  d.readyState !== "loading" ? init() : d.addEventListener("DOMContentLoaded", init);
})(window, document);
