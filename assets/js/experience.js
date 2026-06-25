/* ============================================================
   CIA DO CORPO — Experience layer (máquina de vendas)
   - Personalização "Minha Unidade" (site fala com a pessoa)
   - Montador de plano guiado (quiz -> WhatsApp com contexto)
   - Barra de conversão fixa + contadores animados
   ============================================================ */
(function (w, d) {
  var DATA = w.CDC.data, T = w.CDC.track;
  var MY_KEY = "cdc_my_unit";
  var PLAN_KEY = "cdc_preselected_plan";
  var UNIT_PLAN_KEY = "cdc_unit_for_plan";
  var WA = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z"/></svg>';

  function myUnit() {
    var id = localStorage.getItem(MY_KEY);
    return (id && DATA.unitById(id)) || DATA.defaultUnit();
  }
  function setMyUnit(id) {
    localStorage.setItem(MY_KEY, id);
    if (T) T.event("unit_selected", { unit: id });
    applyUnit(); renderChips();
  }
  function waHref(unit, text) {
    unit = unit || myUnit();
    return "https://wa.me/" + (unit ? unit.whatsapp : "") + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  /* Reaponta todos os CTAs padrão para a unidade escolhida */
  function applyUnit() {
    var u = myUnit(); if (!u) return;
    var msg = "Olá! Vim pelo site da Cia do Corpo e quero fazer minha matrícula na unidade " + u.name + ".";
    d.querySelectorAll('[data-cdc="wa-default"]').forEach(function (a) {
      a.href = waHref(u, msg); a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("data-cta", "whatsapp_click"); a.setAttribute("data-unit", u.id); a.setAttribute("data-unit-name", u.name);
    });
    d.querySelectorAll('[data-cdc="my-unit-name"]').forEach(function (e) { e.textContent = u.name; });
  }

  /* Chip "Sua unidade: X — trocar" no header + hero */
  function renderChips() {
    var chosen = localStorage.getItem(MY_KEY) && DATA.unitById(localStorage.getItem(MY_KEY));
    var u = myUnit(); if (!u) return;
    var pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    d.querySelectorAll('[data-cdc="unit-chip"]').forEach(function (host) {
      host.innerHTML = chosen
        ? '<button class="unit-pick-btn" data-open-units>' + pin + 'Sua unidade: <b>' + u.name + '</b> <span>trocar</span></button>'
        : '<button class="unit-pick-btn" data-open-units>' + pin + '<b>Detectar minha unidade mais próxima</b> <span>escolher</span></button>';
    });
  }

  /* ---------- Geolocalização: unidade mais próxima ---------- */
  function haversine(a, b, c, e) {
    var R = 6371, dLat = (c - a) * Math.PI / 180, dLon = (e - b) * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function nearestUnit(lat, lng) {
    var best = null, bd = Infinity;
    DATA.activeUnits().forEach(function (u) {
      if (u.lat == null || u.lng == null) return;
      var dist = haversine(lat, lng, u.lat, u.lng);
      if (dist < bd) { bd = dist; best = u; best._dist = dist; }
    });
    return best;
  }
  function useGeolocation(onDone) {
    if (!navigator.geolocation) { if (onDone) onDone(null, "Sem suporte a GPS"); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var u = nearestUnit(pos.coords.latitude, pos.coords.longitude);
      if (u) { setMyUnit(u.id); if (T) T.event("geo_unit_selected", { unit: u.id, dist_km: Math.round(u._dist * 10) / 10 }); }
      if (onDone) onDone(u);
    }, function (err) { if (onDone) onDone(null, err.message); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 6e5 });
  }

  /* Seletor de unidade (modal leve) com botão de GPS */
  function openUnitPicker() {
    if (d.querySelector(".cdc-sheet")) return;
    var units = DATA.activeUnits();
    var sheet = h('<div class="cdc-sheet"><div class="cdc-sheet-card"><button class="cdc-sheet-x" aria-label="Fechar">&times;</button>' +
      '<h3>Escolha sua unidade</h3><p>O site se adapta a você — CTAs e WhatsApp da unidade escolhida.</p>' +
      '<button class="geo-btn" id="geoBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg> <span>Usar minha localização (mais próxima)</span></button>' +
      '<div class="unit-pick-grid">' + units.map(function (u) {
        return '<button class="unit-pick-opt" data-u="' + u.id + '"><b>' + u.name + '</b><span>' + u.city + ' · ' + (u.neighborhood || "") + '</span></button>';
      }).join("") + '</div></div></div>');
    d.body.appendChild(sheet); requestAnimationFrame(function () { sheet.classList.add("show"); });
    function close() { sheet.classList.remove("show"); setTimeout(function () { sheet.remove(); }, 250); }
    sheet.querySelector(".cdc-sheet-x").onclick = close;
    sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
    sheet.querySelectorAll(".unit-pick-opt").forEach(function (b) { b.onclick = function () { setMyUnit(b.getAttribute("data-u")); close(); }; });
    var gb = sheet.querySelector("#geoBtn");
    gb.onclick = function () {
      gb.classList.add("loading"); gb.querySelector("span").textContent = "Localizando...";
      useGeolocation(function (u, err) {
        if (u) { gb.querySelector("span").textContent = "Encontramos: " + u.name + " ✓"; setTimeout(close, 700); }
        else { gb.classList.remove("loading"); gb.querySelector("span").textContent = "Não foi possível localizar — escolha abaixo"; }
      });
    };
  }

  /* ---------- Barra de conversão fixa ---------- */
  function buildStickyBar() {
    if (d.querySelector(".sticky-cta")) return;
    var bar = h('<div class="sticky-cta"><div class="sticky-inner">' +
      '<div class="sticky-txt"><b>Comece com 3 dias grátis</b><span data-cdc="my-unit-name">sua unidade</span></div>' +
      '<div class="sticky-actions">' +
        '<button class="btn-sticky ghost" data-quiz>Montar meu plano</button>' +
        '<a class="btn-sticky wa" data-cdc="wa-default" href="#">' + WA + ' Agendar no WhatsApp</a>' +
      '</div></div></div>');
    d.body.appendChild(bar);
    var hero = d.querySelector(".hero, .page-hero");
    var trigger = hero ? hero.offsetHeight * 0.7 : 500;
    function onScroll() { bar.classList.toggle("show", w.scrollY > trigger); d.body.classList.toggle("has-sticky", w.scrollY > trigger); }
    onScroll(); w.addEventListener("scroll", onScroll, { passive: true });
    applyUnit();
  }

  /* ---------- Contadores animados ---------- */
  function counters() {
    var els = d.querySelectorAll("[data-count]");
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        var to = parseFloat(e.target.getAttribute("data-count")), suf = e.target.getAttribute("data-suffix") || "", t0 = 0, dur = 1200, s = performance.now();
        (function step(now) { var p = Math.min((now - s) / dur, 1); var v = (to * (1 - Math.pow(1 - p, 3)));
          e.target.textContent = (to % 1 ? v.toFixed(1) : Math.round(v)) + suf; if (p < 1) requestAnimationFrame(step); })(s);
       });
    }, { threshold: .5 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- Quiz / Montador de plano ---------- */
  var QUIZ = [
    { k: "objetivo", q: "Qual seu principal objetivo?", o: [["emagrecer", "Emagrecer", "🔥"], ["massa", "Ganhar massa", "💪"], ["saude", "Saúde & bem-estar", "🌿"], ["luta", "Lutas / condicionamento", "🥊"]] },
    { k: "momento", q: "Como está sua rotina de treino hoje?", o: [["iniciante", "Quero começar", "🌱"], ["voltando", "Estou voltando", "🔄"], ["ativo", "Já treino", "⚡"]] },
    { k: "modalidade", q: "O que mais te anima?", o: [["musculacao", "Musculação", "🏋️"], ["coletivas", "Aulas coletivas", "🎵"], ["lutas", "Muay Thai", "🥊"], ["tudo", "Quero tudo", "✨"]] }
  ];
  function openQuiz() {
    if (d.querySelector(".quiz")) return;
    if (T) T.event("quiz_start", {});
    var ans = {}, step = 0;
    var u = myUnit();
    var preselectedPlan = localStorage.getItem(PLAN_KEY);
    var preselectedUnit = localStorage.getItem(UNIT_PLAN_KEY);
    var ov = h('<div class="quiz"><div class="quiz-card"><button class="quiz-x" aria-label="Fechar">&times;</button>' +
      '<div class="quiz-progress"><i></i></div><div class="quiz-body"></div></div></div>');
    d.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("show"); });
    function close() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 250); }
    ov.querySelector(".quiz-x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });

    function setProg() { ov.querySelector(".quiz-progress i").style.width = (step / (QUIZ.length + 1) * 100) + "%"; }
    function render() {
      setProg();
      var body = ov.querySelector(".quiz-body");
      if (step < QUIZ.length) {
        var s = QUIZ[step];
        body.innerHTML = '<span class="quiz-step">Passo ' + (step + 1) + ' de ' + (QUIZ.length + 1) + '</span><h3>' + s.q + '</h3><div class="quiz-opts">' +
          s.o.map(function (o) { return '<button class="quiz-opt" data-v="' + o[0] + '"><span class="em">' + o[2] + '</span>' + o[1] + '</button>'; }).join("") + '</div>';
        body.querySelectorAll(".quiz-opt").forEach(function (b) { b.onclick = function () {
          var v = b.getAttribute("data-v"); var opt = s.o.filter(function (o) { return o[0] === v; })[0];
          ans[s.k] = v; ans[s.k + "_label"] = opt ? opt[1] : v; step++; render();
        }; });
      } else {
        // resultado
        var unitOpts = DATA.activeUnits().map(function (x) {
          var selected = (preselectedUnit && x.id === preselectedUnit) || (u && x.id === u.id);
          return '<option value="' + x.id + '"' + (selected ? " selected" : "") + '>' + x.name + ' — ' + x.city + '</option>';
        }).join("");
        var plano = preselectedPlan || (ans.modalidade === "musculacao" ? "Plus" : "Hexa");
        body.innerHTML = '<span class="quiz-step">Seu plano recomendado</span>' +
          '<div class="quiz-result"><div class="quiz-badge">' + plano + '</div>' +
          '<h3>Plano ' + plano + ' é a sua cara</h3>' +
          (preselectedPlan ?
            '<p>Você selecionou o plano <b>' + plano + '</b> na página de planos — perfeito! Confirme a unidade abaixo.</p>' :
            '<p>Com base no seu objetivo de <b>' + (ans.objetivo_label || "treinar") + '</b>, recomendamos o plano <b>' + plano + '</b>' + (plano === "Hexa" ? " — acesso total a musculação, aulas coletivas e artes marciais." : " — foco total em musculação com toda a estrutura.") + '</p>'
          ) + '</div>' +
          '<div class="quiz-field"><label>Onde quer treinar?</label><select class="quiz-unit">' + unitOpts + '</select></div>' +
          '<a class="btn-quiz" id="quizGo">' + WA + ' Agendar meus 3 dias grátis</a>' +
          '<button class="quiz-restart">Refazer</button>';
        body.querySelector(".quiz-restart").onclick = function () { step = 0; ans = {}; render(); };
        body.querySelector("#quizGo").onclick = function () {
          var uid = body.querySelector(".quiz-unit").value; var un = DATA.unitById(uid) || u;
          var lines = [
            "Olá! Montei meu plano no site da Cia do Corpo e quero agendar meus 3 dias grátis.",
            "",
            (preselectedPlan ? "*Plano selecionado:* " + plano : "*Objetivo:* " + (ans.objetivo_label || "-")),
            (preselectedPlan ? "" : "*Momento:* " + (ans.momento_label || "-")),
            (preselectedPlan ? "" : "*Interesse:* " + (ans.modalidade_label || "-")),
            "*Plano ideal:* " + plano,
            "*Unidade:* " + (un ? un.name : "-"),
            "",
            "Pode me ajudar a agendar?"
          ].filter(function(l) { return l !== ""; });
          var msg = encodeURIComponent(lines.join("\n"));
          if (T) T.event("trial_request", { unit: un ? un.id : "", plano: plano, objetivo: ans.objetivo, preselected: !!preselectedPlan, location_page: "quiz" });
          w.open("https://wa.me/" + (un ? un.whatsapp : "") + "?text=" + msg, "_blank");
          close();
        };
      }
    }
    render();
  }

  /* ---------- Quero ser parceiro (form -> painel + WhatsApp central) ---------- */
  function openPartnerForm() {
    if (d.querySelector(".cdc-sheet")) return;
    var cfg = DATA.get();
    var cats = cfg.partnerCategories || [];
    if (T) T.event("partner_form_open", {});
    var sheet = h('<div class="cdc-sheet"><div class="cdc-sheet-card">' +
      '<button class="cdc-sheet-x" aria-label="Fechar">&times;</button>' +
      '<h3>Quero ser parceiro</h3><p>Preencha e o time da Cia do Corpo entra em contato para montar a parceria.</p>' +
      '<form id="pform">' +
        '<div class="form-row"><div class="field"><label>Seu nome*</label><input name="nome" required></div>' +
        '<div class="field"><label>Empresa*</label><input name="empresa" required></div></div>' +
        '<div class="form-row"><div class="field"><label>Categoria</label><select name="categoria">' + cats.map(function (c) { return '<option>' + c + '</option>'; }).join("") + '</select></div>' +
        '<div class="field"><label>WhatsApp*</label><input name="telefone" inputmode="tel" required></div></div>' +
        '<div class="form-row"><div class="field"><label>Instagram</label><input name="instagram" placeholder="@suaempresa"></div>' +
        '<div class="field"><label>Cidade</label><input name="cidade"></div></div>' +
        '<div class="field"><label>Qual benefício quer oferecer aos alunos?</label><textarea name="beneficio" placeholder="Ex.: 15% de desconto, 1ª avaliação grátis..."></textarea></div>' +
        '<button type="submit" class="btn btn-primary btn-lg btn-block">Enviar para a Cia do Corpo</button>' +
        '<p style="font-size:.78rem;color:var(--text-soft);margin:12px 0 0;text-align:center">Registramos seu contato no painel e abrimos o WhatsApp com a central.</p>' +
      '</form></div></div>');
    d.body.appendChild(sheet); requestAnimationFrame(function () { sheet.classList.add("show"); });
    function close() { sheet.classList.remove("show"); setTimeout(function () { sheet.remove(); }, 250); }
    sheet.querySelector(".cdc-sheet-x").onclick = close;
    sheet.addEventListener("click", function (e) { if (e.target === sheet) close(); });
    sheet.querySelector("#pform").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var data = { nome: f.nome.value, empresa: f.empresa.value, categoria: f.categoria.value, telefone: f.telefone.value,
        instagram: f.instagram.value, cidade: f.cidade.value, beneficio: f.beneficio.value, ts: Date.now(), status: "novo" };
      try { var k = "cdc_partner_leads"; var arr = JSON.parse(localStorage.getItem(k) || "[]"); arr.push(data); localStorage.setItem(k, JSON.stringify(arr)); } catch (x) {}
      if (T) T.event("partner_lead", { empresa: data.empresa, categoria: data.categoria });
      var central = (cfg.meta && cfg.meta.partnerCentralWhatsapp) || "";
      var lines = ["*QUERO SER PARTE DO CLUBE DA PARCERIA*", "",
        "*Empresa:* " + data.empresa, "*Responsável:* " + data.nome, "*Categoria:* " + data.categoria,
        "*WhatsApp:* " + data.telefone, (data.instagram ? "*Instagram:* " + data.instagram : ""),
        (data.cidade ? "*Cidade:* " + data.cidade : ""), (data.beneficio ? "*Benefício:* " + data.beneficio : "")].filter(Boolean);
      if (central) w.open("https://wa.me/" + central + "?text=" + encodeURIComponent(lines.join("\n")), "_blank");
      var card = sheet.querySelector(".cdc-sheet-card");
      card.innerHTML = '<button class="cdc-sheet-x" aria-label="Fechar">&times;</button>' +
        '<div style="text-align:center;padding:14px 0"><div style="font-size:3rem;margin-bottom:6px">✅</div>' +
        '<h3>Recebido!</h3><p>Seu contato foi registrado e abrimos o WhatsApp com a central. Em breve a Cia do Corpo fala com você.</p>' +
        '<button class="btn btn-primary" id="pfdone">Fechar</button></div>';
      card.querySelector(".cdc-sheet-x").onclick = close; card.querySelector("#pfdone").onclick = close;
    });
  }

  function h(s) { var t = d.createElement("template"); t.innerHTML = s.trim(); return t.content.firstChild; }

  /* Delegação de cliques */
  d.addEventListener("click", function (e) {
    if (e.target.closest("[data-quiz]")) { e.preventDefault(); openQuiz(); }
    if (e.target.closest("[data-open-units]")) { e.preventDefault(); openUnitPicker(); }
    if (e.target.closest("[data-partner-form]")) { e.preventDefault(); openPartnerForm(); }
    // Captura clique em planos para pré-selecionar
    if (e.target.closest("[data-plan-name]")) {
      var btn = e.target.closest("[data-plan-name]");
      var planName = btn.getAttribute("data-plan-name");
      var unitId = btn.getAttribute("data-unit");
      localStorage.setItem(PLAN_KEY, planName);
      localStorage.setItem(UNIT_PLAN_KEY, unitId);
    }
  });

  function init() { applyUnit(); renderChips(); buildStickyBar(); counters(); }
  d.readyState !== "loading" ? init() : d.addEventListener("DOMContentLoaded", init);
  // re-aplica após o site.js renderizar (unidades/oferta)
  w.addEventListener("load", function () { setTimeout(function () { applyUnit(); renderChips(); }, 120); });
  w.CDC.exp = { openQuiz: openQuiz, openUnitPicker: openUnitPicker, openPartnerForm: openPartnerForm, applyUnit: applyUnit };
})(window, document);
