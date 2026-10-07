const CONFIG = {
  apiBase: "",
  landingToken: ""
};

const MOCK_UNITS = [
  { id: 1, name: "Avenida Norte", city: "Recife", state: "PE", group: 3, tier: "standard" },
  { id: 2, name: "Peixinhos", city: "Olinda", state: "PE", group: 3, tier: "standard" },
  { id: 3, name: "Água Fria", city: "Recife", state: "PE", group: 2, tier: "exclusive" },
  { id: 4, name: "Ouro Preto", city: "Olinda", state: "PE", group: 3, tier: "standard" }
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
  plansByUnit: null,
  planSource: "mock",
  touched: new Set(),
  submitting: false
};

const form = document.getElementById("incidentForm");
const submitButton = document.getElementById("submitButton");
const toastContainer = document.getElementById("toastContainer");
const descriptionCounter = document.getElementById("descriptionCounter");
const unitSelect = document.getElementById("unit_id");
const planSelect = document.getElementById("plan_id");

const fields = FIELD_NAMES.reduce((acc, name) => {
  acc[name] = form.elements.namedItem(name);
  return acc;
}, {});

const stripNonDigits = (value) => String(value || "").replace(/\D+/g, "");
const trim = (value) => String(value == null ? "" : value).trim();

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
const getErrorElement = (fieldName) => document.getElementById(`${fieldName}Error`);

const setFieldError = (fieldName, message = "") => {
  const field = fields[fieldName];
  const wrapper = getFieldWrapper(fieldName);
  const errorElement = getErrorElement(fieldName);
  const hasError = Boolean(message);

  if (!field || !wrapper || !errorElement) {
    return;
  }

  wrapper.classList.toggle("has-error", hasError);
  wrapper.classList.toggle(
    "is-valid",
    !hasError && state.touched.has(fieldName) && fieldName !== "unit_id" && fieldName !== "plan_id" && fieldName !== "description"
  );
  field.setAttribute("aria-invalid", String(hasError));
  errorElement.textContent = message;
};

const getValidationMessage = (fieldName) => {
  const value = trim(fields[fieldName].value);

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

const money = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const normalizeRemoteUnits = (units) => {
  if (!Array.isArray(units)) {
    return [];
  }

  return units.map((unit) => {
    const numericId = Number(unit?.dbId ?? unit?.id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return null;
    }

    return {
      id: numericId,
      slug: trim(unit.id),
      name: trim(unit.name) || `Unidade ${numericId}`,
      city: trim(unit.city),
      state: trim(unit.state),
      group: unit.group != null ? Number(unit.group) : null,
      tier: trim(unit.tier).toLowerCase()
    };
  }).filter(Boolean);
};

const normalizePlanRows = (rows) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => {
    const numericId = Number(row?.id);
    if (!Number.isFinite(numericId) || numericId <= 0 || row.status === false) {
      return null;
    }

    return {
      id: numericId,
      group: row.group != null ? Number(row.group) : null,
      groupLabel: trim(row.groupLabel).toLowerCase(),
      recurring: row.recurring === true,
      name: trim(row.name || row.planName || row.plan || row.key) || (row.recurring === true ? "Basic+" : "Anual VIP"),
      priceText: typeof row.priceFrom === "string" && trim(row.priceFrom)
        ? trim(row.priceFrom)
        : money(row.priceFrom)
    };
  }).filter(Boolean);
};

const getCatalogConfig = () => {
  if (window.CDC?.data?.landingCatalog) {
    return window.CDC.data.landingCatalog();
  }

  if (window.CDC?.data?.get) {
    const config = window.CDC.data.get();
    return {
      meta: config?.meta || {},
      units: Array.isArray(config?.units) ? config.units : [],
      plans: Array.isArray(config?.planRows) ? config.planRows : [],
      plansByUnit: config?.plans?.byUnit || null
    };
  }

  return { meta: {}, units: [], plans: [], plansByUnit: null };
};

const fetchCatalogConfig = async () => {
  if (window.CDC?.data?.fetchLandingCatalog) {
    return window.CDC.data.fetchLandingCatalog();
  }
  return getCatalogConfig();
};

