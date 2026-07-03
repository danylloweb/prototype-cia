/* ============================================================
   CIA DO CORPO — Experience layer (máquina de vendas)
   - Personalização "Minha Unidade" (site fala com a pessoa)
   - Montador de plano guiado (quiz -> WhatsApp com contexto)
   - Barra de conversão fixa + contadores animados
   ============================================================ */
(function (w, d) {
  var DATA = w.CDC.data, T = w.CDC.track;
  var MY_KEY = "cdc_my_unit";
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
    // Só aparece para quem já treina / está voltando — ajuda a receber ex-aluno da Cia (regularização)
    // ou quem vem de outra academia (aula experimental) sem a atendente precisar perguntar depois.
    { k: "origem", q: "Só pra te receber do jeito certo:", when: function (a) { return a.momento === "voltando" || a.momento === "ativo"; }, o: [["ciadocorpo", "Já treinei na Cia do Corpo", "🏠"], ["outra", "Já treinei em outra academia", "🏋️"]] },
    { k: "modalidade", q: "O que mais te anima?", o: [["musculacao", "Musculação", "🏋️"], ["coletivas", "Aulas coletivas", "🎵"], ["lutas", "Muay Thai", "🥊"], ["tudo", "Quero tudo", "✨"]] }
  ];
  function planItemFor(un, key) {
    if (!un || !key) return null;
    var cfg = DATA.get();
    var pg = (cfg.plans && cfg.plans.byUnit) ? cfg.plans.byUnit[un.id] : null;
    if (!pg) return null;
    return (pg.items || []).filter(function (it) { return it.key === key; })[0] || null;
  }
  var PLAN_NAMES = { basic: "Basic+", vip: "Anual VIP", mensal: "Mensal" };
  function qesc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  function openQuiz(opts) {
    opts = opts || {};
    if (d.querySelector(".quiz")) return;
    var preKey = opts.planKey || null;
    if (T) T.event(preKey ? "plan_select_start" : "quiz_start", preKey ? { plano: preKey } : {});
    var ans = {}, step = 0;
    var u = (opts.unitId && DATA.unitById(opts.unitId)) || myUnit();
    var ov = h('<div class="quiz"><div class="quiz-card"><button class="quiz-x" aria-label="Fechar">&times;</button>' +
      '<div class="quiz-progress"><i></i></div><div class="quiz-body"></div></div></div>');
    d.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("show"); });
    function close() { ov.classList.remove("show"); setTimeout(function () { ov.remove(); }, 250); }
    ov.querySelector(".quiz-x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });

    function steps() { return QUIZ.filter(function (q) { return !q.when || q.when(ans); }); }
    function setProg() { ov.querySelector(".quiz-progress i").style.width = (step / (steps().length + 1) * 100) + "%"; }
    function renderSelected() {
      var prog = ov.querySelector(".quiz-progress i"); if (prog) prog.style.width = "100%";
      var body = ov.querySelector(".quiz-body");
      var planName = (planItemFor(u, preKey) || {}).name || PLAN_NAMES[preKey] || "Seu plano";
      var unitOpts = DATA.activeUnits().map(function (x) { return '<option value="' + x.id + '"' + (u && x.id === u.id ? " selected" : "") + '>' + x.name + ' — ' + x.city + '</option>'; }).join("");
      body.innerHTML = '<span class="quiz-step">Seu plano selecionado</span>' +
        '<div class="quiz-result"><div class="quiz-badge">' + qesc(planName) + '</div>' +
        '<h3>' + qesc(planName) + ' — ótima escolha</h3>' +
        '<ul id="quizFeats" style="list-style:none;margin:14px 0 0;padding:0;display:grid;gap:8px"></ul>' +
        '<div id="quizPrice" style="margin-top:12px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.06);font-size:.92rem"></div></div>' +
        '<div class="quiz-field">' +
          '<div id="quizUnitConfirm"><label style="display:block;margin-bottom:6px">Sua unidade</label>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.06)">' +
              '<b id="quizUnitName"></b>' +
              '<button type="button" class="quiz-unit-change" style="background:none;border:none;color:var(--brand,#ff5a00);font-weight:700;font-size:.8rem;cursor:pointer;padding:0;text-decoration:underline;white-space:nowrap">Trocar minha unidade</button>' +
            '</div>' +
          '</div>' +
          '<div id="quizUnitPick" style="display:none"><label>Onde quer treinar?</label><select class="quiz-unit">' + unitOpts + '</select></div>' +
        '</div>' +
        '<div class="quiz-field"><label>Melhor dia para sua aula experimental</label><select class="quiz-day">' +
          [["terca","Terça-feira"],["quarta","Quarta-feira"],["quinta","Quinta-feira"],["sexta","Sexta-feira"]].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></div>' +
        '<div class="quiz-field"><label>Qual período?</label><select class="quiz-period">' +
          [["manha","Manhã — 7h às 11h"],["tarde","Tarde — 12h às 18h"],["noite","Noite — 19h às 22h"]].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></div>' +
        '<a class="btn-quiz" id="quizGo">' + WA + ' Agendar meus 3 dias grátis</a>' +
        '<button class="quiz-restart">Escolher outro plano</button>';
      function itemNow() { return planItemFor(DATA.unitById(body.querySelector(".quiz-unit").value) || u, preKey); }
      function priceText(it) { return it ? ((it.price || "") + (it.unit || "") + (it.note ? (" " + it.note) : "")) : ""; }
      function refresh() {
        var un = DATA.unitById(body.querySelector(".quiz-unit").value) || u;
        var nEl = body.querySelector("#quizUnitName"); if (nEl) nEl.textContent = un.name;
        var it = itemNow();
        var feats = (it && it.features) || [];
        body.querySelector("#quizFeats").innerHTML = feats.map(function (f) { return '<li style="display:flex;gap:8px;align-items:flex-start;font-size:.92rem"><span style="color:var(--brand,#ff5a00);font-weight:800;line-height:1.3">✓</span><span>' + qesc(f) + '</span></li>'; }).join("");
        var pt = priceText(it);
        body.querySelector("#quizPrice").innerHTML = pt
          ? ('Na unidade <b>' + qesc(un.name) + '</b>, o ' + qesc(planName) + ' sai por <b>' + qesc(pt) + '</b>.<br><span style="opacity:.65">Condição final confirmada no atendimento — e você ainda testa 3 dias grátis antes.</span>')
          : ('Na unidade <b>' + qesc(un.name) + '</b>. Condição confirmada no atendimento — com 3 dias grátis antes.');
      }
      var confirmBox = body.querySelector("#quizUnitConfirm");
      var pickBox = body.querySelector("#quizUnitPick");
      refresh();
      body.querySelector(".quiz-unit-change").onclick = function () { confirmBox.style.display = "none"; pickBox.style.display = "block"; };
      body.querySelector(".quiz-unit").onchange = function () { refresh(); confirmBox.style.display = "block"; pickBox.style.display = "none"; };
      body.querySelector(".quiz-restart").onclick = close;
      body.querySelector("#quizGo").onclick = function () {
        var un = DATA.unitById(body.querySelector(".quiz-unit").value) || u;
        var it = itemNow();
        var daySel = body.querySelector(".quiz-day"); var perSel = body.querySelector(".quiz-period");
        var diaLabel = daySel ? daySel.options[daySel.selectedIndex].text : "-";
        var perLabel = perSel ? perSel.options[perSel.selectedIndex].text : "-";
        var feats = (it && it.features) || [];
        var lines = [
          "Olá! Escolhi meu plano no site da Cia do Corpo e quero agendar meus 3 dias grátis.",
          "",
          "*Plano selecionado:* " + planName,
          "*Condição (a partir de):* " + (priceText(it) || "a confirmar no atendimento"),
          "*Unidade:* " + (un ? un.name : "-"),
          "*Melhor dia:* " + diaLabel,
          "*Período:* " + perLabel
        ];
        if (feats.length) lines.push("*Inclui:* " + feats.join(" · "));
        lines.push("", "Pode me ajudar a agendar?");
        var msg = encodeURIComponent(lines.join("\n"));
        if (T) T.event("trial_request", { unit: un ? un.id : "", plano: preKey, dia: daySel ? daySel.value : "", periodo: perSel ? perSel.value : "", location_page: "plan_select" });
        w.open("https://wa.me/" + (un ? un.whatsapp : "") + "?text=" + msg, "_blank");
        close();
      };
    }
    function render() {
      if (preKey) { renderSelected(); return; }
      setProg();
      var list = steps();
      var body = ov.querySelector(".quiz-body");
      if (step < list.length) {
        var s = list[step];
        body.innerHTML = '<span class="quiz-step">Passo ' + (step + 1) + ' de ' + (list.length + 1) + '</span><h3>' + s.q + '</h3><div class="quiz-opts">' +
          s.o.map(function (o) { return '<button class="quiz-opt" data-v="' + o[0] + '"><span class="em">' + o[2] + '</span>' + o[1] + '</button>'; }).join("") + '</div>';
        body.querySelectorAll(".quiz-opt").forEach(function (b) { b.onclick = function () {
          var v = b.getAttribute("data-v"); var opt = s.o.filter(function (o) { return o[0] === v; })[0];
          ans[s.k] = v; ans[s.k + "_label"] = opt ? opt[1] : v; step++; render();
        }; });
      } else {
        // resultado PERSONALIZADO — reflete objetivo, momento, modalidade e a unidade escolhida
        var unitOpts = DATA.activeUnits().map(function (x) { return '<option value="' + x.id + '"' + (u && x.id === u.id ? " selected" : "") + '>' + x.name + ' — ' + x.city + '</option>'; }).join("");
        // Recomendação de plano pelo momento: quem já treina -> Anual VIP (melhor custo); começando/voltando -> Basic+ (flexível)
        var recKey = (ans.momento === "ativo") ? "vip" : "basic";
        var planoNome = recKey === "vip" ? "Anual VIP" : "Basic+";
        var PLAN_PRICE = {
          vip:   { 1: "12x de R$ 249,90", 2: "12x de R$ 99,90", 3: "12x de R$ 109,90" },
          basic: { 1: "R$ 289,99/mês",    2: "R$ 109,99/mês",   3: "R$ 129,99/mês" }
        };
        var OBJ = { emagrecer: "emagrecer", massa: "ganhar massa", saude: "cuidar da saúde e do bem-estar", luta: "evoluir no condicionamento e nas lutas" };
        var MOM = { iniciante: "está começando agora", voltando: "está voltando a treinar", ativo: "já treina" };
        var MOD = { musculacao: "a musculação com acompanhamento", coletivas: "as aulas coletivas (Zumba, Jump, Funcional e mais)", lutas: "o Muay Thai, que já vem incluso no plano", tudo: "acesso a tudo: musculação, coletivas e Muay Thai" };
        var reason = recKey === "vip"
          ? "Como você <b>" + (MOM[ans.momento] || "já treina") + "</b>, o <b>Anual VIP</b> te dá o melhor custo-benefício: acesso completo em 12x, com Muay Thai incluso."
          : "Como você <b>" + (MOM[ans.momento] || "quer começar") + "</b>, o <b>Basic+</b> é ideal: mensal, flexível, sem fidelidade longa e sem comprometer o limite do cartão.";
        function priceFor(un) { if (!un) return ""; var g = un.group || 2; return (PLAN_PRICE[recKey][g] || "") + (un.matricula ? (" + matrícula " + un.matricula) : ""); }
        body.innerHTML = '<span class="quiz-step">Seu plano recomendado</span>' +
          '<div class="quiz-result"><div class="quiz-badge">' + planoNome + '</div>' +
          '<h3>' + planoNome + ' — feito pra você</h3>' +
          '<p>Você quer <b>' + (OBJ[ans.objetivo] || "treinar") + '</b> e curte <b>' + (MOD[ans.modalidade] || "treinar") + '</b>. ' + reason + '</p>' +
          '<div id="quizPrice" style="margin-top:10px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.06);font-size:.92rem"></div></div>' +
          '<div class="quiz-field"><label>Onde quer treinar?</label><select class="quiz-unit">' + unitOpts + '</select></div>' +
          '<div class="quiz-field"><label>Melhor dia para sua aula experimental</label><select class="quiz-day">' +
            [["terca","Terça-feira"],["quarta","Quarta-feira"],["quinta","Quinta-feira"],["sexta","Sexta-feira"]].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></div>' +
          '<div class="quiz-field"><label>Qual período?</label><select class="quiz-period">' +
            [["manha","Manhã — 7h às 11h"],["tarde","Tarde — 12h às 18h"],["noite","Noite — 19h às 22h"]].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join("") + '</select></div>' +
          '<a class="btn-quiz" id="quizGo">' + WA + ' Agendar meus 3 dias grátis</a>' +
          '<button class="quiz-restart">Refazer</button>';
        function refreshPrice() {
          var un = DATA.unitById(body.querySelector(".quiz-unit").value) || u;
          var p = priceFor(un); var el = body.querySelector("#quizPrice");
          if (el) el.innerHTML = p ? ('Na unidade <b>' + (un ? un.name : "") + '</b>, o ' + planoNome + ' sai por <b>' + p + '</b>.<br><span style="opacity:.65">Condição final confirmada no atendimento — e você ainda testa 3 dias grátis antes.</span>') : "";
        }
        refreshPrice();
        body.querySelector(".quiz-unit").onchange = refreshPrice;
        body.querySelector(".quiz-restart").onclick = function () { step = 0; ans = {}; render(); };
        body.querySelector("#quizGo").onclick = function () {
          var uid = body.querySelector(".quiz-unit").value; var un = DATA.unitById(uid) || u;
          var daySel = body.querySelector(".quiz-day"); var perSel = body.querySelector(".quiz-period");
          var diaLabel = daySel ? daySel.options[daySel.selectedIndex].text : "-";
          var perLabel = perSel ? perSel.options[perSel.selectedIndex].text : "-";
          var lines = [
            "Olá! Montei meu plano no site da Cia do Corpo e quero agendar meus 3 dias grátis.",
            "",
            "*Objetivo:* " + (ans.objetivo_label || "-"),
            "*Momento:* " + (ans.momento_label || "-")
          ];
          if (ans.origem_label) lines.push("*Já treinou:* " + ans.origem_label);
          lines.push(
            "*Interesse:* " + (ans.modalidade_label || "-"),
            "*Plano recomendado:* " + planoNome,
            "*Condição (a partir de):* " + priceFor(un),
            "*Unidade:* " + (un ? un.name : "-"),
            "*Melhor dia:* " + diaLabel,
            "*Período:* " + perLabel,
            "",
            "Pode me ajudar a agendar?"
          );
          var msg = encodeURIComponent(lines.join("\n"));
          if (T) T.event("trial_request", { unit: un ? un.id : "", plano: planoNome, objetivo: ans.objetivo, origem: ans.origem || "", dia: daySel ? daySel.value : "", periodo: perSel ? perSel.value : "", location_page: "quiz" });
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
    var ps = e.target.closest("[data-plan-select]");
    if (ps) { e.preventDefault(); openQuiz({ planKey: ps.getAttribute("data-plan-key"), unitId: ps.getAttribute("data-unit") }); return; }
    if (e.target.closest("[data-quiz]")) { e.preventDefault(); openQuiz(); }
    if (e.target.closest("[data-open-units]")) { e.preventDefault(); openUnitPicker(); }
    if (e.target.closest("[data-partner-form]")) { e.preventDefault(); openPartnerForm(); }
  });

  function init() { applyUnit(); renderChips(); buildStickyBar(); counters(); }
  d.readyState !== "loading" ? init() : d.addEventListener("DOMContentLoaded", init);
  // re-aplica após o site.js renderizar (unidades/oferta)
  w.addEventListener("load", function () { setTimeout(function () { applyUnit(); renderChips(); }, 120); });
  w.CDC.exp = { openQuiz: openQuiz, openUnitPicker: openUnitPicker, openPartnerForm: openPartnerForm, applyUnit: applyUnit };
})(window, document);
