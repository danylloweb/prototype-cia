(function () {
  "use strict";

  const units = window.CiaQuarterlyEvaluationService.units.map((unit) => unit.name);
  const roles = [
    "ASG",
    "Gestão",
    "Professor de Ginástica",
    "Professor de Musculação",
    "Estagiário Ginástica",
    "Estagiário Musculação",
    "Estagiário Recepção",
    "Recepção",
    "Muay Thai",
    "Outro"
  ];
  const studentSteps = [
    { field: "name", label: "Qual seu nome?", type: "text", optional: true },
    { field: "unit", label: "Qual unidade você treina?", type: "options", options: units },
    { field: "rating_reception", label: "Como você avalia o atendimento da recepção?", type: "stars", section: "Avaliação geral da equipe" },
    { field: "rating_weight_training", label: "Como você avalia os professores de musculação?", type: "stars" },
    { field: "rating_group_classes", label: "Como você avalia os professores de ginástica?", type: "stars" },
    { field: "rating_muay_thai", label: "Como você avalia os professores de Muay Thai?", type: "stars" },
    { field: "rating_welcome", label: "Você se sente acolhido(a) e respeitado(a) pelos funcionários da Cia?", type: "stars" },
    { field: "employee_who_makes_day_better", label: "Tem algum(a) funcionário(a) que faz seu dia melhor quando você chega na academia? Quem é?", type: "textarea", section: "Reconhecimento" },
    { field: "recognition_reason", label: "Por que essa pessoa merece reconhecimento?", type: "textarea" },
    { field: "quarterly_highlight", label: "Se pudesse escolher o destaque do Trimestre, quem seria?", type: "textarea" },
    { field: "special_mention", label: "Existe outro profissional que merece uma menção especial? Quem e por quê?", type: "textarea" },
    { field: "final_suggestion", label: "Deseja deixar um elogio, crítica ou sugestão final?", type: "textarea", optional: true, section: "Vamos finalizar" }
  ];
  const employeeSteps = [
    { field: "name", label: "Qual seu nome completo?", type: "text" },
    { field: "unit", label: "Qual unidade você trabalha?", type: "options", options: units },
    { field: "employee_role", label: "Qual sua função?", type: "options", options: roles },
    { field: "employee_nomination", label: "Quem você indicaria como Funcionário(a) do Trimestre?", type: "textarea", optional: true, section: "Reconhecimento" },
    { field: "nomination_reason", label: "Por que essa pessoa merece ser reconhecida?", type: "textarea", optional: true },
    { field: "admired_qualities", label: "Quais qualidades você mais admira nela?", type: "textarea", optional: true },
    { field: "additional_nomination", label: "Tem mais alguém que você gostaria de destacar? Quem e por quê?", type: "textarea", optional: true },
    { field: "colleague_attitude", label: "Teve alguma atitude de colega que merece ser valorizada? Qual?", type: "textarea", optional: true, section: "Destaques do time" },
    { field: "professional_highlight_attitude", label: "Que atitude, para você, faz um profissional se destacar na Cia do Corpo?", type: "textarea" },
    { field: "final_suggestion", label: "Deseja deixar um elogio, crítica ou sugestão final?", type: "textarea", optional: true, section: "Vamos finalizar" }
  ];

  const form = document.getElementById("survey-form");
  const stepContent = document.getElementById("step-content");
  const progressCount = document.getElementById("progress-count");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const nextButton = document.getElementById("next-button");
  const backButton = document.getElementById("back-button");
  const message = document.getElementById("form-message");
  const formView = document.getElementById("form-view");
  const successView = document.getElementById("success-view");

  const state = {
    profile: "",
    answers: {
      Aluno: {},
      "Funcionário": {}
    },
    stepIndex: 0,
    submitting: false
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function currentSteps() {
    return state.profile === "Aluno" ? studentSteps : employeeSteps;
  }

  function answers() {
    return state.profile ? state.answers[state.profile] : {};
  }

  function getCurrentStep() {
    return state.stepIndex === 0 ? null : currentSteps()[state.stepIndex - 1];
  }

  function valueFor(field) {
    return answers()[field] ?? "";
  }

  function labelMarkup(step) {
    const required = !step.optional;
    const tag = step.type === "text" || step.type === "textarea" ? "label" : "p";
    const target = tag === "label" ? ` for="answer-${step.field}"` : "";
    return `<${tag} class="question-label" id="label-${step.field}"${target}>
      ${escapeHtml(step.label)}
      ${required ? '<span class="required-mark" aria-label="obrigatório">*</span>' : '<span class="field-note">(opcional)</span>'}
    </${tag}>`;
  }

  function renderProfileStep() {
    const selected = state.profile;
    stepContent.innerHTML = `
      <h2 class="section-title">Vamos começar</h2>
      <p class="question-label" id="profile-label">Você é... <span class="required-mark" aria-label="obrigatório">*</span></p>
      <div class="option-list" role="group" aria-labelledby="profile-label">
        <button class="option-button profile-option" type="button" data-profile="Aluno" aria-pressed="${selected === "Aluno"}">🏋️ Aluno</button>
        <button class="option-button profile-option" type="button" data-profile="Funcionário" aria-pressed="${selected === "Funcionário"}">👥 Funcionário</button>
      </div>`;
  }

  function renderOptions(step) {
    const selected = valueFor(step.field);
    return `<div class="option-list" role="group" aria-labelledby="label-${step.field}">
      ${step.options.map((option) => `
        <button class="option-button answer-option" type="button" data-field="${step.field}" data-value="${escapeHtml(option)}" aria-pressed="${selected === option}">${escapeHtml(option)}</button>
      `).join("")}
    </div>`;
  }

  function renderStars(step) {
    const selected = Number(valueFor(step.field));
    return `<div class="star-rating" role="radiogroup" aria-labelledby="label-${step.field}">
      ${[1, 2, 3, 4, 5].map((rating) => `
        <button class="star-button${rating <= selected ? " is-active" : ""}" type="button" role="radio" data-rating="${rating}" data-field="${step.field}" aria-checked="${selected === rating}" aria-label="${rating} ${rating === 1 ? "estrela" : "estrelas"}">${rating <= selected ? "★" : "☆"}</button>
      `).join("")}
    </div>
    <p class="star-hint">Selecione de 1 a 5 estrelas</p>`;
  }

  function renderField(step) {
    const value = escapeHtml(valueFor(step.field));
    if (step.type === "options") return renderOptions(step);
    if (step.type === "stars") return renderStars(step);
    if (step.type === "textarea") {
      return `<textarea class="textarea-field" id="answer-${step.field}" data-field="${step.field}" ${step.optional ? "" : "required"} placeholder="${step.optional ? "Opcional..." : "Escreva aqui..."}">${value}</textarea>`;
    }
    return `<input class="text-field" id="answer-${step.field}" data-field="${step.field}" type="text" value="${value}" ${step.optional ? "" : "required"} placeholder="${step.optional ? "Seu nome (opcional)" : "Seu nome completo"}" autocomplete="name">`;
  }

  function renderStep() {
    if (state.stepIndex === 0) {
      renderProfileStep();
    } else {
      const step = getCurrentStep();
      stepContent.innerHTML = `
        ${step.section ? `<h2 class="section-title">${escapeHtml(step.section)}</h2>` : ""}
        ${labelMarkup(step)}
        ${renderField(step)}`;
    }

    const total = state.profile ? currentSteps().length + 1 : 1;
    const current = Math.min(state.stepIndex + 1, total);
    progressCount.textContent = state.profile ? `Etapa ${current} de ${total}` : "Escolha seu perfil";
    progressTrack.setAttribute("aria-valuemin", state.profile ? "1" : "0");
    progressTrack.setAttribute("aria-valuemax", String(total));
    progressTrack.setAttribute("aria-valuenow", state.profile ? String(current) : "0");
    progressFill.style.width = state.profile ? `${Math.round((current / total) * 100)}%` : "0%";
    backButton.hidden = state.stepIndex === 0;
    nextButton.textContent = state.profile && state.stepIndex === total - 1 ? "Enviar 🧡" : "Próxima →";
    nextButton.disabled = state.stepIndex === 0 && !state.profile;
    message.hidden = true;
    message.textContent = "";
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  function validateCurrentStep() {
    if (state.stepIndex === 0) {
      if (!state.profile) {
        showMessage("Selecione se você é aluno ou funcionário para continuar.");
        return false;
      }
      return true;
    }

    const step = getCurrentStep();
    const value = valueFor(step.field);
    if (!step.optional && (value === "" || (typeof value === "string" && !value.trim()))) {
      showMessage("Preencha este campo antes de avançar.");
      const focusTarget = stepContent.querySelector(`[data-field="${step.field}"]`);
      focusTarget?.focus();
      return false;
    }
    return true;
  }

  function selectProfile(profile) {
    if (state.profile !== profile) {
      state.answers = { Aluno: {}, "Funcionário": {} };
      state.profile = profile;
      state.stepIndex = 0;
    }
    renderStep();
  }

  function selectOption(button) {
    const field = button.dataset.field;
    answers()[field] = button.dataset.value;
    stepContent.querySelectorAll(".answer-option").forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
    message.hidden = true;
  }

  function selectRating(button) {
    const field = button.dataset.field;
    answers()[field] = Number(button.dataset.rating);
    stepContent.querySelectorAll(".star-button").forEach((star) => {
      const active = Number(star.dataset.rating) <= answers()[field];
      star.classList.toggle("is-active", active);
      star.textContent = active ? "★" : "☆";
      star.setAttribute("aria-checked", String(star === button));
    });
    message.hidden = true;
  }

  function friendlyError(error) {
    if (error.name === "ConfigurationError" || error instanceof TypeError) {
      return error.message;
    }
    if (error.name === "TimeoutError") {
      return "A conexão demorou mais que o esperado. Suas respostas continuam salvas; tente enviar novamente.";
    }
    if (error.status === 422) {
      return typeof error.responseBody?.message === "string"
        ? error.responseBody.message
        : "Algumas respostas precisam ser revistas. Confira os campos e tente novamente.";
    }
    if (error.status === 429) {
      return "Recebemos muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.";
    }
    if (error.status === 401 || error.status === 403) {
      return "O serviço de avaliação está indisponível. Suas respostas continuam preenchidas; tente novamente em instantes.";
    }
    if (error.status >= 500) {
      return "O serviço está temporariamente indisponível. Suas respostas continuam preenchidas; tente novamente em instantes.";
    }
    return "Não foi possível enviar suas respostas. Verifique sua conexão e tente novamente.";
  }

  async function submitForm() {
    if (state.submitting || !validateCurrentStep()) return;

    state.submitting = true;
    let submitError = "";
    nextButton.disabled = true;
    backButton.disabled = true;
    stepContent.querySelectorAll("input, textarea, button").forEach((field) => {
      field.disabled = true;
    });
    nextButton.classList.add("is-loading");
    nextButton.textContent = "Enviando...";
    nextButton.setAttribute("aria-busy", "true");

    try {
      await window.CiaQuarterlyEvaluationService.submit(state.profile, answers());
      formView.hidden = true;
      successView.hidden = false;
      successView.focus();
    } catch (error) {
      submitError = friendlyError(error);
    } finally {
      state.submitting = false;
      backButton.disabled = false;
      nextButton.classList.remove("is-loading");
      nextButton.removeAttribute("aria-busy");
      if (!successView.hidden) return;
      renderStep();
      nextButton.disabled = false;
      if (submitError) showMessage(submitError);
    }
  }

  stepContent.addEventListener("click", (event) => {
    if (state.submitting) return;
    const profileButton = event.target.closest(".profile-option");
    const optionButton = event.target.closest(".answer-option");
    const starButton = event.target.closest(".star-button");
    if (profileButton) selectProfile(profileButton.dataset.profile);
    if (optionButton) selectOption(optionButton);
    if (starButton) selectRating(starButton);
  });

  stepContent.addEventListener("input", (event) => {
    if (state.submitting) return;
    const field = event.target.dataset.field;
    if (field && (event.target.matches("input") || event.target.matches("textarea"))) {
      answers()[field] = event.target.value;
      message.hidden = true;
    }
  });

  function advanceStep() {
    if (!validateCurrentStep()) return;
    if (state.profile && state.stepIndex === currentSteps().length) {
      submitForm();
      return;
    }
    state.stepIndex += 1;
    renderStep();
    window.scrollTo({ top: 0, behavior: "smooth" });
    stepContent.querySelector("input, textarea, .option-button, .star-button")?.focus();
  }

  nextButton.addEventListener("click", advanceStep);

  backButton.addEventListener("click", () => {
    if (state.submitting) return;
    if (state.stepIndex > 0) {
      state.stepIndex -= 1;
      renderStep();
      window.scrollTo({ top: 0, behavior: "smooth" });
      stepContent.querySelector("input, textarea, .option-button, .star-button")?.focus();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    advanceStep();
  });

  renderStep();
})();