const planRowsForUnit = (unit) => {
  if (!unit) {
    return state.plans;
  }

  const grouped = state.plans.filter((plan) => {
    if (unit.tier && plan.groupLabel) {
      return plan.groupLabel === unit.tier;
    }
    if (unit.group != null && plan.group != null) {
      return Number(unit.group) === Number(plan.group);
    }
    return true;
  });

  return grouped.length ? grouped : state.plans;
};

const normalizePlansByUnit = (plansByUnit) => {
  if (!plansByUnit || typeof plansByUnit !== "object") {
    return null;
  }

  const normalized = {};

  Object.keys(plansByUnit).forEach((unitSlug) => {
    const entry = plansByUnit[unitSlug];
    const items = Array.isArray(entry?.items) ? entry.items : [];
    if (!items.length) {
      return;
    }

    normalized[unitSlug] = items.map((item, index) => ({
      id: Number.isFinite(Number(item?.id)) ? Number(item.id) : null,
      key: trim(item?.key) || `plan-${index + 1}`,
      name: trim(item?.name) || `Plano ${index + 1}`,
      priceText: trim(item?.price),
      recurring: item?.key === "basic"
    }));
  });

  return Object.keys(normalized).length ? normalized : null;
};

const plansByUnitFor = (unit) => {
  if (!state.plansByUnit) {
    return [];
  }

  if (unit?.slug && Array.isArray(state.plansByUnit[unit.slug])) {
    return state.plansByUnit[unit.slug];
  }

  if (!unit) {
    const firstUnitKey = Object.keys(state.plansByUnit)[0];
    return firstUnitKey ? state.plansByUnit[firstUnitKey] : [];
  }

  return [];
};

const getSelectedUnit = () => state.units.find((unit) => String(unit.id) === String(unitSelect.value)) || null;

const renderUnitOptions = (units) => {
  const currentValue = unitSelect.value;
  const options = ['<option value="">Selecione uma unidade</option>']
    .concat(units.map((unit) => `<option value="${unit.id}">${escapeHtml(unit.name)}${unit.city ? ` • ${escapeHtml(unit.city)}${unit.state ? `/${escapeHtml(unit.state)}` : ""}` : ""}</option>`));

  unitSelect.innerHTML = options.join("");

  if (units.some((unit) => String(unit.id) === currentValue)) {
    unitSelect.value = currentValue;
  }
};

const renderMockPlanOptions = (selectedUnitId = "") => {
  const normalizedUnitId = selectedUnitId ? Number(selectedUnitId) : null;
  const filteredPlans = normalizedUnitId
    ? state.plans.filter((plan) => plan.unitIds.includes(normalizedUnitId))
    : state.plans;
  const currentValue = planSelect.value;
  const options = ['<option value="">Selecione um plano</option>']
    .concat(filteredPlans.map((plan) => `<option value="${plan.id}">${escapeHtml(plan.name)}</option>`));

  planSelect.innerHTML = options.join("");

  if (filteredPlans.some((plan) => String(plan.id) === currentValue)) {
    planSelect.value = currentValue;
  }
};

const renderRemotePlanOptions = (selectedUnitId = "") => {
  const currentValue = planSelect.value;
  const unit = state.units.find((item) => String(item.id) === String(selectedUnitId)) || null;
  const filteredPlans = state.plans.length ? planRowsForUnit(unit) : plansByUnitFor(unit);
  const options = ['<option value="">Selecione um plano</option>'];

  filteredPlans.forEach((plan) => {
    const suffix = plan.priceText ? ` • ${escapeHtml(plan.priceText)}` : "";
    const optionValue = plan.id != null ? String(plan.id) : `key:${plan.key || "plan"}`;
    options.push(`<option value="${optionValue}" data-plan-key="${escapeHtml(plan.key || "")}">${escapeHtml(plan.name)}${suffix}</option>`);
  });

  planSelect.innerHTML = options.join("");

  if (filteredPlans.some((plan) => (plan.id != null ? String(plan.id) : `key:${plan.key || "plan"}`) === currentValue)) {
    planSelect.value = currentValue;
  }
};

const renderPlanOptions = (selectedUnitId = "") => {
  if (state.planSource === "remote") {
    renderRemotePlanOptions(selectedUnitId);
    return;
  }

  renderMockPlanOptions(selectedUnitId);
};

