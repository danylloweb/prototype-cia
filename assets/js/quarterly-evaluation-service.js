(function (root) {
  "use strict";

  const ENDPOINT = "https://portalvendas.academiaciadocorpo.com/register-satisfaction-survey";
  const UNITS = Object.freeze([
    Object.freeze({ name: "Afogados", id: 4 }),
    Object.freeze({ name: "Água Fria", id: 5 }),
    Object.freeze({ name: "Avenida Norte", id: 1 }),
    Object.freeze({ name: "Bomba do Hemetério", id: 6 }),
    Object.freeze({ name: "Ouro Preto", id: 2 }),
    Object.freeze({ name: "Peixinhos", id: 3 }),
    Object.freeze({ name: "Areias", id: 7 }),
    Object.freeze({ name: "Cia Concept Casa Caiada", id: 8 })
  ]);
  const RATING_FIELDS = [
    "rating_reception", "rating_weight_training", "rating_group_classes",
    "rating_muay_thai", "rating_welcome"
  ];
  const NOT_APPLICABLE_RATING_FIELDS = [
    "rating_weight_training", "rating_group_classes", "rating_muay_thai"
  ];
  const STUDENT_FIELDS = [
    "rating_reception",
    "rating_weight_training",
    "rating_group_classes",
    "rating_muay_thai",
    "rating_welcome",
    "employee_who_makes_day_better",
    "recognition_reason",
    "quarterly_highlight",
    "special_mention",
    "final_suggestion"
  ];
  const EMPLOYEE_FIELDS = [
    "employee_role",
    "employee_nomination",
    "nomination_reason",
    "admired_qualities",
    "additional_nomination",
    "colleague_attitude",
    "professional_highlight_attitude",
    "final_suggestion"
  ];

  class EvaluationApiError extends Error {
    constructor(message, status, responseBody) {
      super(message);
      this.name = "EvaluationApiError";
      this.status = status;
      this.responseBody = responseBody;
    }
  }

  function timeoutError() {
    const error = new Error("A conexão demorou mais que o esperado.");
    error.name = "TimeoutError";
    return error;
  }

  function buildPayload(profile, answers) {
    const fields = profile === "Aluno"
      ? STUDENT_FIELDS
      : profile === "Funcionário"
        ? EMPLOYEE_FIELDS
        : null;

    if (!fields) {
      throw new TypeError("Perfil inválido para avaliação trimestral.");
    }

    const unit = UNITS.find((item) => item.name === answers.unit);
    if (!unit) {
      throw new TypeError("Selecione uma unidade válida para a avaliação.");
    }

    const name = typeof answers.name === "string" ? answers.name.trim() : "";
    if (!name && profile !== "Aluno") {
      throw new TypeError("Informe seu nome para enviar a avaliação.");
    }

    const payload = {
      type: profile === "Aluno" ? "aluno" : "funcionario",
      name: name || "Aluno anônimo",
      unit_id: unit.id
    };
    fields.forEach((field) => {
      const value = answers[field];
      if (value == null || value === "") return;
      if (NOT_APPLICABLE_RATING_FIELDS.includes(field) && value === "not_applicable") return;
      if (RATING_FIELDS.includes(field)) {
        if (!Number.isInteger(value) || value < 1 || value > 5) {
          throw new TypeError("As notas devem ser números inteiros de 1 a 5.");
        }
        payload[field] = value;
      } else if (typeof value === "string") {
        const text = value.trim();
        if (text) payload[field] = text;
      } else {
        throw new TypeError("Resposta inválida para avaliação trimestral.");
      }
    });
    return payload;
  }

  async function submit(profile, answers, timeoutMs = 15000) {
    if (!root.AbortController) {
      throw new Error("Seu navegador não oferece suporte ao envio seguro da avaliação.");
    }

    const payload = buildPayload(profile, answers);
    const controller = new root.AbortController();
    const timeoutId = root.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const dataService = root.CDC?.data;
      let token = dataService?.get()?.meta?.landingToken;
      if ((!token || typeof token !== "string" || !token.trim()) && dataService?.refreshRemote) {
        await Promise.race([
          dataService.refreshRemote(),
          new Promise((_, reject) => {
            controller.signal.addEventListener("abort", () => {
              reject(timeoutError());
            }, { once: true });
          })
        ]);
        token = dataService.get()?.meta?.landingToken;
      }
      if (typeof token !== "string" || !token.trim()) {
        const error = new Error("O serviço de avaliação está indisponível. Tente novamente em instantes.");
        error.name = "ConfigurationError";
        throw error;
      }

      let response;
      try {
        response = await root.fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Landing-Token": token.trim()
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw timeoutError();
        }
        throw new Error("Não foi possível conectar ao serviço de avaliação.");
      }

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch {
        if (controller.signal.aborted) throw timeoutError();
        responseBody = null;
      }

      if (!response.ok) {
        throw new EvaluationApiError(
          responseBody?.message || `A API respondeu com HTTP ${response.status}.`,
          response.status,
          responseBody
        );
      }

      if (!responseBody || responseBody.success !== true) {
        throw new EvaluationApiError(
          "Não foi possível confirmar o registro da avaliação.",
          response.status,
          responseBody
        );
      }
      return responseBody;
    } finally {
      root.clearTimeout(timeoutId);
    }
  }

  root.CiaQuarterlyEvaluationService = {
    endpoint: ENDPOINT,
    units: UNITS,
    buildPayload,
    submit
  };
})(window);
