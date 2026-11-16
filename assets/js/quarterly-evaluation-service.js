(function (root) {
  "use strict";

  const ENDPOINT = new URL("/landing/register-satisfaction-survey", root.location.origin).toString();
  const STUDENT_FIELDS = [
    "name",
    "unit",
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
    "name",
    "unit",
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

  function buildPayload(profile, answers) {
    const fields = profile === "Aluno"
      ? STUDENT_FIELDS
      : profile === "Funcionário"
        ? EMPLOYEE_FIELDS
        : null;

    if (!fields) {
      throw new TypeError("Perfil inválido para avaliação trimestral.");
    }

    const payload = { type: profile };
    fields.forEach((field) => {
      const value = answers[field];
      payload[field] = typeof value === "string" ? value.trim() : (value ?? "");
    });
    return payload;
  }

  async function submit(profile, answers, timeoutMs = 15000) {
    if (!root.AbortController) {
      throw new Error("Seu navegador não oferece suporte ao envio seguro da avaliação.");
    }

    const controller = new root.AbortController();
    const timeoutId = root.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await root.fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(buildPayload(profile, answers)),
        signal: controller.signal
      });

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok) {
        throw new EvaluationApiError(
          responseBody?.message || `A API respondeu com HTTP ${response.status}.`,
          response.status,
          responseBody
        );
      }

      return responseBody;
    } catch (error) {
      if (error instanceof EvaluationApiError) {
        throw error;
      }
      if (controller.signal.aborted) {
        const timeoutError = new Error("A conexão demorou mais que o esperado.");
        timeoutError.name = "TimeoutError";
        throw timeoutError;
      }
      throw new Error("Não foi possível conectar ao serviço de avaliação.");
    } finally {
      root.clearTimeout(timeoutId);
    }
  }

  root.CiaQuarterlyEvaluationService = {
    endpoint: ENDPOINT,
    buildPayload,
    submit
  };
})(window);
