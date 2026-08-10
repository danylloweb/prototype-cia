(function (w, d) {
  var cfg = w.CDC && w.CDC.data && w.CDC.data.get ? w.CDC.data.get() : null;
  var TERMS_TEXT = w.CDC_ANAMNESE_TERMO || (cfg && cfg.meta && cfg.meta.anamneseTerms) || "";
  var QUESTIONS = [
    { id: 1, text: "Seu médico já lhe disse que possui doença cardiovascular ou hipertensão?" },
    { id: 2, text: "Você sente dor no peito durante repouso ou atividade física?" },
    { id: 3, text: "Você perdeu equilíbrio por tontura ou consciência nos últimos 12 meses?" },
    { id: 4, text: "Possui alguma doença crônica além de hipertensão ou doença cardíaca?", extra: "chronic" },
    { id: 5, text: "Possui ou teve problemas em ossos, articulações, ligamentos, músculos ou tendões?", extra: "ortho" },
    { id: 6, text: "Seu médico recomendou realizar atividade física apenas sob supervisão?" },
    { id: 7, text: "Pratica atividade física?", extra: "activity" }
  ];

  var STEP_TOTAL = 3;
  var step = 1;
  var code = "";
  var submitLockedByTerms = false;
  var savedSignature = "";
  var redoSignature = "";
  var isDrawing = false;
  var hasDrawnStroke = false;
  var autosaveTimer = 0;
  var toast = null;
  var toastBody = null;

  var els = {};

  function byId(id) { return d.getElementById(id); }
  function $all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function stateKey() { return "anamnese_" + code; }
  function toDigits(v) { return String(v || "").replace(/\D/g, ""); }
  function safeStr(v) { return String(v == null ? "" : v); }
  function isEmail(v) { return !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

  function parseCode() {
    let match = w.location.pathname.match(/\/anamnese\/([^/?#]+)/i);
    if (match && match[1]) return decodeURIComponent(match[1]);
    const q = new URLSearchParams(w.location.search).get("code");
    return q ? decodeURIComponent(q) : "";
  }

  function contactHref() {
    var cfg = w.CDC && w.CDC.data && w.CDC.data.get ? w.CDC.data.get() : null;
    var wa = cfg && cfg.meta && cfg.meta.partnerCentralWhatsapp ? toDigits(cfg.meta.partnerCentralWhatsapp) : "";
    return wa ? ("https://wa.me/" + wa) : "contato.html";
  }

  function showState(name) {
    ["stateLoading", "stateInvalid", "stateForm", "stateSuccess"].forEach(function (id) {
      byId(id).classList.toggle("d-none", id !== name);
    });
  }

  function showToast(msg, danger) {
    if (!toast) return;
    toastBody.textContent = msg;
    var root = byId("appToast");
    root.classList.toggle("text-bg-danger", !!danger);
    root.classList.toggle("text-bg-dark", !danger);
    toast.show();
  }

  function setStep(next) {
    step = Math.max(1, Math.min(STEP_TOTAL, next));
    $all("[data-step]").forEach(function (block) {
      block.classList.toggle("d-none", Number(block.getAttribute("data-step")) !== step);
    });
    byId("prevBtn").classList.toggle("d-none", step === 1);
    byId("nextBtn").classList.toggle("d-none", step === STEP_TOTAL);
    byId("submitBtn").classList.toggle("d-none", step !== STEP_TOTAL);
    var pct = Math.round((step / STEP_TOTAL) * 100);
    byId("wizardProgress").style.width = pct + "%";
    byId("wizardProgress").textContent = "Etapa " + step + " de " + STEP_TOTAL;
    [1, 2, 3].forEach(function (n) {
      byId("stepBadge" + n).classList.toggle("text-bg-dark", n === step);
      byId("stepBadge" + n).classList.toggle("text-bg-light", n !== step);
    });
    w.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setInvalid(el, message) {
    if (!el) return;
    el.classList.add("is-invalid");
    var feedback = el.parentElement && el.parentElement.querySelector(".invalid-feedback");
    if (feedback) feedback.textContent = message;
  }

  function clearInvalid(el) {
    if (!el) return;
    el.classList.remove("is-invalid");
    var feedback = el.parentElement && el.parentElement.querySelector(".invalid-feedback");
    if (feedback) feedback.textContent = "";
  }

  function clearAllErrors() {
    $all(".is-invalid").forEach(function (el) { el.classList.remove("is-invalid"); });
    $all(".invalid-feedback").forEach(function (el) { if (el.id !== "signatureError" && el.id !== "acceptedTermsError") el.textContent = ""; });
    byId("signatureError").textContent = "";
    byId("acceptedTermsError").textContent = "";
  }

  function maskPhone(input) {
    input.addEventListener("input", function () {
      var v = toDigits(input.value).slice(0, 11);
      if (v.length > 6) input.value = "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7);
      else if (v.length > 2) input.value = "(" + v.slice(0, 2) + ") " + v.slice(2);
      else input.value = v;
    });
  }

  function maskCpf(input) {
    input.addEventListener("input", function () {
      var v = toDigits(input.value).slice(0, 11);
      v = v.replace(/^(\d{3})(\d)/, "$1.$2");
      v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1-$2");
      input.value = v;
    });
  }

  function maskCep(input) {
    input.addEventListener("input", function () {
      var v = toDigits(input.value).slice(0, 8);
      if (v.length > 5) input.value = v.slice(0, 5) + "-" + v.slice(5);
      else input.value = v;
    });
  }

  function searchCep(cepValue) {
    var cep = toDigits(cepValue);
    if (cep.length !== 8) {
      showToast("CEP deve ter 8 dígitos.", true);
      return Promise.reject("Invalid CEP format");
    }

    var loadingEl = byId("cepLoading");
    if (loadingEl) loadingEl.classList.remove("d-none");

    return fetch("https://viacep.com.br/ws/" + cep + "/json/", { method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        if (json.erro) {
          showToast("CEP não encontrado.", true);
          return;
        }
        byId("addressStreet").value = json.logradouro || "";
        byId("addressDistrict").value = json.bairro || "";
        byId("addressCity").value = json.localidade || "";
        byId("addressState").value = json.uf || "";
        if (byId("addressComplement")) byId("addressComplement").value = json.complemento || "";

        clearInvalid(byId("cep"));
        byId("addressNumber").focus();
        showToast("Endereço preenchido automaticamente.");
        scheduleAutosave();
      })
      .catch(function (err) {
        showToast("Erro ao buscar CEP. Verifique a conexão.", true);
      })
      .finally(function () {
        if (loadingEl) loadingEl.classList.add("d-none");
      });
  }

  function calculateAge() {
    var birth = byId("birthDate").value;
    if (!birth) { byId("age").value = ""; return; }
    var b = new Date(birth + "T00:00:00");
    if (Number.isNaN(b.getTime())) { byId("age").value = ""; return; }
    var now = new Date();
    var age = now.getFullYear() - b.getFullYear();
    var m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
    byId("age").value = age >= 0 ? String(age) : "";
  }

  function renderParq() {
    var host = byId("parqCards");
    host.innerHTML = QUESTIONS.map(function (q) {
      var extra = "";
      if (q.extra === "chronic") {
        extra = '' +
          '<div class="reveal-wrap" data-extra="chronic">' +
            '<label class="form-label mt-2">Descreva quais doenças.</label>' +
            '<textarea class="form-control" rows="2" id="chronicDetails"></textarea>' +
            '<div class="invalid-feedback"></div>' +
            '<div class="mt-3">' +
              '<p class="mb-2">Faz uso de medicamentos para doenças crônicas?</p>' +
              '<div class="d-flex gap-3">' +
                '<div class="form-check"><input class="form-check-input" type="radio" name="chronicMeds" id="chronicMedsYes" value="yes"><label class="form-check-label" for="chronicMedsYes">Sim</label></div>' +
                '<div class="form-check"><input class="form-check-input" type="radio" name="chronicMeds" id="chronicMedsNo" value="no"><label class="form-check-label" for="chronicMedsNo">Não</label></div>' +
              '</div>' +
              '<div class="invalid-feedback d-block" id="chronicMedsError"></div>' +
            '</div>' +
            '<div class="reveal-wrap mt-3" data-extra="chronicMeds">' +
              '<label class="form-label">Medicamentos</label>' +
              '<input class="form-control" id="chronicMedsList">' +
              '<div class="invalid-feedback"></div>' +
              '<label class="form-label mt-2">Doença relacionada</label>' +
              '<input class="form-control" id="chronicMedsDisease">' +
              '<div class="invalid-feedback"></div>' +
            '</div>' +
          '</div>';
      }
      if (q.extra === "ortho") {
        extra = '' +
          '<div class="reveal-wrap" data-extra="ortho">' +
            '<label class="form-label mt-2">Especifique</label>' +
            '<textarea class="form-control" rows="2" id="orthoDetails"></textarea>' +
            '<div class="invalid-feedback"></div>' +
          '</div>';
      }
      if (q.extra === "activity") {
        extra = '' +
          '<div class="reveal-wrap" data-extra="activity">' +
            '<label class="form-label mt-2">Atividade</label>' +
            '<input class="form-control" id="activityName">' +
            '<div class="invalid-feedback"></div>' +
            '<label class="form-label mt-2">Tempo de prática</label>' +
            '<input class="form-control" id="activityTime">' +
            '<div class="invalid-feedback"></div>' +
          '</div>';
      }
      return '' +
      '<article class="parq-card card shadow-sm border-0">' +
        '<div class="card-body">' +
          '<p class="parq-title mb-3">' + q.id + '. ' + q.text + '</p>' +
          '<div class="d-flex gap-3">' +
            '<div class="form-check"><input class="form-check-input" type="radio" name="parq_' + q.id + '" id="parq_' + q.id + '_yes" value="yes"><label class="form-check-label" for="parq_' + q.id + '_yes">Sim</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="radio" name="parq_' + q.id + '" id="parq_' + q.id + '_no" value="no"><label class="form-check-label" for="parq_' + q.id + '_no">Não</label></div>' +
          '</div>' +
          '<div class="invalid-feedback d-block" id="parq_' + q.id + '_error"></div>' +
          extra +
        '</div>' +
      '</article>';
    }).join("");

    QUESTIONS.forEach(function (q) {
      $all('input[name="parq_' + q.id + '"]').forEach(function (radio) {
        radio.addEventListener("change", function () {
          toggleParqExtras();
          recomputeMedicalWarning();
          scheduleAutosave();
        });
      });
    });

    $all("#goal, #goalOther, #trainingDays, #trainingShift, #chronicDetails, #orthoDetails, #activityName, #activityTime, #chronicMedsList, #chronicMedsDisease, [name='chronicMeds']").forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", scheduleAutosave);
      el.addEventListener("change", function () { toggleParqExtras(); scheduleAutosave(); });
    });
  }

  function answerYes(questionId) {
    var checked = d.querySelector('input[name="parq_' + questionId + '"]:checked');
    return checked ? checked.value === "yes" : null;
  }

  function toggleReveal(selector, show) {
    var el = d.querySelector(selector);
    if (!el) return;
    el.classList.toggle("show", !!show);
  }

  function toggleParqExtras() {
    toggleReveal('[data-extra="chronic"]', answerYes(4) === true);
    toggleReveal('[data-extra="ortho"]', answerYes(5) === true);
    toggleReveal('[data-extra="activity"]', answerYes(7) === true);

    var medsYes = d.querySelector('input[name="chronicMeds"]:checked');
    toggleReveal('[data-extra="chronicMeds"]', answerYes(4) === true && medsYes && medsYes.value === "yes");

    var isOtherGoal = byId("goal").value === "Outro";
    byId("goalOtherWrap").classList.toggle("d-none", !isOtherGoal);
  }

  function recomputeMedicalWarning() {
    var hasYes = QUESTIONS.some(function (q) { return answerYes(q.id) === true; });
    byId("medicalWarning").classList.toggle("d-none", !hasYes);
    return hasYes;
  }

  function setupSignatureCanvas() {
    var canvas = byId("signatureCanvas");
    var ctx = canvas.getContext("2d");
    var ratio = Math.max(1, w.devicePixelRatio || 1);

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var width = Math.floor(rect.width);
      var height = Math.floor(rect.height);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      if (savedSignature) drawSignatureFromBase64(savedSignature);
    }

    function posFrom(ev) {
      var rect = canvas.getBoundingClientRect();
      var p = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      return { x: p.clientX - rect.left, y: p.clientY - rect.top };
    }

    function start(ev) {
      ev.preventDefault();
      isDrawing = true;
      var p = posFrom(ev);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      hasDrawnStroke = true;
      setSignatureStatus("Assinatura alterada. Clique em Salvar para confirmar.", "pending");
    }

    function move(ev) {
      if (!isDrawing) return;
      ev.preventDefault();
      var p = posFrom(ev);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    function end() {
      isDrawing = false;
    }

    function clearCanvas(keepSaved) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!keepSaved) {
        redoSignature = savedSignature;
        savedSignature = "";
      }
      hasDrawnStroke = false;
      setSignatureStatus("Nenhuma assinatura salva.", "");
      byId("signatureError").textContent = "";
      scheduleAutosave();
    }

    function drawSignatureFromBase64(base64) {
      if (!base64) return;
      var img = new Image();
      img.onload = function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height);
        hasDrawnStroke = true;
      };
      img.src = base64;
    }

    function saveSignature() {
      if (!hasDrawnStroke) {
        byId("signatureError").textContent = "Assinatura obrigatória.";
        showToast("Assine no quadro antes de salvar.", true);
        return;
      }
      savedSignature = canvas.toDataURL("image/png");
      redoSignature = savedSignature;
      setSignatureStatus("Assinatura salva com sucesso.", "saved");
      byId("signatureError").textContent = "";
      scheduleAutosave();
      showToast("Assinatura salva.");
    }

    byId("signatureClear").addEventListener("click", function () { clearCanvas(false); });
    byId("signatureRedo").addEventListener("click", function () {
      if (!redoSignature) return;
      savedSignature = redoSignature;
      drawSignatureFromBase64(savedSignature);
      setSignatureStatus("Assinatura restaurada.", "saved");
      scheduleAutosave();
    });
    byId("signatureSave").addEventListener("click", saveSignature);

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    w.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    w.addEventListener("resize", resize);
    resize();

    return {
      drawFrom: function (base64) {
        savedSignature = base64 || "";
        redoSignature = base64 || "";
        if (savedSignature) {
          drawSignatureFromBase64(savedSignature);
          setSignatureStatus("Assinatura restaurada do rascunho.", "saved");
        }
      }
    };
  }

  function setSignatureStatus(text, type) {
    var el = byId("signatureStatus");
    el.textContent = text;
    el.classList.remove("saved", "pending");
    if (type) el.classList.add(type);
  }

  function collectFormData() {
    var goal = byId("goal").value;
    var goalOther = byId("goalOther").value.trim();

    var parq = QUESTIONS.map(function (q) {
      var yes = answerYes(q.id);
      var details = null;
      if (q.id === 4 && yes) {
        var meds = d.querySelector('input[name="chronicMeds"]:checked');
        details = "Doenças: " + byId("chronicDetails").value.trim();
        details += " | Usa medicamentos: " + (meds ? (meds.value === "yes" ? "Sim" : "Não") : "");
        if (meds && meds.value === "yes") {
          details += " | Medicamentos: " + byId("chronicMedsList").value.trim();
          details += " | Doença relacionada: " + byId("chronicMedsDisease").value.trim();
        }
      }
      if (q.id === 5 && yes) details = byId("orthoDetails").value.trim() || null;
      if (q.id === 7 && yes) details = "Atividade: " + byId("activityName").value.trim() + " | Tempo: " + byId("activityTime").value.trim();
      return {
        question: q.id,
        answer: yes === true,
        details: details || null
      };
    });

    // Montar endereço completo a partir dos campos individuais
    var addressParts = [];
    if (byId("addressStreet").value.trim()) addressParts.push(byId("addressStreet").value.trim());
    if (byId("addressNumber").value.trim()) addressParts.push(byId("addressNumber").value.trim());
    if (byId("addressComplement").value.trim()) addressParts.push(byId("addressComplement").value.trim());
    if (byId("addressDistrict").value.trim()) addressParts.push(byId("addressDistrict").value.trim());
    if (byId("addressCity").value.trim()) addressParts.push(byId("addressCity").value.trim());
    if (byId("addressState").value.trim()) addressParts.push(byId("addressState").value.trim());
    var fullAddress = addressParts.join(", ");
    byId("address").value = fullAddress;

    return {
      personal: {
        name: byId("name").value.trim(),
        email: byId("email").value.trim() || null,
        phone: byId("phone").value.trim(),
        cpf: byId("cpf").value.trim(),
        address: fullAddress,
        birth_date: byId("birthDate").value || null,
        age: Number(byId("age").value || 0),
        emergency_contact: byId("emergencyContact").value.trim(),
        emergency_phone: byId("emergencyPhone").value.trim()
      },
      parq: parq,
      goal: goal === "Outro" ? goalOther : goal,
      training_days: byId("trainingDays").value,
      training_shift: byId("trainingShift").value,
      medical_warning: recomputeMedicalWarning(),
      accepted_terms: byId("acceptedTerms").checked,
      signature: savedSignature
    };
  }

  function validateStep(stepNumber) {
    clearAllErrors();
    var firstInvalid = null;

    function mark(cond, el, msg) {
      if (!cond) return;
      if (!firstInvalid) firstInvalid = el;
      setInvalid(el, msg);
    }

    if (stepNumber === 1 || stepNumber === null) {
      mark(!byId("name").value.trim(), byId("name"), "Informe seu nome.");
      mark(toDigits(byId("phone").value).length < 11, byId("phone"), "Telefone obrigatório no formato (00) 00000-0000.");
      mark(byId("email").value.trim() && !isEmail(byId("email").value.trim()), byId("email"), "E-mail inválido.");
      mark(toDigits(byId("cpf").value).length !== 11, byId("cpf"), "CPF obrigatório no formato 000.000.000-00.");
      mark(toDigits(byId("cep").value).length !== 8, byId("cep"), "CEP obrigatório no formato 00000-000.");
      mark(!byId("addressStreet").value.trim(), byId("addressStreet"), "Informe a rua.");
      mark(!byId("addressNumber").value.trim(), byId("addressNumber"), "Informe o número.");
      mark(!byId("addressDistrict").value.trim(), byId("addressDistrict"), "Informe o bairro.");
      mark(!byId("addressCity").value.trim(), byId("addressCity"), "Informe a cidade.");
      mark(!byId("addressState").value.trim(), byId("addressState"), "Informe o estado.");
      mark(!byId("birthDate").value, byId("birthDate"), "Informe a data de nascimento.");
      mark(!byId("emergencyContact").value.trim(), byId("emergencyContact"), "Informe o contato de emergência.");
      mark(toDigits(byId("emergencyPhone").value).length < 11, byId("emergencyPhone"), "Telefone de emergência obrigatório.");
    }

    if (stepNumber === 2 || stepNumber === null) {
      QUESTIONS.forEach(function (q) {
        var ans = answerYes(q.id);
        if (ans === null) {
          var err = byId("parq_" + q.id + "_error");
          err.textContent = "Selecione Sim ou Não.";
          if (!firstInvalid) firstInvalid = d.querySelector('input[name="parq_' + q.id + '"]');
        } else {
          byId("parq_" + q.id + "_error").textContent = "";
        }
      });

      if (answerYes(4) === true) {
        mark(!byId("chronicDetails").value.trim(), byId("chronicDetails"), "Descreva as doenças.");
        var meds = d.querySelector('input[name="chronicMeds"]:checked');
        if (!meds) {
          byId("chronicMedsError").textContent = "Selecione Sim ou Não.";
          if (!firstInvalid) firstInvalid = d.querySelector('input[name="chronicMeds"]');
        } else {
          byId("chronicMedsError").textContent = "";
          if (meds.value === "yes") {
            mark(!byId("chronicMedsList").value.trim(), byId("chronicMedsList"), "Informe os medicamentos.");
            mark(!byId("chronicMedsDisease").value.trim(), byId("chronicMedsDisease"), "Informe a doença relacionada.");
          }
        }
      }

      if (answerYes(5) === true) {
        mark(!byId("orthoDetails").value.trim(), byId("orthoDetails"), "Especifique o problema.");
      }

      if (answerYes(7) === true) {
        mark(!byId("activityName").value.trim(), byId("activityName"), "Informe a atividade.");
        mark(!byId("activityTime").value.trim(), byId("activityTime"), "Informe o tempo de prática.");
      }

      mark(!byId("goal").value, byId("goal"), "Selecione o objetivo.");
      if (byId("goal").value === "Outro") {
        mark(!byId("goalOther").value.trim(), byId("goalOther"), "Informe o objetivo.");
      }
      mark(!byId("trainingDays").value, byId("trainingDays"), "Selecione os dias por semana.");
      mark(!byId("trainingShift").value, byId("trainingShift"), "Selecione o turno preferido.");
    }

    if (stepNumber === 3 || stepNumber === null) {
      if (!byId("acceptedTerms").checked) {
        byId("acceptedTermsError").textContent = "É obrigatório aceitar o termo.";
        if (!firstInvalid) firstInvalid = byId("acceptedTerms");
      }
      if (!savedSignature) {
        byId("signatureError").textContent = "Assinatura obrigatória.";
        if (!firstInvalid) firstInvalid = byId("signatureCanvas");
      }
      if (submitLockedByTerms) {
        byId("acceptedTermsError").textContent = "Envio bloqueado até o termo oficial ser configurado.";
        if (!firstInvalid) firstInvalid = byId("termsContent");
      }
    }

    if (firstInvalid) {
      if (firstInvalid.scrollIntoView) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      if (firstInvalid.focus) firstInvalid.focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  function saveDraftNow() {
    if (!code) return;
    var payload = collectFormData();
    payload._raw = {
      cep: byId("cep").value,
      addressStreet: byId("addressStreet").value,
      addressNumber: byId("addressNumber").value,
      addressComplement: byId("addressComplement").value,
      addressDistrict: byId("addressDistrict").value,
      addressCity: byId("addressCity").value,
      addressState: byId("addressState").value,
      parqAnswers: QUESTIONS.reduce(function (acc, q) {
        var ans = answerYes(q.id);
        acc[q.id] = ans === null ? "" : (ans ? "yes" : "no");
        return acc;
      }, {}),
      chronicDetails: byId("chronicDetails") ? byId("chronicDetails").value : "",
      chronicMeds: (d.querySelector('input[name="chronicMeds"]:checked') || {}).value || "",
      chronicMedsList: byId("chronicMedsList") ? byId("chronicMedsList").value : "",
      chronicMedsDisease: byId("chronicMedsDisease") ? byId("chronicMedsDisease").value : "",
      orthoDetails: byId("orthoDetails") ? byId("orthoDetails").value : "",
      activityName: byId("activityName") ? byId("activityName").value : "",
      activityTime: byId("activityTime") ? byId("activityTime").value : "",
      goalOther: byId("goalOther") ? byId("goalOther").value : ""
    };
    payload._wizardStep = step;
    try {
      localStorage.setItem(stateKey(), JSON.stringify(payload));
    } catch (e) {}
  }

  function scheduleAutosave() {
    w.clearTimeout(autosaveTimer);
    autosaveTimer = w.setTimeout(saveDraftNow, 250);
  }

  function restoreDraft() {
    try {
      var raw = localStorage.getItem(stateKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function applyDraft(draft, signatureApi) {
    if (!draft) return;
    var p = draft.personal || {};
    byId("name").value = p.name || "";
    byId("email").value = p.email || "";
    byId("phone").value = p.phone || "";
    byId("cpf").value = p.cpf || "";
    byId("cep").value = p.cep || "";
    byId("addressStreet").value = p.addressStreet || "";
    byId("addressNumber").value = p.addressNumber || "";
    byId("addressComplement").value = p.addressComplement || "";
    byId("addressDistrict").value = p.addressDistrict || "";
    byId("addressCity").value = p.addressCity || "";
    byId("addressState").value = p.addressState || "";
    byId("address").value = p.address || "";
    byId("birthDate").value = p.birth_date || "";
    byId("emergencyContact").value = p.emergency_contact || "";
    byId("emergencyPhone").value = p.emergency_phone || "";
    calculateAge();

    var raw = draft._raw || {};
    QUESTIONS.forEach(function (q) {
      var val = raw.parqAnswers && raw.parqAnswers[q.id] ? raw.parqAnswers[q.id] : "";
      if (val === "yes") byId("parq_" + q.id + "_yes").checked = true;
      if (val === "no") byId("parq_" + q.id + "_no").checked = true;
    });

    if (byId("chronicDetails")) byId("chronicDetails").value = raw.chronicDetails || "";
    if (byId("chronicMedsList")) byId("chronicMedsList").value = raw.chronicMedsList || "";
    if (byId("chronicMedsDisease")) byId("chronicMedsDisease").value = raw.chronicMedsDisease || "";
    if (byId("orthoDetails")) byId("orthoDetails").value = raw.orthoDetails || "";
    if (byId("activityName")) byId("activityName").value = raw.activityName || "";
    if (byId("activityTime")) byId("activityTime").value = raw.activityTime || "";
    if (raw.chronicMeds === "yes" && byId("chronicMedsYes")) byId("chronicMedsYes").checked = true;
    if (raw.chronicMeds === "no" && byId("chronicMedsNo")) byId("chronicMedsNo").checked = true;

    byId("goal").value = draft.goal || "";
    if (draft.goal && ["Emagrecimento", "Hipertrofia", "Condicionamento", "Saúde", "Performance", "Reabilitação", "Ganho de Massa"].indexOf(draft.goal) === -1) {
      byId("goal").value = "Outro";
      byId("goalOther").value = raw.goalOther || draft.goal;
    }
    byId("trainingDays").value = safeStr(draft.training_days || "");
    byId("trainingShift").value = draft.training_shift || "";
    byId("acceptedTerms").checked = !!draft.accepted_terms;

    if (draft.signature) {
      savedSignature = draft.signature;
      signatureApi.drawFrom(draft.signature);
    }

    toggleParqExtras();
    recomputeMedicalWarning();
    if (draft._wizardStep) setStep(draft._wizardStep);
  }

  function applyLeadPrefill(lead) {
    if (!lead) return;
    if (!byId("name").value) byId("name").value = lead.name || "";
    if (!byId("email").value) byId("email").value = lead.email || "";
    if (!byId("phone").value) byId("phone").value = lead.phone || "";
  }

  function configureTerms() {
    byId("termsContent").textContent = TERMS_TEXT || "Aguardando termo oficial da ficha de anamnese.";
    submitLockedByTerms = !TERMS_TEXT;
    byId("termsMissingAlert").classList.toggle("d-none", !submitLockedByTerms);
  }

  function submitForm(ev) {
    ev.preventDefault();
    if (!validateStep(null)) return;

    var payload = collectFormData();
    var submitBtn = byId("submitBtn");
    var spinner = byId("submitSpinner");
    submitBtn.disabled = true;
    spinner.classList.remove("d-none");

    fetch("/api/anamnese/" + encodeURIComponent(code), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (json) {
      if (!json || json.success === false) throw new Error("Resposta inválida");
      try { localStorage.removeItem(stateKey()); } catch (e) {}
      showState("stateSuccess");
    }).catch(function () {
      showToast("Não foi possível enviar agora. Tente novamente.", true);
    }).finally(function () {
      submitBtn.disabled = submitLockedByTerms;
      spinner.classList.add("d-none");
    });
  }

  function bindEvents() {
    var form = byId("anamneseForm");
    form.addEventListener("submit", submitForm);
    byId("nextBtn").addEventListener("click", function () { if (validateStep(step)) setStep(step + 1); });
    byId("prevBtn").addEventListener("click", function () { setStep(step - 1); });

    [
      "name", "phone", "email", "cpf", "cep", "addressStreet", "addressNumber", 
      "addressComplement", "addressDistrict", "addressCity", "addressState",
      "birthDate", "emergencyContact", "emergencyPhone", "goal", "goalOther",
      "trainingDays", "trainingShift", "acceptedTerms"
    ].forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener("input", function () { clearInvalid(el); scheduleAutosave(); });
      el.addEventListener("change", function () {
        clearInvalid(el);
        if (id === "goal") toggleParqExtras();
        scheduleAutosave();
      });
    });
    byId("birthDate").addEventListener("change", calculateAge);

    // CEP lookup on blur
    var cepField = byId("cep");
    if (cepField) {
      cepField.addEventListener("blur", function () {
        var cepVal = this.value.trim();
        if (cepVal && toDigits(cepVal).length === 8) {
          searchCep(cepVal);
        }
      });
    }
  }

  function initRefs() {
    els.loading = byId("stateLoading");
    els.invalid = byId("stateInvalid");
    els.form = byId("stateForm");
    els.success = byId("stateSuccess");
  }

  function init() {
    initRefs();
    toastBody = byId("appToastBody");
    toast = new bootstrap.Toast(byId("appToast"), { delay: 2600 });

    code = parseCode();
    byId("invalidContactBtn").href = contactHref();
    byId("leadCodeBadge").textContent = code ? ("Código: " + code) : "Código ausente";
    if (!code) {
      showState("stateInvalid");
      return;
    }

    showState("stateLoading");
    renderParq();
    configureTerms();
    maskPhone(byId("phone"));
    maskPhone(byId("emergencyPhone"));
    maskCpf(byId("cpf"));
    maskCep(byId("cep"));
    bindEvents();
    const signatureApi = setupSignatureCanvas();

    const draft = restoreDraft();
    if (draft) {
      applyDraft(draft, signatureApi);
      showToast("Rascunho restaurado automaticamente.");
    }

    fetch("/api/anamnese/" + encodeURIComponent(code), { method: "GET" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json || json.success !== true || !json.data || !json.data.lead) throw new Error("Código inválido");
        applyLeadPrefill(json.data.lead);
        showState("stateForm");
        setStep(step);
        byId("submitBtn").disabled = submitLockedByTerms;
      })
      .catch(function () {
        showState("stateInvalid");
      });
  }

  d.addEventListener("DOMContentLoaded", init);
})(window, document);
