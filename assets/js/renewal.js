(function (w, d) {
  "use strict";

  var API_BASE = "https://portalcia.impactadigital.net/renewal";
  var REQUEST_TIMEOUT = 15000;
  var TERMS_TEXT = "Declaro que estou em plenas condições de saúde e autorizado por meu médico a realizar atividades físicas. Assumo total responsabilidade pelo meu estado de saúde, isentando a Academia e seus colaboradores sobre qualquer acontecimento dentro de suas dependências. Declaro que todas as informações fornecidas são verdadeiras e exatas.";

  var QUESTIONS = [
    { id: 1, text: "Seu médico já lhe disse que você tem doença do coração ou pressão alta?" },
    { id: 2, text: "Você sente dor no peito, em repouso ou durante atividade física?" },
    { id: 3, text: "Você teve tontura, desmaio ou perda de equilíbrio nos últimos 12 meses?" },
    { id: 4, text: "Tem alguma doença crônica além de pressão alta ou problema no coração?", extra: "chronic" },
    { id: 5, text: "Tem ou já teve problema em ossos, articulações, ligamentos, músculos ou tendões?", extra: "ortho" },
    { id: 6, text: "Algum médico recomendou que você só faça atividade física com supervisão?" },
    { id: 7, text: "Você já pratica alguma atividade física hoje?", extra: "activity" }
  ];

  var state = {
    step: 1,
    code: "",
    renewal: null,
    gymMember: null,
    units: [],
    plans: [],
    offer: null,
    signature: "",
    sending: false
  };

  var sign = null;

  function byId(id) { return d.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function trim(v) { return String(v == null ? "" : v).trim(); }
  function digits(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }

  function toast(message, kind) {
    var host = byId("rnToasts");
    if (!host) return;
    var el = d.createElement("div");
    el.className = "an-toast" + (kind ? " is-" + kind : "");
    var icon = kind === "bad"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>';
    el.innerHTML = icon + "<span></span>";
    el.lastChild.textContent = message;
    host.appendChild(el);
    w.setTimeout(function () {
      el.classList.add("leaving");
      w.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3200);
  }

  function showScreen(name) {
    ["stLoading", "stError", "stForm", "stDone"].forEach(function (id) {
      var el = byId(id);
      if (el) el.hidden = id !== name;
    });
  }

  function showError(title, text, canRetry) {
    byId("rnErrorTitle").textContent = title;
    byId("rnErrorText").textContent = text;
    byId("rnRetryBtn").hidden = !canRetry;
    showScreen("stError");
  }

  function setFieldError(el, msg) {
    var box = el && el.closest(".field");
    if (!box) return;
    box.classList.add("has-error");
    var slot = box.querySelector(".err span");
    if (slot) slot.textContent = msg;
  }

  function clearFieldError(el) {
    var box = el && el.closest(".field");
    if (!box) return;
    box.classList.remove("has-error");
    var slot = box.querySelector(".err span");
    if (slot) slot.textContent = "";
  }

  function setBlockError(id, msg) {
    var el = byId(id);
    if (!el) return;
    var txt = el.querySelector("span");
    if (txt) txt.textContent = msg || "";
    el.classList.toggle("show", !!msg);
  }

  function clearErrors() {
    all(".field.has-error").forEach(function (f) { f.classList.remove("has-error"); });
    all(".field .err span").forEach(function (s) { s.textContent = ""; });
    all(".an-err.show").forEach(function (e) {
      e.classList.remove("show");
      var s = e.querySelector("span");
      if (s) s.textContent = "";
    });
    all(".an-q.has-error").forEach(function (q) { q.classList.remove("has-error"); });
  }

  function focusField(el) {
    if (!el) return;
    if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function parseCode() {
    var params = new URLSearchParams(w.location.search);
    var code = trim(params.get("code"));
    state.code = code;
    if (!code) return false;
    byId("rnCodeText").textContent = code;
    byId("rnCode").hidden = false;
    return true;
  }

  function fetchJson(url, options) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var opts = options || {};
    if (ctrl) opts.signal = ctrl.signal;
    var timer = w.setTimeout(function () { if (ctrl) ctrl.abort(); }, REQUEST_TIMEOUT);
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) {}
        return { ok: res.ok, status: res.status, json: json };
      });
    }).finally(function () { w.clearTimeout(timer); });
  }

  function formatCpf(v) {
    var n = digits(v).slice(0, 11);
    if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return v || "";
  }

  function formatPhone(v) {
    var n = digits(v).slice(0, 11);
    if (n.length > 10) return n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return v || "";
  }

  function formatDate(iso) {
    if (!iso) return "";
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("pt-BR");
  }

  function money(v) {
    var n = Number(v);
    if (!isFinite(n)) return null;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function loadRenewal() {
    if (!parseCode()) {
      showError("Link inválido", "Este link não possui código de renovação.", false);
      return;
    }

    showScreen("stLoading");
    fetchJson(API_BASE + "/" + encodeURIComponent(state.code), { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (res.status === 404 || res.status === 410) {
          showError("Link inválido ou expirado", "Não encontramos essa renovação. Solicite um novo link.", false);
          return null;
        }
        if (!res.ok || !res.json || res.json.success !== true) {
          showError("Não conseguimos carregar", "Verifique sua conexão e tente novamente.", true);
          return null;
        }
        return res.json;
      })
      .then(function (data) {
        if (!data) return;
        state.renewal = data.renewal || null;
        state.gymMember = data.gym_member || null;
        state.units = Array.isArray(data.units) ? data.units : [];
        state.plans = Array.isArray(data.plans) ? data.plans : [];
        state.offer = normalizeOffer(data.offer);
        renderData();
        showScreen("stForm");
        goToStep(1);
      })
      .catch(function () {
        showError("Não conseguimos carregar", "Verifique sua conexão e tente novamente.", true);
      });
  }

  function renderData() {
    var m = state.gymMember || {};
    byId("rName").value = m.name || "";
    byId("rPhone").value = formatPhone(m.phone);
    byId("rEmail").value = m.email || "";
    byId("rCpf").value = formatCpf(m.cpf);
    byId("rBirth").value = formatDate(m.birth_date);
    renderUnits();
    renderTerms();
    renderParq();
  }

  function renderUnits() {
    var select = byId("rUnit");
    var rows = state.units.filter(function (u) { return u && u.active !== false; });
    var currentUnit = state.gymMember && state.gymMember.unit_id;
    var options = ['<option value="">Selecione</option>'];
    rows.forEach(function (u) {
      var city = u.city ? " - " + u.city : "";
      options.push('<option value="' + String(u.id) + '">' + (u.name || "Unidade") + city + "</option>");
    });
    select.innerHTML = options.join("");
    if (currentUnit && rows.some(function (u) { return String(u.id) === String(currentUnit); })) {
      select.value = String(currentUnit);
    }
    renderPlans();
  }

  function plansForUnit(unit) {
    var plans = state.plans.filter(function (p) { return p && p.status !== false; });
    if (!unit) return plans;
    var tier = String(unit.tier || "").toLowerCase();
    var grouped = plans.filter(function (p) {
      var label = String(p.groupLabel || "").toLowerCase();
      if (tier && label) return label === tier;
      return unit.group != null && p.group != null && Number(unit.group) === Number(p.group);
    });
    return grouped.length ? grouped : plans;
  }

  /* Oferta montada pela equipe no painel: até 3 planos e um em destaque.
     Planos que saíram de vigência já vêm filtrados pela API. */
  function normalizeOffer(raw) {
    if (!raw || !Array.isArray(raw.plan_ids)) return null;
    var ids = raw.plan_ids.map(Number).filter(function (id) {
      return state.plans.some(function (p) { return Number(p.id) === id && p.status !== false; });
    });
    if (!ids.length) return null;
    var featured = Number(raw.featured_plan_id);
    if (ids.indexOf(featured) === -1) featured = ids[0];
    return { ids: ids.slice(0, 3), featured: featured };
  }

  function planById(id) {
    return state.plans.filter(function (p) { return Number(p.id) === Number(id); })[0] || null;
  }

  // Com 3 planos o destaque fica no meio; com 2, vem primeiro.
  function offerPlans() {
    var o = state.offer;
    var others = o.ids.filter(function (id) { return id !== o.featured; });
    var order = o.ids.length === 3 ? [others[0], o.featured, others[1]] : [o.featured].concat(others);
    return order.map(planById).filter(Boolean);
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function planCardMarkup(p, opts) {
    var price = money(p.priceFrom) || "0,00";
    var recurring = p.recurring === true;
    var period = String(p.periodicityLabel || "").toLowerCase();
    var unit = getSelectedUnit();
    var isCurrent = state.gymMember && String(state.gymMember.plan_id) === String(p.id);
    var badges = [];
    if (isCurrent) badges.push('<span class="plan-badge pb-blue">Seu plano atual</span>');
    if (recurring) badges.push('<span class="plan-badge pb-green">Não compromete o limite</span>');

    var features = [];
    if (recurring) features.push("Cobrança mensal recorrente");
    if (Number(p.periodicity) > 1) features.push("Duração de " + Number(p.periodicity) + " meses");
    features.push(Number(p.matricula) > 0 ? "Matrícula de R$ " + money(p.matricula) : "Sem taxa de matrícula");
    if (unit && unit.name) features.push("Treinos na unidade " + unit.name);

    return '<div class="plan rn-plan' + (opts.featured ? " featured" : "") + '" role="radio" tabindex="0" aria-checked="false" data-plan-id="' + esc(p.id) + '">' +
      (opts.featured ? '<span class="ribbon">Recomendado</span>' : "") +
      "<h3>" + esc(p.name || "Plano") + "</h3>" +
      '<div class="plan-price">R$ ' + price + "<small>" + (recurring ? "/mês" : (period ? " " + esc(period) : "")) + "</small></div>" +
      (badges.length ? '<div class="plan-badges">' + badges.join("") + "</div>" : "") +
      "<ul>" + features.map(function (f) { return "<li>" + CHECK_SVG + "<span>" + esc(f) + "</span></li>"; }).join("") + "</ul>" +
      '<span class="btn ' + (opts.featured ? "btn-primary" : "btn-ghost") + ' btn-block rn-plan-cta"><span class="rn-cta-idle">Quero este plano</span><span class="rn-cta-on">' + CHECK_SVG + " Plano escolhido</span></span>" +
      "</div>";
  }

  function selectPlan(id) {
    var input = byId("rPlan");
    input.value = id ? String(id) : "";
    clearFieldError(input);
    all(".rn-plan", byId("rnPlans")).forEach(function (card) {
      var on = card.getAttribute("data-plan-id") === input.value;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function renderPlans() {
    var host = byId("rnPlans");
    var sub = byId("rnPlansSub");
    var previous = byId("rPlan").value;
    var plans, featuredId = null;

    if (state.offer) {
      plans = offerPlans();
      featuredId = state.offer.featured;
      sub.textContent = "Separamos estas opções para a sua renovação. Toque no plano que preferir.";
    } else {
      plans = plansForUnit(getSelectedUnit());
      sub.textContent = "Os planos são filtrados de acordo com a unidade escolhida.";
    }

    host.className = "rn-plans" + (state.offer ? " is-offer is-" + plans.length : " is-list");
    if (!plans.length) {
      host.innerHTML = '<p class="rn-plan-empty">Nenhum plano disponível para esta unidade. Fale com a nossa equipe.</p>';
      selectPlan("");
      return;
    }
    host.innerHTML = plans.map(function (p) {
      return planCardMarkup(p, { featured: featuredId !== null && Number(p.id) === featuredId });
    }).join("");

    // Mantém a escolha anterior. Com oferta, já começa no destaque escolhido
    // pela equipe; sem oferta, no plano atual do aluno.
    var ids = plans.map(function (p) { return String(p.id); });
    var currentPlan = state.gymMember && state.gymMember.plan_id;
    var pick = [previous, state.offer ? featuredId : currentPlan].map(function (v) { return v == null ? "" : String(v); })
      .filter(function (v) { return v && ids.indexOf(v) !== -1; })[0] || "";
    selectPlan(pick);
  }

  function getSelectedUnit() {
    var id = byId("rUnit").value;
    return state.units.filter(function (u) { return String(u.id) === String(id); })[0] || null;
  }

  function optionMarkup(qid, value, label) {
    return '<label class="an-opt opt-' + value + '">' +
      '<input type="radio" name="parq_' + qid + '" value="' + value + '">' +
      "<span>" + label + "</span>" +
      "</label>";
  }

  function revealMarkup(key, inner) {
    return '<div class="an-reveal" data-reveal="' + key + '"><div class="an-reveal-in">' + inner + "</div></div>";
  }

  function renderParq() {
    var host = byId("rnParq");
    host.innerHTML = QUESTIONS.map(function (q) {
      var extra = "";
      if (q.extra === "chronic") {
        extra = revealMarkup("chronic",
          '<div class="field">' +
          '<label for="qChronicWhat">Quais doenças? <span class="req">*</span></label>' +
          '<textarea id="qChronicWhat"></textarea>' +
          '<span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
          "</div>" +
          '<div><p style="font-weight:600;margin:0 0 10px">Usa medicamentos? <span class="req">*</span></p><div class="an-opts">' +
          '<label class="an-opt opt-yes"><input type="radio" name="chronicMeds" value="yes"><span>Sim</span></label>' +
          '<label class="an-opt opt-no"><input type="radio" name="chronicMeds" value="no"><span>Não</span></label>' +
          '</div><span class="an-err" id="rnChronicMedsErr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span></div>' +
          revealMarkup("chronicMeds",
            '<div class="field"><label for="qChronicMedsList">Quais medicamentos? <span class="req">*</span></label><input id="qChronicMedsList"><span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span></div>' +
            '<div class="field"><label for="qChronicMedsWhich">Doença relacionada <span class="req">*</span></label><input id="qChronicMedsWhich"><span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span></div>'
          )
        );
      } else if (q.extra === "ortho") {
        extra = revealMarkup("ortho",
          '<div class="field"><label for="qOrthoWhat">Conte o que aconteceu <span class="req">*</span></label><textarea id="qOrthoWhat"></textarea><span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span></div>'
        );
      } else if (q.extra === "activity") {
        extra = revealMarkup("activity",
          '<div class="field"><label for="qActivityWhat">Qual atividade? <span class="req">*</span></label><input id="qActivityWhat"><span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span></div>' +
          '<div class="field"><label for="qActivityTime">Há quanto tempo? <span class="req">*</span></label><input id="qActivityTime"><span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span></div>'
        );
      }
      return '<article class="an-q" data-q="' + q.id + '"><div class="an-q-head"><span class="an-q-num">' + q.id + '</span><p class="an-q-text">' + q.text + "</p></div>" +
        '<div class="an-opts">' + optionMarkup(q.id, "yes", "Sim") + optionMarkup(q.id, "no", "Não") + '</div>' +
        '<span class="an-err" id="rnQErr' + q.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
        extra + "</article>";
    }).join("");

    all('input[type="radio"]', host).forEach(function (radio) {
      radio.addEventListener("change", function () {
        setBlockError("rnChronicMedsErr", "");
        syncReveals();
      });
    });
  }

  function renderTerms() {
    byId("rnTerms").textContent = TERMS_TEXT;
  }

  function parqAnswer(id) {
    var checked = d.querySelector('input[name="parq_' + id + '"]:checked');
    return checked ? checked.value === "yes" : null;
  }

  function syncReveals() {
    var q4 = parqAnswer(4) === true;
    var q5 = parqAnswer(5) === true;
    var q7 = parqAnswer(7) === true;
    var meds = d.querySelector('input[name="chronicMeds"]:checked');

    var chronic = d.querySelector('[data-reveal="chronic"]');
    var ortho = d.querySelector('[data-reveal="ortho"]');
    var activity = d.querySelector('[data-reveal="activity"]');
    var chronicMeds = d.querySelector('[data-reveal="chronicMeds"]');
    if (chronic) chronic.classList.toggle("show", q4);
    if (ortho) ortho.classList.toggle("show", q5);
    if (activity) activity.classList.toggle("show", q7);
    if (chronicMeds) chronicMeds.classList.toggle("show", q4 && meds && meds.value === "yes");

    var hasYes = QUESTIONS.some(function (q) { return parqAnswer(q.id) === true; });
    byId("rnMedicalAlert").classList.toggle("show", hasYes);
  }

  function setStep(step) {
    state.step = step;
    all(".an-block").forEach(function (b) { b.hidden = Number(b.getAttribute("data-block")) !== step; });
    all("#rnSteps .an-step").forEach(function (s) {
      var n = Number(s.getAttribute("data-step"));
      s.classList.toggle("is-current", n === step);
      s.classList.toggle("is-done", n < step);
    });
    byId("rnPrev").hidden = step === 1;
    byId("rnNext").hidden = step === 3;
    byId("rnSubmit").hidden = step !== 3;
    if (step === 3 && sign) sign.fit();
  }

  function goToStep(step) {
    clearErrors();
    setStep(step);
  }

  function validateStep1() {
    var unit = byId("rUnit");
    clearFieldError(unit);
    if (!trim(unit.value)) {
      setFieldError(unit, "Selecione uma unidade.");
      return false;
    }
    return true;
  }

  function requireValue(id, message) {
    var el = byId(id);
    clearFieldError(el);
    if (!trim(el.value)) {
      setFieldError(el, message);
      return false;
    }
    return true;
  }

  function validateParq() {
    var ok = true;

    QUESTIONS.forEach(function (q) {
      var answer = parqAnswer(q.id);
      var card = d.querySelector('.an-q[data-q="' + q.id + '"]');
      var errId = "rnQErr" + q.id;
      setBlockError(errId, "");
      if (answer === null) {
        ok = false;
        if (card) card.classList.add("has-error");
        setBlockError(errId, "Responda esta pergunta.");
      } else if (card) {
        card.classList.remove("has-error");
      }
    });

    if (parqAnswer(4) === true) {
      ok = requireValue("qChronicWhat", "Informe quais doenças.") && ok;
      var meds = d.querySelector('input[name="chronicMeds"]:checked');
      if (!meds) {
        ok = false;
        setBlockError("rnChronicMedsErr", "Informe se usa medicamentos.");
      }
      if (meds && meds.value === "yes") {
        ok = requireValue("qChronicMedsList", "Informe os medicamentos.") && ok;
        ok = requireValue("qChronicMedsWhich", "Informe a doença relacionada.") && ok;
      }
    }

    if (parqAnswer(5) === true) {
      ok = requireValue("qOrthoWhat", "Descreva o problema.") && ok;
    }
    if (parqAnswer(7) === true) {
      ok = requireValue("qActivityWhat", "Informe a atividade.") && ok;
      ok = requireValue("qActivityTime", "Informe há quanto tempo.") && ok;
    }
    return ok;
  }

  function validateStep2() {
    var ok = true;
    if (!requireValue("rPlan", "Selecione um plano.")) {
      ok = false;
      var host = byId("rnPlans");
      if (host.scrollIntoView) host.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    var objectiveRequired = [
      { id: "rGoal", message: "Selecione um objetivo." },
      { id: "rDays", message: "Selecione os dias por semana." },
      { id: "rShift", message: "Selecione o turno." }
    ];
    var firstInvalid = null;
    objectiveRequired.forEach(function (field) {
      var el = byId(field.id);
      clearFieldError(el);
      if (!trim(el.value)) {
        setFieldError(el, field.message);
        ok = false;
        if (!firstInvalid) firstInvalid = el;
      }
    });
    if (firstInvalid) {
      focusField(firstInvalid);
      toast("Preencha os campos obrigatórios de objetivo e rotina.", "bad");
    }
    ok = validateParq() && ok;
    return ok;
  }

  function validateStep3() {
    var ok = true;
    setBlockError("rnTermsErr", "");
    setBlockError("rnConsentErr", "");
    setBlockError("rnSignErr", "");

    if (!byId("rTerms").checked) {
      setBlockError("rnTermsErr", "Você precisa aceitar os termos.");
      ok = false;
    }
    if (!byId("rConsent").checked) {
      setBlockError("rnConsentErr", "Você precisa autorizar o uso dos dados de saúde.");
      ok = false;
    }
    if (!state.signature) {
      setBlockError("rnSignErr", "Salve a assinatura para continuar.");
      var wrap = byId("rnSignWrap");
      if (wrap) wrap.classList.add("has-error");
      ok = false;
    }
    return ok;
  }

  function detailsQ4() {
    if (parqAnswer(4) !== true) return null;
    var diseases = trim(byId("qChronicWhat").value);
    var meds = d.querySelector('input[name="chronicMeds"]:checked');
    var usesMeds = meds && meds.value === "yes";
    var parts = [
      "Doencas: " + diseases,
      "Usa medicamentos: " + (usesMeds ? "Sim" : "Nao")
    ];
    if (usesMeds) {
      parts.push("Medicamentos: " + trim(byId("qChronicMedsList").value));
      parts.push("Doenca relacionada: " + trim(byId("qChronicMedsWhich").value));
    }
    return parts.join(" | ");
  }

  function buildParq() {
    return QUESTIONS.map(function (q) {
      var answer = parqAnswer(q.id) === true;
      var details = null;
      if (q.id === 4) details = detailsQ4();
      if (q.id === 5 && answer) details = trim(byId("qOrthoWhat").value);
      if (q.id === 7 && answer) {
        details = "Atividade: " + trim(byId("qActivityWhat").value) + " | Tempo: " + trim(byId("qActivityTime").value);
      }
      return { question: q.id, answer: answer, details: details || null };
    });
  }

  function buildPayload() {
    var parq = buildParq();
    return {
      gym_member_id: Number(state.gymMember.id),
      plan_id: Number(byId("rPlan").value),
      unit_id: Number(byId("rUnit").value),
      unique_code: (state.renewal && state.renewal.unique_code) || state.code,
      parq: parq,
      goal: trim(byId("rGoal").value),
      training_days: Number(byId("rDays").value),
      training_shift: trim(byId("rShift").value),
      medical_warning: parq.some(function (q) { return q.answer === true; }),
      accepted_terms: byId("rTerms").checked,
      health_data_consent: byId("rConsent").checked,
      signature: state.signature
    };
  }

  function setSubmitting(sending) {
    state.sending = sending;
    var btn = byId("rnSubmit");
    var next = byId("rnNext");
    var prev = byId("rnPrev");
    if (btn) btn.disabled = sending;
    if (next) next.disabled = sending;
    if (prev) prev.disabled = sending;
    if (btn) btn.querySelector(".an-btn-label").textContent = sending ? "Enviando..." : "Finalizar renovação";
  }

  function submitRenewal() {
    if (!validateStep3() || state.sending) return;
    setSubmitting(true);
    fetchJson(API_BASE + "/" + encodeURIComponent(state.code) + "/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(buildPayload())
    }).then(function (res) {
      if (!res.ok || !res.json || res.json.success !== true) {
        var msg = (res.json && res.json.message) ? res.json.message : "Não foi possível concluir a renovação agora.";
        throw new Error(msg);
      }
      if (w.CDC && w.CDC.track) w.CDC.track.event("renewal_submit", { location_page: "renewal" });
      showScreen("stDone");
    }).catch(function (err) {
      toast(err.message || "Erro ao concluir renovação.", "bad");
    }).finally(function () {
      setSubmitting(false);
    });
  }

  function setupSignature() {
    var canvas = byId("rnSignature");
    var wrap = byId("rnSignWrap");
    var status = byId("rnSignStatus");
    if (!canvas || !wrap) return;

    var ctx = canvas.getContext("2d");
    var strokes = [];
    var current = null;
    var drawing = false;
    var box = { w: 0, h: 0 };

    function ratio() { return Math.max(1, Math.min(3, w.devicePixelRatio || 1)); }

    function draw(c, sx, sy) {
      c.lineWidth = 2.2;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.strokeStyle = "#14141a";
      strokes.forEach(function (s) {
        if (!s.length) return;
        c.beginPath();
        c.moveTo(s[0].x * sx, s[0].y * sy);
        if (s.length === 1) c.lineTo(s[0].x * sx + 0.6, s[0].y * sy);
        for (var i = 1; i < s.length; i++) c.lineTo(s[i].x * sx, s[i].y * sy);
        c.stroke();
      });
    }

    function paint() {
      var r = ratio();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(r, r);
      draw(ctx, box.w, box.h);
      wrap.classList.toggle("has-ink", strokes.length > 0);
    }

    function fit() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      box.w = rect.width;
      box.h = rect.height;
      var r = ratio();
      var nw = Math.round(rect.width * r);
      var nh = Math.round(rect.height * r);
      if (canvas.width !== nw || canvas.height !== nh) {
        canvas.width = nw;
        canvas.height = nh;
      }
      paint();
      return true;
    }

    function point(ev) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / (rect.width || 1))),
        y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / (rect.height || 1)))
      };
    }

    function setStatus(kind) {
      if (!status) return;
      status.classList.remove("is-saved", "is-pending");
      if (kind === "saved") {
        status.textContent = "Assinatura salva.";
        status.classList.add("is-saved");
      } else if (kind === "pending") {
        status.textContent = "Assinatura feita, mas ainda não salva.";
        status.classList.add("is-pending");
      } else {
        status.textContent = "Nenhuma assinatura salva ainda.";
      }
    }

    function start(ev) {
      if (ev.button != null && ev.button !== 0) return;
      ev.preventDefault();
      if (!box.w && !fit()) return;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      drawing = true;
      current = [point(ev)];
      strokes.push(current);
      wrap.classList.add("is-active");
      wrap.classList.remove("has-error");
      state.signature = "";
      setBlockError("rnSignErr", "");
      paint();
    }

    function move(ev) {
      if (!drawing || !current) return;
      ev.preventDefault();
      current.push(point(ev));
      paint();
    }

    function end(ev) {
      if (!drawing) return;
      drawing = false;
      current = null;
      try { if (ev && ev.pointerId != null) canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      wrap.classList.remove("is-active");
      setStatus(strokes.length ? "pending" : null);
    }

    function exportPng() {
      if (!strokes.length) return "";
      var minX = 1, minY = 1, maxX = 0, maxY = 0;
      strokes.forEach(function (s) {
        s.forEach(function (p) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
      });
      var pad = 0.04;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(1, maxX + pad); maxY = Math.min(1, maxY + pad);
      var srcW = Math.max(0.08, maxX - minX) * box.w;
      var srcH = Math.max(0.08, maxY - minY) * box.h;
      var outW = 600;
      var outH = Math.max(120, Math.min(400, Math.round(outW * (srcH / srcW))));
      var scale = Math.min(outW / srcW, outH / srcH);
      var out = d.createElement("canvas");
      out.width = outW;
      out.height = outH;
      var oc = out.getContext("2d");
      oc.translate((outW - srcW * scale) / 2, (outH - srcH * scale) / 2);
      oc.scale(scale, scale);
      oc.translate(-minX * box.w, -minY * box.h);
      draw(oc, box.w, box.h);
      return out.toDataURL("image/png");
    }

    function save() {
      if (!strokes.length) {
        wrap.classList.add("has-error");
        setBlockError("rnSignErr", "Assine no quadro primeiro.");
        return;
      }
      state.signature = exportPng();
      wrap.classList.remove("has-error");
      wrap.classList.add("is-saved");
      setStatus("saved");
      toast("Assinatura salva.", "good");
    }

    function clear() {
      strokes.length = 0;
      current = null;
      drawing = false;
      state.signature = "";
      wrap.classList.remove("has-ink", "is-active", "is-saved", "has-error");
      paint();
      setStatus(null);
      setBlockError("rnSignErr", "");
    }

    function undo() {
      if (!strokes.length) return;
      strokes.pop();
      state.signature = "";
      wrap.classList.remove("is-saved");
      paint();
      setStatus(strokes.length ? "pending" : null);
    }

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", end);

    byId("rnSignSave").addEventListener("click", save);
    byId("rnSignClear").addEventListener("click", clear);
    byId("rnSignUndo").addEventListener("click", undo);

    w.addEventListener("resize", function () { w.setTimeout(fit, 100); });

    sign = { fit: fit };
  }

  function bindEvents() {
    byId("rnRetryBtn").addEventListener("click", loadRenewal);
    byId("rUnit").addEventListener("change", function () {
      clearFieldError(this);
      renderPlans();
    });
    byId("rnPlans").addEventListener("click", function (ev) {
      var card = ev.target.closest && ev.target.closest(".rn-plan");
      if (card) selectPlan(card.getAttribute("data-plan-id"));
    });
    byId("rnPlans").addEventListener("keydown", function (ev) {
      var card = ev.target.closest && ev.target.closest(".rn-plan");
      if (!card || (ev.key !== "Enter" && ev.key !== " ")) return;
      ev.preventDefault();
      selectPlan(card.getAttribute("data-plan-id"));
    });
    ["rGoal", "rDays", "rShift"].forEach(function (id) {
      var el = byId(id);
      el.addEventListener("change", function () { clearFieldError(el); });
    });
    all("input, textarea, select", byId("rnForm")).forEach(function (el) {
      el.addEventListener("input", function () {
        clearFieldError(el);
      });
    });
    byId("rnNext").addEventListener("click", function () {
      if (state.step === 1 && validateStep1()) goToStep(2);
      else if (state.step === 2 && validateStep2()) goToStep(3);
    });
    byId("rnPrev").addEventListener("click", function () { if (state.step > 1) goToStep(state.step - 1); });
    byId("rnForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      submitRenewal();
    });
    d.addEventListener("change", function (ev) {
      var n = ev.target && ev.target.name;
      if (n && (n.indexOf("parq_") === 0 || n === "chronicMeds")) syncReveals();
    });
  }

  function init() {
    var cfg = (w.CDC && w.CDC.data && typeof w.CDC.data.get === "function") ? w.CDC.data.get() : null;
    var wa = cfg && cfg.meta ? digits(cfg.meta.partnerCentralWhatsapp) : "";
    var contact = wa ? ("https://wa.me/" + wa + "?text=" + encodeURIComponent("Olá! Preciso de ajuda com minha renovação.")) : "/contato";
    byId("rnHelpLink").href = contact;
    byId("rnErrorContact").href = contact;

    bindEvents();
    setupSignature();
    loadRenewal();
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
