/* ============================================================
   CIA DO CORPO — Ficha de Anamnese
   Fluxo em 3 etapas com rascunho de sessão (LGPD: nada persiste
   depois que a aba fecha) e assinatura em canvas.
   ============================================================ */
(function (w, d) {
  "use strict";

  var DEFAULT_TERMS = "Declaro que estou em plenas condições de saúde e autorizado por meu médico a realizar atividades físicas, bem como não sou portador de nenhuma moléstia. Assumo total responsabilidade pelo meu estado de saúde, isentando a Academia e seus colaboradores sobre qualquer acontecimento dentro de suas dependências. Me responsabilizo a partir desta data a trazer meu atestado médico. Declaro ainda que todas as informações fornecidas são verdadeiras e exatas. Compreendo que qualquer omissão ou informação falsa pode afetar minha segurança no treino, bem como resultados e isento a academia de responsabilidades relacionadas a tais informações.";

  var QUESTIONS = [
    { id: 1, text: "Seu médico já lhe disse que você tem doença do coração ou pressão alta?" },
    { id: 2, text: "Você sente dor no peito, em repouso ou durante atividade física?" },
    { id: 3, text: "Você teve tontura, desmaio ou perda de equilíbrio nos últimos 12 meses?" },
    { id: 4, text: "Tem alguma doença crônica além de pressão alta ou problema no coração?", extra: "chronic" },
    { id: 5, text: "Tem ou já teve problema em ossos, articulações, ligamentos, músculos ou tendões?", extra: "ortho" },
    { id: 6, text: "Algum médico recomendou que você só faça atividade física com supervisão?" },
    { id: 7, text: "Você já pratica alguma atividade física hoje?", extra: "activity" }
  ];

  var GOALS_FIXED = ["Emagrecimento", "Hipertrofia", "Condicionamento", "Saúde", "Performance", "Reabilitação", "Ganho de Massa"];
  var UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  var STEP_TOTAL = 3;
  var STORE_PREFIX = "cdc_anamnese_";
  var REQUEST_TIMEOUT = 15000;

  /* Campos simples da etapa 1 e 2 — id do input -> chave do rascunho */
  var FIELDS = [
    "fName", "fPhone", "fEmail", "fCpf", "fBirth",
    "fCep", "fStreet", "fNumber", "fComplement", "fDistrict", "fCity", "fState",
    "fEmergName", "fEmergPhone",
    "fGoal", "fGoalOther", "fDays", "fShift"
  ];
  var EXTRA_FIELDS = ["qChronicWhat", "qChronicMedsList", "qChronicMedsWhich", "qOrthoWhat", "qActivityWhat", "qActivityTime"];

  var state = {
    step: 1,
    code: "",
    apiBase: "",
    lead: null,
    submitted: false,
    sending: false,
    dirty: false
  };
  var sign = null;
  var saveTimer = 0;

  /* ---------------------------------------------------------- utilidades */

  function byId(id) { return d.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function digits(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }
  function trim(v) { return String(v == null ? "" : v).trim(); }
  function val(id) { var el = byId(id); return el ? trim(el.value) : ""; }
  function setVal(id, v) { var el = byId(id); if (el) el.value = v == null ? "" : v; }

  function config() {
    return (w.CDC && w.CDC.data && typeof w.CDC.data.get === "function") ? w.CDC.data.get() : null;
  }

  function contactHref() {
    var cfg = config();
    var wa = cfg && cfg.meta ? digits(cfg.meta.partnerCentralWhatsapp) : "";
    return wa ? ("https://wa.me/" + wa + "?text=" + encodeURIComponent("Olá! Preciso de ajuda com a minha ficha de anamnese.")) : "contato.html";
  }

  function apiUrl() {
    return state.apiBase + "/" + encodeURIComponent(state.code);
  }

  function fetchJson(url, options) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var opts = options || {};
    if (ctrl) opts.signal = ctrl.signal;
    var timer = w.setTimeout(function () { if (ctrl) ctrl.abort(); }, REQUEST_TIMEOUT);

    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* resposta não-JSON */ }
        return { ok: res.ok, status: res.status, json: json };
      });
    }).finally(function () { w.clearTimeout(timer); });
  }

  /* ------------------------------------------------------------- avisos */

  function toast(message, kind) {
    var host = byId("anToasts");
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
      if (el) el.hidden = (id !== name);
    });
  }

  /* --------------------------------------------------------- erros de campo */

  function fieldOf(el) { return el ? el.closest(".field") : null; }

  function setError(el, message) {
    var box = fieldOf(el);
    if (!box) return;
    box.classList.add("has-error");
    var msg = box.querySelector(".err span");
    if (msg) msg.textContent = message;
    if (el.setAttribute) el.setAttribute("aria-invalid", "true");
  }

  function clearError(el) {
    var box = fieldOf(el);
    if (!box) return;
    box.classList.remove("has-error");
    var msg = box.querySelector(".err span");
    if (msg) msg.textContent = "";
    if (el.removeAttribute) el.removeAttribute("aria-invalid");
  }

  function setBlockError(errId, message) {
    var el = byId(errId);
    if (!el) return;
    el.classList.toggle("show", !!message);
    var span = el.querySelector("span");
    if (span) span.textContent = message || "";
  }

  function clearAllErrors() {
    all(".field.has-error").forEach(function (f) {
      f.classList.remove("has-error");
      var m = f.querySelector(".err span");
      if (m) m.textContent = "";
    });
    all("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    all(".an-q.has-error").forEach(function (q) { q.classList.remove("has-error"); });
    all(".an-err.show").forEach(function (e) {
      e.classList.remove("show");
      var s = e.querySelector("span");
      if (s) s.textContent = "";
    });
    var wrap = byId("anSignWrap");
    if (wrap) wrap.classList.remove("has-error");
  }

  /* ------------------------------------------------------------- máscaras */

  function applyMask(input, maskFn) {
    if (!input) return;
    input.addEventListener("input", function () {
      var atEnd = input.selectionStart === input.value.length;
      input.value = maskFn(input.value);
      if (atEnd && input.setSelectionRange) {
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
      }
    });
  }

  function maskPhone(v) {
    var n = digits(v).slice(0, 11);
    if (n.length > 10) return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
    if (n.length > 6) return "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6);
    if (n.length > 2) return "(" + n.slice(0, 2) + ") " + n.slice(2);
    return n;
  }

  function maskCpf(v) {
    var n = digits(v).slice(0, 11);
    if (n.length > 9) return n.slice(0, 3) + "." + n.slice(3, 6) + "." + n.slice(6, 9) + "-" + n.slice(9);
    if (n.length > 6) return n.slice(0, 3) + "." + n.slice(3, 6) + "." + n.slice(6);
    if (n.length > 3) return n.slice(0, 3) + "." + n.slice(3);
    return n;
  }

  function maskCep(v) {
    var n = digits(v).slice(0, 8);
    return n.length > 5 ? n.slice(0, 5) + "-" + n.slice(5) : n;
  }

  /* ----------------------------------------------------------- validações */

  function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v); }

  function isCpf(v) {
    var n = digits(v);
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    var i, sum, rest;
    for (var round = 0; round < 2; round++) {
      sum = 0;
      var size = 9 + round;
      for (i = 0; i < size; i++) sum += parseInt(n.charAt(i), 10) * (size + 1 - i);
      rest = (sum * 10) % 11;
      if (rest === 10) rest = 0;
      if (rest !== parseInt(n.charAt(size), 10)) return false;
    }
    return true;
  }

  function ageFromDate(iso) {
    if (!iso) return null;
    var b = new Date(iso + "T00:00:00");
    if (isNaN(b.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - b.getFullYear();
    var m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
    return age;
  }

  function refreshAge() {
    var age = ageFromDate(val("fBirth"));
    setVal("fAge", age != null && age >= 0 && age < 120 ? String(age) + " anos" : "");
    var alert = byId("anMinorAlert");
    if (alert) alert.classList.toggle("show", age != null && age >= 0 && age < 18);
  }

  /* ------------------------------------------------------------ PAR-Q */

  function parqAnswer(id) {
    var checked = d.querySelector('input[name="parq_' + id + '"]:checked');
    return checked ? checked.value === "yes" : null;
  }

  function optionMarkup(qid, value, label) {
    return '<label class="an-opt opt-' + value + '">' +
             '<input type="radio" name="parq_' + qid + '" value="' + value + '">' +
             '<span>' + label + '</span>' +
           '</label>';
  }

  function revealMarkup(key, inner) {
    return '<div class="an-reveal" data-reveal="' + key + '"><div class="an-reveal-in">' + inner + '</div></div>';
  }

  function textField(id, label, required) {
    return '<div class="field">' +
             '<label for="' + id + '">' + label + (required ? ' <span class="req">*</span>' : '') + '</label>' +
             '<input id="' + id + '">' +
             '<span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
           '</div>';
  }

  function renderParq() {
    var host = byId("anParq");
    if (!host) return;

    host.innerHTML = QUESTIONS.map(function (q) {
      var extra = "";

      if (q.extra === "chronic") {
        extra = revealMarkup("chronic",
          '<div class="field">' +
            '<label for="qChronicWhat">Quais doenças? <span class="req">*</span></label>' +
            '<textarea id="qChronicWhat" rows="2" style="min-height:80px"></textarea>' +
            '<span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
          '</div>' +
          '<div>' +
            '<p style="font-weight:600;margin:0 0 10px">Você toma remédio para essa condição? <span class="req">*</span></p>' +
            '<div class="an-opts">' +
              '<label class="an-opt opt-yes"><input type="radio" name="chronicMeds" value="yes"><span>Sim</span></label>' +
              '<label class="an-opt opt-no"><input type="radio" name="chronicMeds" value="no"><span>Não</span></label>' +
            '</div>' +
            '<span class="an-err" id="anChronicMedsErr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
          '</div>' +
          revealMarkup("chronicMeds",
            textField("qChronicMedsList", "Quais remédios?", true) +
            textField("qChronicMedsWhich", "Para qual doença?", true)
          )
        );
      }

      if (q.extra === "ortho") {
        extra = revealMarkup("ortho",
          '<div class="field">' +
            '<label for="qOrthoWhat">Conte o que aconteceu <span class="req">*</span></label>' +
            '<textarea id="qOrthoWhat" rows="2" style="min-height:80px" placeholder="Ex.: lesão no joelho direito em 2023"></textarea>' +
            '<span class="err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
          '</div>'
        );
      }

      if (q.extra === "activity") {
        extra = revealMarkup("activity",
          textField("qActivityWhat", "Qual atividade?", true) +
          textField("qActivityTime", "Há quanto tempo?", true)
        );
      }

      return '<article class="an-q" data-q="' + q.id + '">' +
               '<div class="an-q-head">' +
                 '<span class="an-q-num">' + q.id + '</span>' +
                 '<p class="an-q-text">' + q.text + '</p>' +
               '</div>' +
               '<div class="an-opts">' + optionMarkup(q.id, "yes", "Sim") + optionMarkup(q.id, "no", "Não") + '</div>' +
               '<span class="an-err" id="anQErr' + q.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg><span></span></span>' +
               extra +
             '</article>';
    }).join("");

    all('input[type="radio"]', host).forEach(function (radio) {
      radio.addEventListener("change", function () {
        var card = radio.closest(".an-q");
        if (card) {
          card.classList.remove("has-error");
          var err = card.querySelector(".an-err");
          if (err) err.classList.remove("show");
        }
        setBlockError("anChronicMedsErr", "");
        syncReveals();
        markDirty();
      });
    });

    EXTRA_FIELDS.forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener("input", function () { clearError(el); markDirty(); });
    });
  }

  function toggleReveal(key, show) {
    var el = d.querySelector('[data-reveal="' + key + '"]');
    if (el) el.classList.toggle("show", !!show);
  }

  function syncReveals() {
    toggleReveal("chronic", parqAnswer(4) === true);
    toggleReveal("ortho", parqAnswer(5) === true);
    toggleReveal("activity", parqAnswer(7) === true);

    var meds = d.querySelector('input[name="chronicMeds"]:checked');
    toggleReveal("chronicMeds", parqAnswer(4) === true && !!meds && meds.value === "yes");

    QUESTIONS.forEach(function (q) {
      var card = d.querySelector('.an-q[data-q="' + q.id + '"]');
      if (card) card.classList.toggle("is-answered", parqAnswer(q.id) !== null);
    });

    var isOther = val("fGoal") === "Outro";
    var otherField = byId("fGoalOtherField");
    if (otherField) otherField.hidden = !isOther;

    var hasYes = QUESTIONS.some(function (q) { return parqAnswer(q.id) === true; });
    var alert = byId("anMedAlert");
    if (alert) alert.classList.toggle("show", hasYes);
    return hasYes;
  }

  /* --------------------------------------------------------- assinatura */

  function createSignature() {
    var canvas = byId("anSignature");
    var wrap = byId("anSignWrap");
    if (!canvas || !wrap) return null;

    var ctx = canvas.getContext("2d");
    var strokes = [];        /* [[{x,y} normalizado 0..1, ...], ...] */
    var current = null;
    var drawing = false;
    var saved = "";
    var box = { w: 0, h: 0 };

    function paint() {
      var ratio = Math.max(1, Math.min(3, w.devicePixelRatio || 1));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#14141a";

      strokes.forEach(function (stroke) {
        if (!stroke.length) return;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x * box.w, stroke[0].y * box.h);
        if (stroke.length === 1) {
          ctx.lineTo(stroke[0].x * box.w + 0.6, stroke[0].y * box.h);
        } else {
          for (var i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x * box.w, stroke[i].y * box.h);
        }
        ctx.stroke();
      });

      wrap.classList.toggle("has-ink", strokes.length > 0);
    }

    /* Redimensiona o buffer do canvas. Só roda quando o elemento está
       visível — antes disso getBoundingClientRect() devolve 0x0 e o
       canvas ficaria sem área de desenho. */
    function fit() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      var ratio = Math.max(1, Math.min(3, w.devicePixelRatio || 1));
      var nextW = Math.round(rect.width * ratio);
      var nextH = Math.round(rect.height * ratio);
      box.w = rect.width;
      box.h = rect.height;
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
      paint();
      return true;
    }

    function pointFrom(ev) {
      var rect = canvas.getBoundingClientRect();
      var src = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
      return {
        x: Math.min(1, Math.max(0, (src.clientX - rect.left) / (rect.width || 1))),
        y: Math.min(1, Math.max(0, (src.clientY - rect.top) / (rect.height || 1)))
      };
    }

    function start(ev) {
      if (ev.button != null && ev.button !== 0) return;
      ev.preventDefault();
      if (!box.w && !fit()) return;
      drawing = true;
      current = [pointFrom(ev)];
      strokes.push(current);
      wrap.classList.add("is-active");
      wrap.classList.remove("has-error");
      paint();
    }

    function move(ev) {
      if (!drawing || !current) return;
      ev.preventDefault();
      current.push(pointFrom(ev));
      paint();
    }

    function end() {
      if (!drawing) return;
      drawing = false;
      current = null;
      wrap.classList.remove("is-active");
      if (saved) {
        saved = "";
        wrap.classList.remove("is-saved");
      }
      setStatus("Toque em Salvar assinatura para confirmar.", "is-pending");
      markDirty();
    }

    function setStatus(text, cls) {
      var el = byId("anSignStatus");
      if (!el) return;
      el.className = "an-sign-status" + (cls ? " " + cls : "");
      el.textContent = text;
    }

    /* Exporta recortado na área desenhada, em tamanho fixo — mantém o
       PNG pequeno o bastante para o POST. */
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
      var octx = out.getContext("2d");
      octx.translate((outW - srcW * scale) / 2, (outH - srcH * scale) / 2);
      octx.scale(scale, scale);
      octx.translate(-minX * box.w, -minY * box.h);
      octx.lineWidth = 2.2;
      octx.lineCap = "round";
      octx.lineJoin = "round";
      octx.strokeStyle = "#14141a";
      strokes.forEach(function (stroke) {
        if (!stroke.length) return;
        octx.beginPath();
        octx.moveTo(stroke[0].x * box.w, stroke[0].y * box.h);
        if (stroke.length === 1) octx.lineTo(stroke[0].x * box.w + 0.6, stroke[0].y * box.h);
        else for (var i = 1; i < stroke.length; i++) octx.lineTo(stroke[i].x * box.w, stroke[i].y * box.h);
        octx.stroke();
      });
      return out.toDataURL("image/png");
    }

    function inkLength() {
      return strokes.reduce(function (acc, s) { return acc + s.length; }, 0);
    }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseleave", end);
    w.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    canvas.addEventListener("touchcancel", end);

    /* O canvas nasce escondido (etapa 3). O observer garante que ele
       ganhe tamanho no exato momento em que aparece na tela. */
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(function () { fit(); }).observe(canvas);
    } else {
      w.addEventListener("resize", function () { fit(); });
    }

    byId("anSignSave").addEventListener("click", function () {
      if (inkLength() < 4) {
        wrap.classList.add("has-error");
        setBlockError("anSignErr", "Faça sua assinatura no quadro antes de salvar.");
        toast("Assine no quadro primeiro.", "bad");
        return;
      }
      saved = exportPng();
      wrap.classList.add("is-saved");
      wrap.classList.remove("has-error");
      setBlockError("anSignErr", "");
      setStatus("Assinatura salva.", "is-saved");
      toast("Assinatura salva.", "good");
      markDirty();
    });

    byId("anSignUndo").addEventListener("click", function () {
      if (!strokes.length) return;
      strokes.pop();
      saved = "";
      wrap.classList.remove("is-saved");
      paint();
      setStatus(strokes.length ? "Toque em Salvar assinatura para confirmar." : "Nenhuma assinatura salva ainda.", strokes.length ? "is-pending" : "");
      markDirty();
    });

    byId("anSignClear").addEventListener("click", function () {
      strokes = [];
      saved = "";
      wrap.classList.remove("is-saved", "has-error");
      paint();
      setStatus("Nenhuma assinatura salva ainda.", "");
      markDirty();
    });

    return {
      fit: fit,
      isSaved: function () { return !!saved; },
      dataUrl: function () { return saved; },
      strokes: function () { return strokes; },
      restore: function (savedStrokes, savedPng) {
        strokes = Array.isArray(savedStrokes) ? savedStrokes : [];
        saved = savedPng || "";
        fit();
        paint();
        if (saved) {
          wrap.classList.add("is-saved");
          setStatus("Assinatura salva.", "is-saved");
        } else if (strokes.length) {
          setStatus("Toque em Salvar assinatura para confirmar.", "is-pending");
        }
      },
      reset: function () {
        strokes = [];
        saved = "";
        wrap.classList.remove("is-saved", "has-error");
        paint();
        setStatus("Nenhuma assinatura salva ainda.", "");
      }
    };
  }

  /* ---------------------------------------------------- rascunho (sessão) */

  function storeKey() { return STORE_PREFIX + state.code; }

  function draftSnapshot() {
    var data = { step: state.step, fields: {}, parq: {}, chronicMeds: "", terms: false, consent: false };
    FIELDS.concat(EXTRA_FIELDS).forEach(function (id) {
      var el = byId(id);
      if (el) data.fields[id] = el.value;
    });
    QUESTIONS.forEach(function (q) {
      var a = parqAnswer(q.id);
      data.parq[q.id] = a === null ? "" : (a ? "yes" : "no");
    });
    var meds = d.querySelector('input[name="chronicMeds"]:checked');
    data.chronicMeds = meds ? meds.value : "";
    data.terms = !!(byId("fTerms") && byId("fTerms").checked);
    data.consent = !!(byId("fHealthConsent") && byId("fHealthConsent").checked);
    if (sign) {
      data.signStrokes = sign.strokes();
      data.signPng = sign.dataUrl();
    }
    return data;
  }

  /* sessionStorage: o rascunho morre junto com a aba (LGPD) */
  function saveDraft() {
    if (!state.code || state.submitted) return;
    try {
      w.sessionStorage.setItem(storeKey(), JSON.stringify(draftSnapshot()));
    } catch (e) { /* cota cheia ou storage bloqueado — segue sem rascunho */ }
  }

  function markDirty() {
    state.dirty = true;
    w.clearTimeout(saveTimer);
    saveTimer = w.setTimeout(saveDraft, 300);
  }

  function readDraft() {
    try {
      var raw = w.sessionStorage.getItem(storeKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function dropDraft() {
    try { w.sessionStorage.removeItem(storeKey()); } catch (e) {}
  }

  function applyDraft(draft) {
    if (!draft) return false;
    var fields = draft.fields || {};
    Object.keys(fields).forEach(function (id) {
      var el = byId(id);
      if (el) el.value = fields[id];
    });

    QUESTIONS.forEach(function (q) {
      var answer = (draft.parq || {})[q.id];
      if (answer !== "yes" && answer !== "no") return;
      var input = d.querySelector('input[name="parq_' + q.id + '"][value="' + answer + '"]');
      if (input) input.checked = true;
    });

    if (draft.chronicMeds === "yes" || draft.chronicMeds === "no") {
      var meds = d.querySelector('input[name="chronicMeds"][value="' + draft.chronicMeds + '"]');
      if (meds) meds.checked = true;
    }

    if (byId("fTerms")) byId("fTerms").checked = !!draft.terms;
    if (byId("fHealthConsent")) byId("fHealthConsent").checked = !!draft.consent;
    if (sign) sign.restore(draft.signStrokes, draft.signPng);

    refreshAge();
    syncReveals();
    goToStep(draft.step || 1, true);
    return true;
  }

  /* Preenche só o que veio da academia e só onde estiver vazio. */
  function applyLeadPrefill() {
    var lead = state.lead;
    if (!lead) return;
    if (!val("fName") && lead.name) setVal("fName", lead.name);
    if (!val("fEmail") && lead.email) setVal("fEmail", lead.email);
    if (!val("fPhone") && lead.phone) setVal("fPhone", maskPhone(lead.phone));
  }

  function resetForm() {
    FIELDS.concat(EXTRA_FIELDS).forEach(function (id) { setVal(id, ""); });
    all('#anParq input[type="radio"]').forEach(function (r) { r.checked = false; });
    if (byId("fTerms")) byId("fTerms").checked = false;
    if (byId("fHealthConsent")) byId("fHealthConsent").checked = false;
    if (sign) sign.reset();
    clearAllErrors();
    refreshAge();
    syncReveals();
  }

  /* ------------------------------------------------------------- etapas */

  function goToStep(next, skipScroll) {
    state.step = Math.max(1, Math.min(STEP_TOTAL, next));

    all("[data-block]").forEach(function (block) {
      block.hidden = Number(block.getAttribute("data-block")) !== state.step;
    });

    all(".an-step").forEach(function (item) {
      var n = Number(item.getAttribute("data-step"));
      item.classList.toggle("is-current", n === state.step);
      item.classList.toggle("is-done", n < state.step);
      item.setAttribute("aria-current", n === state.step ? "step" : "false");
    });

    byId("anPrev").hidden = state.step === 1;
    byId("anNext").hidden = state.step === STEP_TOTAL;
    byId("anSubmit").hidden = state.step !== STEP_TOTAL;

    if (state.step === STEP_TOTAL && sign) sign.fit();
    if (!skipScroll) {
      var panel = byId("anPanel");
      var top = panel ? panel.getBoundingClientRect().top + w.pageYOffset - 90 : 0;
      w.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    markDirty();
  }

  /* ---------------------------------------------------------- validação */

  /* Devolve { step, el } do primeiro problema, ou null se estiver tudo certo. */
  function validate(scope) {
    clearAllErrors();
    var first = null;

    function fail(step, el, message) {
      if (!el) return;
      setError(el, message);
      if (!first) first = { step: step, el: el };
    }

    var checkStep1 = scope === 1 || scope === "all";
    var checkStep2 = scope === 2 || scope === "all";
    var checkStep3 = scope === 3 || scope === "all";

    if (checkStep1) {
      if (val("fName").length < 3) fail(1, byId("fName"), "Escreva seu nome completo.");
      else if (val("fName").split(/\s+/).length < 2) fail(1, byId("fName"), "Inclua nome e sobrenome.");

      var phone = digits(val("fPhone"));
      if (phone.length < 10 || phone.length > 11) fail(1, byId("fPhone"), "Informe o telefone com DDD.");

      var email = val("fEmail");
      if (email && !isEmail(email)) fail(1, byId("fEmail"), "Confira o e-mail digitado.");

      if (!val("fCpf")) fail(1, byId("fCpf"), "Informe o seu CPF.");
      else if (!isCpf(val("fCpf"))) fail(1, byId("fCpf"), "Esse CPF não é válido. Confira os números.");

      var birth = val("fBirth");
      var age = ageFromDate(birth);
      if (!birth) fail(1, byId("fBirth"), "Informe a data de nascimento.");
      else if (age === null) fail(1, byId("fBirth"), "Data inválida.");
      else if (age < 0) fail(1, byId("fBirth"), "A data não pode estar no futuro.");
      else if (age > 110) fail(1, byId("fBirth"), "Confira o ano de nascimento.");
      else if (age < 3) fail(1, byId("fBirth"), "Confira a data de nascimento.");

      if (digits(val("fCep")).length !== 8) fail(1, byId("fCep"), "O CEP tem 8 números.");
      if (!val("fStreet")) fail(1, byId("fStreet"), "Informe a rua.");
      if (!val("fNumber")) fail(1, byId("fNumber"), "Informe o número.");
      if (!val("fDistrict")) fail(1, byId("fDistrict"), "Informe o bairro.");
      if (!val("fCity")) fail(1, byId("fCity"), "Informe a cidade.");
      if (UFS.indexOf(val("fState").toUpperCase()) === -1) fail(1, byId("fState"), "UF inválida.");

      if (val("fEmergName").length < 3) fail(1, byId("fEmergName"), "Informe quem devemos avisar.");
      var ePhone = digits(val("fEmergPhone"));
      if (ePhone.length < 10 || ePhone.length > 11) fail(1, byId("fEmergPhone"), "Informe o telefone com DDD.");
      else if (ePhone === phone) fail(1, byId("fEmergPhone"), "Use um telefone diferente do seu.");
    }

    if (checkStep2) {
      QUESTIONS.forEach(function (q) {
        if (parqAnswer(q.id) !== null) return;
        var card = d.querySelector('.an-q[data-q="' + q.id + '"]');
        if (card) card.classList.add("has-error");
        setBlockError("anQErr" + q.id, "Escolha Sim ou Não.");
        if (!first) first = { step: 2, el: card };
      });

      if (parqAnswer(4) === true) {
        if (!val("qChronicWhat")) fail(2, byId("qChronicWhat"), "Conte quais doenças.");
        var meds = d.querySelector('input[name="chronicMeds"]:checked');
        if (!meds) {
          setBlockError("anChronicMedsErr", "Escolha Sim ou Não.");
          if (!first) first = { step: 2, el: byId("anChronicMedsErr") };
        } else if (meds.value === "yes") {
          if (!val("qChronicMedsList")) fail(2, byId("qChronicMedsList"), "Informe os remédios.");
          if (!val("qChronicMedsWhich")) fail(2, byId("qChronicMedsWhich"), "Informe a doença.");
        }
      }
      if (parqAnswer(5) === true && !val("qOrthoWhat")) fail(2, byId("qOrthoWhat"), "Conte o que aconteceu.");
      if (parqAnswer(7) === true) {
        if (!val("qActivityWhat")) fail(2, byId("qActivityWhat"), "Informe a atividade.");
        if (!val("qActivityTime")) fail(2, byId("qActivityTime"), "Informe há quanto tempo.");
      }

      if (!val("fGoal")) fail(2, byId("fGoal"), "Escolha o seu objetivo.");
      else if (val("fGoal") === "Outro" && !val("fGoalOther")) fail(2, byId("fGoalOther"), "Conte qual é o objetivo.");
      if (!val("fDays")) fail(2, byId("fDays"), "Escolha quantos dias por semana.");
      if (!val("fShift")) fail(2, byId("fShift"), "Escolha o turno.");
    }

    if (checkStep3) {
      if (!byId("fTerms").checked) {
        setBlockError("anTermsErr", "É preciso aceitar o termo para enviar.");
        if (!first) first = { step: 3, el: byId("fTerms") };
      }
      if (!byId("fHealthConsent").checked) {
        setBlockError("anConsentErr", "Precisamos da sua autorização para usar os dados de saúde.");
        if (!first) first = { step: 3, el: byId("fHealthConsent") };
      }
      if (!sign || !sign.isSaved()) {
        byId("anSignWrap").classList.add("has-error");
        setBlockError("anSignErr", sign && sign.strokes().length
          ? "Sua assinatura ainda não foi salva."
          : "A assinatura é obrigatória.");
        if (!first) first = { step: 3, el: byId("anSignWrap") };
      }
    }

    return first;
  }

  /* Leva o usuário até o problema, mesmo que ele esteja em outra etapa. */
  function focusProblem(problem) {
    if (!problem) return;
    if (problem.step !== state.step) goToStep(problem.step, true);
    w.setTimeout(function () {
      var el = problem.el;
      if (!el) return;
      var target = el.closest(".an-q") || el.closest(".field") || el;
      if (target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el.focus) {
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      }
    }, 60);
  }

  /* ------------------------------------------------------------- payload */

  function fullAddress() {
    var parts = [val("fStreet"), val("fNumber"), val("fComplement"), val("fDistrict"), val("fCity"), val("fState").toUpperCase()];
    return parts.filter(Boolean).join(", ");
  }

  function buildPayload() {
    var parq = QUESTIONS.map(function (q) {
      var yes = parqAnswer(q.id) === true;
      var details = null;

      if (q.id === 4 && yes) {
        var meds = d.querySelector('input[name="chronicMeds"]:checked');
        details = "Doenças: " + val("qChronicWhat");
        details += " | Usa medicamentos: " + (meds ? (meds.value === "yes" ? "Sim" : "Não") : "");
        if (meds && meds.value === "yes") {
          details += " | Medicamentos: " + val("qChronicMedsList");
          details += " | Doença relacionada: " + val("qChronicMedsWhich");
        }
      }
      if (q.id === 5 && yes) details = val("qOrthoWhat") || null;
      if (q.id === 7 && yes) details = "Atividade: " + val("qActivityWhat") + " | Tempo: " + val("qActivityTime");

      return { question: q.id, answer: yes, details: details };
    });

    var goal = val("fGoal");
    var age = ageFromDate(val("fBirth"));

    return {
      personal: {
        name: val("fName"),
        email: val("fEmail") || null,
        phone: val("fPhone"),
        cpf: val("fCpf"),
        address: fullAddress(),
        cep: val("fCep"),
        address_street: val("fStreet"),
        address_number: val("fNumber"),
        address_complement: val("fComplement") || null,
        address_district: val("fDistrict"),
        address_city: val("fCity"),
        address_state: val("fState").toUpperCase(),
        birth_date: val("fBirth") || null,
        age: age == null ? 0 : age,
        emergency_contact: val("fEmergName"),
        emergency_phone: val("fEmergPhone")
      },
      parq: parq,
      goal: goal === "Outro" ? val("fGoalOther") : goal,
      training_days: val("fDays"),
      training_shift: val("fShift"),
      medical_warning: QUESTIONS.some(function (q) { return parqAnswer(q.id) === true; }),
      accepted_terms: byId("fTerms").checked,
      health_data_consent: byId("fHealthConsent").checked,
      signature: sign ? sign.dataUrl() : ""
    };
  }

  /* --------------------------------------------------------------- envio */

  function submit(ev) {
    if (ev) ev.preventDefault();
    if (state.sending) return;

    var problem = validate("all");
    if (problem) {
      focusProblem(problem);
      toast("Falta preencher alguma coisa. Levamos você até lá.", "bad");
      return;
    }

    var btn = byId("anSubmit");
    state.sending = true;
    btn.disabled = true;
    btn.classList.add("btn-loading");

    fetchJson(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload())
    }).then(function (res) {
      if (!res.ok || !res.json || res.json.success === false) {
        var message = (res.json && res.json.message) ? res.json.message : "Não conseguimos enviar agora. Tente de novo em instantes.";
        throw new Error(message);
      }
      state.submitted = true;
      state.dirty = false;
      dropDraft();
      showScreen("stDone");
      w.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (err) {
      toast(err && err.message ? err.message : "Não conseguimos enviar agora. Tente de novo.", "bad");
    }).finally(function () {
      state.sending = false;
      btn.disabled = false;
      btn.classList.remove("btn-loading");
    });
  }

  /* ----------------------------------------------------------- CEP */

  var cepBusy = false;
  var lastCepLookup = "";

  function lookupCep() {
    var cep = digits(val("fCep"));
    if (cep.length !== 8 || cepBusy || cep === lastCepLookup) return;

    cepBusy = true;
    lastCepLookup = cep;
    var note = byId("anCepNote");
    if (note) note.classList.add("show");

    fetchJson("https://viacep.com.br/ws/" + cep + "/json/", { method: "GET" })
      .then(function (res) {
        if (!res.ok || !res.json) throw new Error("falha");
        if (res.json.erro) {
          setError(byId("fCep"), "CEP não encontrado. Confira os números.");
          lastCepLookup = "";
          return;
        }
        var j = res.json;
        if (j.logradouro) setVal("fStreet", j.logradouro);
        if (j.bairro) setVal("fDistrict", j.bairro);
        if (j.localidade) setVal("fCity", j.localidade);
        if (j.uf) setVal("fState", j.uf);
        [byId("fStreet"), byId("fDistrict"), byId("fCity"), byId("fState")].forEach(clearError);
        clearError(byId("fCep"));
        toast("Endereço preenchido. Falta só o número.", "good");
        var num = byId("fNumber");
        if (num && !num.value && state.step === 1) num.focus();
        markDirty();
      })
      .catch(function () {
        lastCepLookup = "";
        toast("Não conseguimos buscar o CEP. Preencha o endereço à mão.", "bad");
      })
      .finally(function () {
        cepBusy = false;
        if (note) note.classList.remove("show");
      });
  }

  /* --------------------------------------------------------------- setup */

  function bindForm() {
    FIELDS.forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener("input", function () { clearError(el); markDirty(); });
      el.addEventListener("change", function () { clearError(el); markDirty(); });
    });

    applyMask(byId("fPhone"), maskPhone);
    applyMask(byId("fEmergPhone"), maskPhone);
    applyMask(byId("fCpf"), maskCpf);
    applyMask(byId("fCep"), maskCep);

    byId("fBirth").addEventListener("change", refreshAge);
    byId("fBirth").addEventListener("input", refreshAge);
    byId("fBirth").setAttribute("max", new Date().toISOString().slice(0, 10));

    byId("fState").addEventListener("input", function () {
      byId("fState").value = byId("fState").value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    });

    byId("fGoal").addEventListener("change", syncReveals);

    byId("fCep").addEventListener("blur", lookupCep);
    byId("fCep").addEventListener("input", function () {
      if (digits(val("fCep")).length === 8) lookupCep();
    });

    [byId("fTerms"), byId("fHealthConsent")].forEach(function (el) {
      el.addEventListener("change", function () {
        setBlockError(el.id === "fTerms" ? "anTermsErr" : "anConsentErr", "");
        markDirty();
      });
    });

    byId("anNext").addEventListener("click", function () {
      var problem = validate(state.step);
      if (problem) {
        focusProblem(problem);
        return;
      }
      goToStep(state.step + 1);
    });

    byId("anPrev").addEventListener("click", function () {
      clearAllErrors();
      goToStep(state.step - 1);
    });

    var form = byId("anForm");
    form.addEventListener("submit", submit);

    /* Enter em um campo não pode enviar a ficha no meio do caminho. */
    form.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var tag = (ev.target.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "button") return;
      ev.preventDefault();
      if (state.step < STEP_TOTAL) byId("anNext").click();
      else byId("anSubmit").click();
    });

    /* Confirmação em dois toques, sem diálogo nativo do navegador. */
    var wipeBtn = byId("anWipe");
    var wipeArmed = 0;
    wipeBtn.addEventListener("click", function () {
      if (!wipeArmed) {
        wipeBtn.textContent = "Tem certeza? Toque de novo para apagar";
        wipeArmed = w.setTimeout(function () {
          wipeArmed = 0;
          wipeBtn.textContent = "Apagar o que preenchi";
        }, 5000);
        return;
      }
      w.clearTimeout(wipeArmed);
      wipeArmed = 0;
      wipeBtn.textContent = "Apagar o que preenchi";
      dropDraft();
      resetForm();
      applyLeadPrefill();
      goToStep(1);
      /* depois de goToStep, que reagenda o autosave */
      w.clearTimeout(saveTimer);
      state.dirty = false;
      dropDraft();
      toast("Pronto, começamos do zero.", "good");
    });

    w.addEventListener("beforeunload", function (ev) {
      if (!state.dirty || state.submitted) return;
      ev.preventDefault();
      ev.returnValue = "";
    });
  }

  function fillStaticContent() {
    var cfg = config();
    var terms = (cfg && cfg.meta && cfg.meta.anamneseTerms) || w.CDC_ANAMNESE_TERMO || DEFAULT_TERMS;
    byId("anTerms").textContent = terms;

    var href = contactHref();
    ["anHelpLink", "anErrorContact", "anFooterContact"].forEach(function (id) {
      var el = byId(id);
      if (el) el.href = href;
    });

    all("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  function readCode() {
    var fromPath = w.location.pathname.match(/\/anamnese\/([^/?#]+)/i);
    if (fromPath && fromPath[1]) return decodeURIComponent(fromPath[1]);
    var qs = new URLSearchParams(w.location.search);
    return trim(qs.get("codigo") || qs.get("code") || "");
  }

  function showLoadError(kind) {
    var title = byId("anErrorTitle");
    var text = byId("anErrorText");
    var retry = byId("anRetryBtn");
    if (kind === "network") {
      title.textContent = "Não conseguimos carregar sua ficha";
      text.textContent = "Parece que a conexão falhou. Verifique sua internet e tente de novo.";
      retry.hidden = false;
    } else {
      title.textContent = "Link inválido ou expirado";
      text.textContent = "Não conseguimos localizar seu convite de anamnese. Fale com a nossa equipe para receber um novo link.";
      retry.hidden = true;
    }
    showScreen("stError");
  }

  function loadLead() {
    showScreen("stLoading");
    return fetchJson(apiUrl(), { method: "GET" })
      .then(function (res) {
        /* Só 404/410 significam "esse código não existe". Qualquer outra
           falha é problema do servidor: pedir um link novo não resolveria. */
        if (res.status === 404 || res.status === 410) {
          showLoadError("invalid");
          return;
        }
        if (!res.ok) {
          showLoadError("network");
          return;
        }
        if (!res.json || res.json.success === false || !res.json.data || !res.json.data.lead) {
          showLoadError("invalid");
          return;
        }

        showScreen("stForm");

        var restored = applyDraft(readDraft());

        state.lead = res.json.data.lead;
        applyLeadPrefill();

        if (restored) toast("Continuamos de onde você parou.", "good");
        if (sign) sign.fit();
      })
      .catch(function () {
        showLoadError("network");
      });
  }

  function init() {
    var cfg = config();
    state.apiBase = (cfg && cfg.meta && cfg.meta.anamneseApi) || "https://portalcia.impactadigital.net/anamnese";
    state.code = readCode();

    fillStaticContent();

    if (!state.code) {
      showLoadError("invalid");
      return;
    }

    var badge = byId("anCode");
    if (badge) {
      byId("anCodeText").textContent = "Código " + state.code;
      badge.hidden = false;
    }

    renderParq();
    sign = createSignature();
    bindForm();
    syncReveals();
    refreshAge();

    byId("anRetryBtn").addEventListener("click", loadLead);
    loadLead();
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
