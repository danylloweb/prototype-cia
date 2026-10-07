const CONFIG = {
  apiBase: "",
  landingToken: ""
};

const MOCK_UNITS = [
  { id: 1, name: "Avenida Norte", city: "Recife", state: "PE" },
  { id: 2, name: "Peixinhos", city: "Olinda", state: "PE" },
  { id: 3, name: "Água Fria", city: "Recife", state: "PE" },
  { id: 4, name: "Ouro Preto", city: "Olinda", state: "PE" }
];

const MOCK_PLANS = [
  { id: 1, name: "Plano Fit", unitIds: [1, 2, 3, 4] },
  { id: 2, name: "Plano Premium", unitIds: [1, 3] },
  { id: 3, name: "Plano Família", unitIds: [2, 4] },
  { id: 4, name: "Plano Flex", unitIds: [1, 2, 3, 4] }
];

const FIELD_NAMES = ["type", "name", "phone", "cpf", "email", "unit_id", "plan_id", "description"];

const state = {
  units: [],
  plans: [],
  touched: new Set(),
  submitting: false
};

const form = document.querySelector("#incidentForm");
const submitButton = document.querySelector("#submitButton");
const toastContainer = document.querySelector("#toastContainer");
const descriptionCounter = document.querySelector("#descriptionCounter");
const unitSelect = document.querySelector("#unit_id");
const planSelect = document.querySelector("#plan_id");

const fields = FIELD_NAMES.reduce((acc, name) => {
  acc[name] = form.elements.namedItem(name);
  return acc;
}, {});

const stripNonDigits = (value) => value.replace(/\D+/g, "");