const applyCatalog = (catalog) => {
  const remoteUnits = normalizeRemoteUnits(catalog.units);
  const remotePlans = normalizePlanRows(catalog.plans);
  const remotePlansByUnit = normalizePlansByUnit(catalog.plansByUnit);

  state.units = remoteUnits.length ? remoteUnits : MOCK_UNITS.slice();
  state.plans = remoteUnits.length && remotePlans.length ? remotePlans : MOCK_PLANS.slice();
  state.plansByUnit = remoteUnits.length && remotePlansByUnit ? remotePlansByUnit : null;
  state.planSource = remoteUnits.length && (remotePlans.length || remotePlansByUnit) ? "remote" : "mock";

  renderUnitOptions(state.units);
  renderPlanOptions(unitSelect.value);
};

const loadCatalogFromCurrentConfig = () => {
  applyCatalog(getCatalogConfig());
};

const loadCatalog = async () => {
  try {
    applyCatalog(await fetchCatalogConfig());
  } catch (error) {
    loadCatalogFromCurrentConfig();
  }
};

const buildPayload = () => {
  const email = trim(fields.email.value);
  const description = trim(fields.description.value);
  const planId = fields.plan_id.value ? Number(fields.plan_id.value) : null;
  const unitId = fields.unit_id.value ? Number(fields.unit_id.value) : null;

  return {
    type: fields.type.value,
    name: trim(fields.name.value),
    phone: stripNonDigits(fields.phone.value),
    cpf: stripNonDigits(fields.cpf.value),
    email: email || null,
    plan_id: Number.isFinite(planId) ? planId : null,
    unit_id: Number.isFinite(unitId) ? unitId : null,
    description: description || null
  };
};

const getRuntimeMeta = () => getCatalogConfig().meta || {};

const getApiBase = () => trim(CONFIG.apiBase) || trim(getRuntimeMeta().apiBase);
const getLandingToken = () => trim(CONFIG.landingToken) || trim(getRuntimeMeta().landingToken);

const getEndpoint = () => `${getApiBase().replace(/\/+$/, "")}/landing/register-customer-service-incident`;

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
  const body = document.createElement("div");
  const heading = document.createElement("strong");
  const copy = document.createElement("p");
  const close = document.createElement("button");
  const resolvedTitle = title || (type === "success" ? "Solicitação enviada" : type === "error" ? "Não foi possível enviar" : "Aviso");

  toast.className = `cs-toast cs-toast--${type}`;
  toast.insertAdjacentHTML("beforeend", createToastIcon(type));
  heading.textContent = resolvedTitle;
  copy.textContent = message;
  body.appendChild(heading);
  body.appendChild(copy);

  close.className = "cs-toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Fechar notificação");
  close.textContent = "×";

  const removeToast = () => toast.remove();
  close.addEventListener("click", removeToast);

  toast.appendChild(body);
  toast.appendChild(close);
  toastContainer.appendChild(toast);
  window.setTimeout(removeToast, 5000);
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
  renderPlanOptions();
  renderDescriptionCounter();
};

const submitIncident = async (payload) => {
  const apiBase = getApiBase();
  const landingToken = getLandingToken();

  if (!apiBase || !landingToken) {
    throw new Error("CONFIG_INCOMPLETO");
  }

  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: {
      "X-Landing-Token": landingToken,
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
      showToast("Configure apiBase e landingToken no bloco CONFIG ou publique esses dados no config remoto antes de usar a página.", "error", "Configuração pendente");
      return;
    }

    if (error.status === 422) {
      applyApiErrors(extractApiErrors(error.responseBody));
      showToast(
        error.responseBody?.message || "Alguns dados precisam de correção. Revise os campos e tente novamente.",
        "error",
        "Dados inválidos"
      );
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
  renderPlanOptions(unitSelect.value);

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
  await loadCatalog();

  form.addEventListener("submit", handleSubmit);
  form.addEventListener("input", handleFieldInput);
  form.addEventListener("blur", handleFieldBlur, true);
  form.addEventListener("change", handleFieldBlur, true);
  unitSelect.addEventListener("change", handleUnitChange);
  window.addEventListener("cdc:config-updated", loadCatalogFromCurrentConfig);
};

init();