const maskPhone = (value) => {
  const digits = stripNonDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const maskCpf = (value) => {
  const digits = stripNonDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidCpf = (value) => {
  const cpf = stripNonDigits(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcCheckDigit = (base, factor) => {
    const total = base.split("").reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const result = 11 - (total % 11);
    return result > 9 ? 0 : result;
  };

  const firstDigit = calcCheckDigit(cpf.slice(0, 9), 10);
  const secondDigit = calcCheckDigit(cpf.slice(0, 10), 11);

  return firstDigit === Number(cpf[9]) && secondDigit === Number(cpf[10]);
};

const setButtonLoading = (isLoading) => {
  state.submitting = isLoading;
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  submitButton.setAttribute("aria-busy", String(isLoading));
};

const getFieldWrapper = (fieldName) => fields[fieldName]?.closest(".cs-field");

const getErrorElement = (fieldName) => document.querySelector(`#${CSS.escape(fieldName)}Error`);

const setFieldError = (fieldName, message = "") => {
  const field = fields[fieldName];
  const wrapper = getFieldWrapper(fieldName);
  const errorElement = getErrorElement(fieldName);
  const hasError = Boolean(message);

  if (!field || !wrapper || !errorElement) {
    return;
  }

  wrapper.classList.toggle("has-error", hasError);
  wrapper.classList.toggle("is-valid", !hasError && state.touched.has(fieldName) && fieldName !== "unit_id" && fieldName !== "plan_id" && fieldName !== "description");
  field.setAttribute("aria-invalid", String(hasError));
  errorElement.textContent = message;
};

const getValidationMessage = (fieldName) => {
  const value = fields[fieldName].value.trim();

  switch (fieldName) {
    case "type":
      return value ? "" : "Selecione o tipo de solicitação.";
    case "name":
      if (!value) return "Informe seu nome completo.";
      if (value.length < 3) return "Digite um nome com pelo menos 3 caracteres.";
      return "";
    case "phone": {
      const digits = stripNonDigits(value);
      if (!digits) return "Informe seu telefone com DDD.";
      if (digits.length < 10 || digits.length > 11) return "Digite um telefone válido com 10 ou 11 números.";
      return "";
    }
    case "cpf":
      if (!value) return "Informe seu CPF.";
      if (!isValidCpf(value)) return "Digite um CPF válido.";
      return "";
    case "email":
      if (!value) return "";
      return isValidEmail(value) ? "" : "Digite um e-mail válido ou deixe o campo em branco.";
    case "description":
      return value.length > 1000 ? "A descrição deve ter no máximo 1000 caracteres." : "";
    default:
      return "";
  }
};

const validateField = (fieldName) => {
  const message = getValidationMessage(fieldName);
  setFieldError(fieldName, message);
  return !message;
};

const validateForm = () => {
  let isValid = true;

  FIELD_NAMES.forEach((fieldName) => {
    state.touched.add(fieldName);
    if (!validateField(fieldName)) {
      isValid = false;
    }
  });

  return isValid;
};

const renderDescriptionCounter = () => {
  descriptionCounter.textContent = `${fields.description.value.length}/1000`;
};

const renderUnitOptions = (units) => {
  const options = ['<option value="">Selecione uma unidade</option>']
    .concat(units.map((unit) => `<option value="${unit.id}">${unit.name} • ${unit.city}/${unit.state}</option>`));

  unitSelect.innerHTML = options.join("");
};

const renderPlanOptions = (plans, selectedUnitId = "") => {
  const normalizedUnitId = selectedUnitId ? Number(selectedUnitId) : null;
  const filteredPlans = normalizedUnitId
    ? plans.filter((plan) => plan.unitIds.includes(normalizedUnitId))
    : plans;

  const currentValue = planSelect.value;
  const options = ['<option value="">Selecione um plano</option>']
    .concat(filteredPlans.map((plan) => `<option value="${plan.id}">${plan.name}</option>`));

  planSelect.innerHTML = options.join("");

  if (filteredPlans.some((plan) => String(plan.id) === currentValue)) {
    planSelect.value = currentValue;
  }
};

const loadUnits = async () => MOCK_UNITS;

const loadPlans = async () => MOCK_PLANS;

const buildPayload = () => {
  const email = fields.email.value.trim();
  const description = fields.description.value.trim();
  const planId = fields.plan_id.value ? Number(fields.plan_id.value) : null;
  const unitId = fields.unit_id.value ? Number(fields.unit_id.value) : null;

  return {
    type: fields.type.value,
    name: fields.name.value.trim(),
    phone: stripNonDigits(fields.phone.value),
    cpf: stripNonDigits(fields.cpf.value),
    email: email || null,
    plan_id: Number.isInteger(planId) ? planId : null,
    unit_id: Number.isInteger(unitId) ? unitId : null,
    description: description || null
  };
};

const getEndpoint = () => {
  const apiBase = CONFIG.apiBase.trim().replace(/\/+$/, "");
  return `${apiBase}/landing/register-customer-service-incident`;
};

const extractApiErrors = (responseBody) => {
  if (!responseBody || typeof responseBody !== "object") {
    return {};
  }

  if (responseBody.errors && typeof responseBody.errors === "object") {
    return responseBody.errors;
  }

  if (responseBody.data?.errors && typeof responseBody.data.errors === "object") {
    return responseBody.data.errors;
  }

  return {};
};

const applyApiErrors = (errors) => {
  const fieldAliases = {
    type: "type",
    name: "name",
    phone: "phone",
    cpf: "cpf",
    email: "email",
    unit_id: "unit_id",
    plan_id: "plan_id",
    description: "description",
    unitId: "unit_id",
    planId: "plan_id"
  };

  Object.entries(errors).forEach(([key, value]) => {
    const fieldName = fieldAliases[key];
    if (!fieldName || !fields[fieldName]) {
      return;
    }

    const message = Array.isArray(value) ? value[0] : String(value);
    state.touched.add(fieldName);
    setFieldError(fieldName, message);
  });
};

const createToastIcon = (type) => {
  if (type === "success") {
    return '<svg class="cs-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12.5 10.8 15 16 9.8"/></svg>';
  }

  if (type === "error") {
    return '<svg class="cs-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16h.01"/></svg>';
  }

  return '<svg class="cs-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8h.01M11 12h1v4h1"/></svg>';
};

const showToast = (message, type = "info", title) => {
  const toast = document.createElement("div");
  const resolvedTitle = title || (type === "success" ? "Solicitação enviada" : type === "error" ? "Não foi possível enviar" : "Aviso");

  toast.className = `cs-toast cs-toast--${type}`;
  toast.innerHTML = `
    ${createToastIcon(type)}
    <div>
      <strong>${resolvedTitle}</strong>
      <p>${message}</p>
    </div>
    <button class="cs-toast-close" type="button" aria-label="Fechar notificação">×</button>
  `;

  const close = () => {
    toast.remove();
  };

  toast.querySelector(".cs-toast-close").addEventListener("click", close);
  toastContainer.appendChild(toast);
  window.setTimeout(close, 5000);
};

const resetFormState = () => {
  form.reset();
  state.touched.clear();

  FIELD_NAMES.forEach((fieldName) => {
    setFieldError(fieldName, "");
    const wrapper = getFieldWrapper(fieldName);
    wrapper?.classList.remove("is-valid");
    fields[fieldName].removeAttribute("aria-invalid");
  });

  fields.phone.value = "";
  fields.cpf.value = "";
  renderPlanOptions(state.plans);
  renderDescriptionCounter();
};

const submitIncident = async (payload) => {
  if (!CONFIG.apiBase.trim() || !CONFIG.landingToken.trim()) {
    throw new Error("CONFIG_INCOMPLETO");
  }

  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: {
      "X-Landing-Token": CONFIG.landingToken,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  let responseBody = null;

  try {
    responseBody = await response.json();
  } catch (error) {
    responseBody = null;
  }

  if (!response.ok) {
    const apiError = new Error(responseBody?.message || `HTTP ${response.status}`);
    apiError.status = response.status;
    apiError.responseBody = responseBody;
    throw apiError;
  }

  return responseBody;
};

const handleSubmit = async (event) => {
  event.preventDefault();

  if (state.submitting) {
    return;
  }

  if (!validateForm()) {
    showToast("Revise os campos obrigatórios destacados antes de enviar.", "error", "Campos inválidos");
    return;
  }

  const payload = buildPayload();
  setButtonLoading(true);

  try {
    await submitIncident(payload);
    resetFormState();
    showToast("Solicitação registrada com sucesso. Nossa equipe entrará em contato.", "success");
  } catch (error) {
    if (error.message === "CONFIG_INCOMPLETO") {
      showToast("Configure apiBase e landingToken no bloco CONFIG antes de publicar a página.", "error", "Configuração pendente");
      return;
    }

    if (error.status === 422) {
      const apiErrors = extractApiErrors(error.responseBody);
      applyApiErrors(apiErrors);

      const fallbackMessage = error.responseBody?.message || "Alguns dados precisam de correção. Revise os campos e tente novamente.";
      showToast(fallbackMessage, "error", "Dados inválidos");
      return;
    }

    showToast("Não conseguimos enviar sua solicitação agora. Verifique sua conexão e tente novamente.", "error");
  } finally {
    setButtonLoading(false);
  }
};

const handleFieldInput = (event) => {
  const { name } = event.target;
  if (!FIELD_NAMES.includes(name)) {
    return;
  }

  if (name === "phone") {
    event.target.value = maskPhone(event.target.value);
  }

  if (name === "cpf") {
    event.target.value = maskCpf(event.target.value);
  }

  if (name === "description") {
    renderDescriptionCounter();
  }

  if (state.touched.has(name)) {
    validateField(name);
  }
};

const handleFieldBlur = (event) => {
  const { name } = event.target;
  if (!FIELD_NAMES.includes(name)) {
    return;
  }

  state.touched.add(name);
  validateField(name);
};

const handleUnitChange = () => {
  renderPlanOptions(state.plans, unitSelect.value);

  if (state.touched.has("unit_id")) {
    validateField("unit_id");
  }

  if (state.touched.has("plan_id")) {
    validateField("plan_id");
  }
};

const setCurrentYear = () => {
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
};

const init = async () => {
  setCurrentYear();
  renderDescriptionCounter();

  state.units = await loadUnits();
  state.plans = await loadPlans();

  renderUnitOptions(state.units);
  renderPlanOptions(state.plans);

  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", handleFieldInput);
  form.addEventListener("blur", handleFieldBlur, true);
  form.addEventListener("change", handleFieldBlur, true);
  unitSelect.addEventListener("change", handleUnitChange);
};

init().catch(() => {
  renderUnitOptions([]);
  renderPlanOptions([]);
  showToast("Não foi possível carregar as listas de unidades e planos.", "error", "Falha ao iniciar");
});
