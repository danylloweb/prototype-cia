const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const serviceSource = fs.readFileSync("assets/js/quarterly-evaluation-service.js", "utf8");
const dataSource = fs.readFileSync("assets/js/data-service.js", "utf8");
const pageSource = fs.readFileSync("avaliacao-trimestral.html", "utf8");
const appSource = fs.readFileSync("assets/js/quarterly-evaluation.js", "utf8");
const cssSource = fs.readFileSync("assets/css/quarterly-evaluation.css", "utf8");
const sharedCssSource = fs.readFileSync("assets/css/styles.css", "utf8");

function createService(fetch, data = { get: () => ({ meta: { landingToken: "test-token" } }) }) {
  const window = {
    CDC: { data },
    fetch: fetch || (() => Promise.resolve({ ok: true, status: 201, json: async () => ({ success: true }) })),
    AbortController, setTimeout, clearTimeout
  };
  vm.runInNewContext(serviceSource, { window });
  return window.CiaQuarterlyEvaluationService;
}

const student = {
  name: " Ana Silva ", unit: "Afogados",
  rating_reception: 5, rating_weight_training: 4, rating_group_classes: 3,
  rating_muay_thai: 5, rating_welcome: 4,
  employee_who_makes_day_better: "Joana", recognition_reason: "Acolhe todos",
  quarterly_highlight: "Joana", special_mention: "Pedro", final_suggestion: "Obrigada"
};
const employee = {
  name: "Carlos Lima", unit: "Água Fria", employee_role: "Gestão",
  employee_nomination: "Ana", nomination_reason: "Colaboração", admired_qualities: "Empatia",
  additional_nomination: "Maria", colleague_attitude: "Apoio ao time",
  professional_highlight_attitude: "Cuidar das pessoas", final_suggestion: "Parabéns"
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("payload de aluno corresponde ao contrato e não inclui campos de funcionário ou data", () => {
  const payload = createService().buildPayload("Aluno", { ...student, employee_role: "Gestão", quarter: 2, year: 2026 });
  assert.deepEqual(plain(payload), {
    type: "aluno", name: "Ana Silva", unit_id: 4,
    rating_reception: 5, rating_weight_training: 4, rating_group_classes: 3,
    rating_muay_thai: 5, rating_welcome: 4,
    employee_who_makes_day_better: "Joana", recognition_reason: "Acolhe todos",
    quarterly_highlight: "Joana", special_mention: "Pedro", final_suggestion: "Obrigada"
  });
});

test("payload de funcionário inclui sugestão final e somente campos do perfil", () => {
  const payload = createService().buildPayload("Funcionário", { ...employee, rating_reception: 5, quarter: 1 });
  assert.deepEqual(plain(payload), {
    type: "funcionario", name: "Carlos Lima", unit_id: 5, employee_role: "Gestão",
    employee_nomination: "Ana", nomination_reason: "Colaboração", admired_qualities: "Empatia",
    additional_nomination: "Maria", colleague_attitude: "Apoio ao time",
    professional_highlight_attitude: "Cuidar das pessoas", final_suggestion: "Parabéns"
  });
});

test("todas as unidades usam os IDs informados, inclusive Casa Caiada", () => {
  const service = createService();
  const expected = {
    "Avenida Norte": 1, "Ouro Preto": 2, Peixinhos: 3, Afogados: 4,
    "Água Fria": 5, "Bomba do Hemetério": 6, Areias: 7, "Cia Concept Casa Caiada": 8
  };
  assert.equal(service.units.length, 8);
  for (const [unit, id] of Object.entries(expected)) {
    assert.equal(service.buildPayload("Aluno", { unit }).unit_id, id);
    assert.equal(service.buildPayload("Funcionário", { unit, name: "Carlos" }).unit_id, id);
  }
});

test("aluno sem nome é anônimo; campos opcionais vazios são omitidos", () => {
  const payload = createService().buildPayload("Aluno", { unit: "Areias", name: "  ", final_suggestion: "  " });
  assert.deepEqual(plain(payload), { type: "aluno", name: "Aluno anônimo", unit_id: 7 });
});

test("respostas não aplicáveis omitem as notas de atividades que o aluno não pratica", () => {
  const payload = createService().buildPayload("Aluno", {
    unit: "Areias",
    rating_weight_training: "not_applicable",
    rating_group_classes: "not_applicable",
    rating_muay_thai: "not_applicable"
  });
  assert.deepEqual(plain(payload), { type: "aluno", name: "Aluno anônimo", unit_id: 7 });
  assert.throws(() => createService().buildPayload("Aluno", {
    unit: "Areias", rating_reception: "not_applicable"
  }), /notas/);
});

test("sugestão final só é enviada quando a resposta é Sim e contém justificativa", () => {
  const service = createService();
  assert.deepEqual(plain(service.buildPayload("Aluno", {
    unit: "Areias", final_suggestion_choice: "no"
  })), { type: "aluno", name: "Aluno anônimo", unit_id: 7 });
  assert.equal(service.buildPayload("Aluno", {
    unit: "Areias", final_suggestion_choice: "yes", final_suggestion: "Atendimento cordial"
  }).final_suggestion, "Atendimento cordial");
});

test("perfil, unidade, nome de funcionário e notas inválidos são rejeitados", () => {
  const service = createService();
  assert.throws(() => service.buildPayload("outro", student), /Perfil inválido/);
  assert.throws(() => service.buildPayload("Aluno", { unit: "Desconhecida" }), /unidade válida/);
  assert.throws(() => service.buildPayload("Funcionário", { unit: "Areias", name: " " }), /nome/);
  for (const rating of [0, 6, 1.5, "5"]) {
    assert.throws(() => service.buildPayload("Aluno", { unit: "Areias", rating_reception: rating }), /notas/);
  }
});

for (const [profile, answers, type] of [["Aluno", student, "aluno"], ["Funcionário", employee, "funcionario"]]) {
  test(`envia ${profile} ao endpoint com token e confirmação 201`, async () => {
    let request;
    const service = createService((url, options) => {
      request = { url, options };
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ success: true, data: { id: 123 } }) });
    });
    const result = await service.submit(profile, answers);
    assert.equal(result.data.id, 123);
    assert.equal(request.url, "https://portalvendas.academiaciadocorpo.com/register-satisfaction-survey");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["Content-Type"], "application/json");
    assert.equal(request.options.headers.Accept, "application/json");
    assert.equal(request.options.headers["X-Landing-Token"], "test-token");
    assert.equal(JSON.parse(request.options.body).type, type);
  });
}

for (const status of [401, 422, 429, 500, 503]) {
  test(`HTTP ${status} mantém erro e resposta da API`, async () => {
    const service = createService(() => Promise.resolve({
      ok: false, status, json: async () => ({ message: `Erro ${status}`, errors: ["inválido"] })
    }));
    await assert.rejects(service.submit("Aluno", student), (error) => {
      assert.equal(error.status, status);
      assert.equal(error.message, `Erro ${status}`);
      assert.equal(error.responseBody.errors[0], "inválido");
      return true;
    });
  });
}

test("resposta 2xx sem confirmação explícita não é sucesso", async () => {
  for (const body of [{ success: false }, {}, null]) {
    const service = createService(() => Promise.resolve({ ok: true, status: 201, json: async () => body }));
    await assert.rejects(service.submit("Aluno", student), /confirmar/);
  }
  const malformed = createService(() => Promise.resolve({ ok: true, status: 201, json: async () => { throw new Error("JSON"); } }));
  await assert.rejects(malformed.submit("Aluno", student), /confirmar/);
});

test("configuração ausente tenta atualizar e impede POST sem token", async () => {
  let posts = 0;
  let refreshes = 0;
  const data = { get: () => ({ meta: {} }), refreshRemote: async () => { refreshes++; } };
  const service = createService(() => { posts++; }, data);
  await assert.rejects(service.submit("Aluno", student), { name: "ConfigurationError" });
  assert.equal(refreshes, 1);
  assert.equal(posts, 0);
});

test("configuração recebida após atualização permite nova tentativa", async () => {
  let token = "";
  let refreshes = 0;
  const data = {
    get: () => ({ meta: { landingToken: token } }),
    refreshRemote: async () => { if (++refreshes === 2) token = "new-token"; }
  };
  let sentToken;
  const service = createService((_url, options) => {
    sentToken = options.headers["X-Landing-Token"];
    return Promise.resolve({ ok: true, status: 201, json: async () => ({ success: true }) });
  }, data);
  await assert.rejects(service.submit("Aluno", student), { name: "ConfigurationError" });
  await service.submit("Aluno", student);
  assert.equal(sentToken, "new-token");
});

test("erro de payload não é mascarado como falha de conexão", async () => {
  const service = createService(() => { throw new Error("não deveria enviar"); });
  await assert.rejects(service.submit("Aluno", { unit: "inválida" }), /unidade válida/);
});

test("timeout e falha de rede preservam respostas para nova tentativa", async () => {
  const answers = { ...student };
  const service = createService((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  await assert.rejects(service.submit("Aluno", answers, 2), { name: "TimeoutError" });
  assert.deepEqual(answers, student);
  const networkError = createService(() => Promise.reject(new Error("offline")));
  await assert.rejects(networkError.submit("Aluno", answers), /conectar/);
});

test("timeout também se aplica à atualização da configuração", async () => {
  const data = { get: () => ({ meta: {} }), refreshRemote: () => new Promise(() => {}) };
  const service = createService(() => { throw new Error("não deveria enviar"); }, data);
  await assert.rejects(service.submit("Aluno", student, 2), { name: "TimeoutError" });
});

test("timeout durante leitura da resposta não é confundido com JSON inválido", async () => {
  const service = createService((_url, { signal }) => Promise.resolve({
    ok: true, status: 201,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    })
  }));
  await assert.rejects(service.submit("Aluno", student, 2), { name: "TimeoutError" });
});

for (const profile of ["Aluno", "Funcionário"]) {
  test(`formulário de ${profile} conserva respostas após erro e só confirma após sucesso`, async () => {
    const elements = {};
    for (const id of ["survey-form", "step-content", "progress-count", "progress-track", "progress-fill",
      "next-button", "back-button", "required-note", "form-message", "form-view", "success-view"]) {
      elements[id] = {
        hidden: id === "success-view", disabled: false, style: {}, innerHTML: "", textContent: "",
        handlers: {}, classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {}, removeAttribute() {}, focus() {}, querySelector: () => null,
        querySelectorAll: () => [], addEventListener(type, handler) { this.handlers[type] = handler; }
      };
    }
    const submissions = [];
    const service = {
      units: createService().units,
      submit: async (selected, answers) => {
        submissions.push({ selected, answers: { ...answers } });
        if (submissions.length === 1) throw Object.assign(new Error("Erro"), { status: 500 });
        return { success: true };
      }
    };
    const window = { CiaQuarterlyEvaluationService: service, scrollTo() {} };
    const document = { getElementById: (id) => elements[id] };
    vm.runInNewContext(appSource, { window, document });
    const content = elements["step-content"];
    const clickOption = (kind, dataset) => {
      const button = { dataset };
      content.handlers.click({ target: { closest: (selector) => selector === `.${kind}` ? button : null } });
    };
    const input = (field, value) => content.handlers.input({
      target: { dataset: { field }, value, matches: (selector) => selector === "input" || selector === "textarea" }
    });
    const next = () => elements["next-button"].handlers.click();

    clickOption("profile-option", { profile });
    next();
    input("name", "Nome teste");
    next();
    assert.match(content.innerHTML, /Cia Concept Casa Caiada/);
    clickOption("answer-option", { field: "unit", value: "Cia Concept Casa Caiada" });
    next();

    const fields = profile === "Aluno"
      ? ["rating_reception", "rating_weight_training", "rating_group_classes", "rating_muay_thai",
        "rating_welcome", "employee_who_makes_day_better", "recognition_reason",
        "quarterly_highlight", "special_mention", "final_suggestion"]
      : ["employee_role", "employee_nomination", "nomination_reason", "admired_qualities",
        "additional_nomination", "colleague_attitude", "professional_highlight_attitude", "final_suggestion"];
    const notApplicableFields = ["rating_weight_training", "rating_group_classes", "rating_muay_thai"];
    for (const field of fields) {
      if (field === "final_suggestion") {
        next();
        assert.match(elements["form-message"].textContent, /Sim ou Não/);
        if (profile === "Aluno") {
          clickOption("conditional-choice", { value: "yes" });
          assert.match(content.innerHTML, /textarea[^>]*required/);
          next();
          assert.match(elements["form-message"].textContent, /Preencha sua resposta/);
          input(field, "Resposta final_suggestion");
        } else {
          clickOption("conditional-choice", { value: "no" });
          assert.doesNotMatch(content.innerHTML, /textarea[^>]*data-field="final_suggestion"/);
        }
        next();
        continue;
      }
      if (field.startsWith("rating_")) {
        assert.equal(content.innerHTML.includes("Não faço / não utilizo"), notApplicableFields.includes(field));
      }
      if (field === "rating_group_classes") clickOption("rating-na-button", { field });
      else if (field.startsWith("rating_")) clickOption("star-button", { field, rating: "5" });
      else if (field === "employee_role") clickOption("answer-option", { field, value: "Gestão" });
      else input(field, `Resposta ${field}`);
      next();
    }
    await new Promise(setImmediate);
    assert.equal(elements["success-view"].hidden, true);
    assert.equal(elements["form-view"].hidden, false);
    assert.match(elements["form-message"].textContent, /indisponível/);
    if (profile === "Aluno") {
      assert.match(content.innerHTML, /Resposta final_suggestion/);
    } else {
      assert.doesNotMatch(content.innerHTML, /textarea[^>]*data-field="final_suggestion"/);
    }
    assert.equal(elements["back-button"].disabled, false);
    next();
    await new Promise(setImmediate);
    assert.equal(elements["success-view"].hidden, false);
    assert.equal(elements["form-view"].hidden, true);
    assert.deepEqual(submissions[0], submissions[1]);
    assert.equal(submissions[0].answers.unit, "Cia Concept Casa Caiada");
    if (profile === "Aluno") {
      assert.equal(submissions[0].answers.rating_group_classes, "not_applicable");
      assert.equal(submissions[0].answers.final_suggestion_choice, "yes");
      assert.equal(submissions[0].answers.final_suggestion, "Resposta final_suggestion");
    } else {
      assert.equal(submissions[0].answers.final_suggestion_choice, "no");
      assert.equal("final_suggestion" in submissions[0].answers, false);
    }
  });
}

test("configuração inicial da pesquisa atualiza sem recarregar e perder respostas", async () => {
  const storage = new Map();
  let reloads = 0;
  let updated = 0;
  const localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  const sessionStorage = { getItem: () => null, setItem: () => {} };
  const window = {
    CDC_DEFAULT_CONFIG: {},
    location: { pathname: "/avaliacao-trimestral", reload: () => { reloads++; } },
    fetch: async () => ({ ok: true, json: async () => ({ bundle: { meta: { landingToken: "token" } } }) }),
    dispatchEvent: () => { updated++; }
  };
  const document = { currentScript: { getAttribute: () => "false" } };
  const context = { window, document, localStorage, sessionStorage, fetch: window.fetch, CustomEvent: class {} };
  vm.runInNewContext(dataSource, context);
  await window.CDC.data.refreshRemote();
  assert.equal(window.CDC.data.get().meta.landingToken, "token");
  assert.equal(reloads, 0);
  assert.ok(updated > 0);
});

test("outras páginas mantêm recarga da configuração na primeira visita", async () => {
  const storage = new Map();
  let reloads = 0;
  const localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  const sessionStorage = { getItem: () => null, setItem: () => {} };
  const window = {
    CDC_DEFAULT_CONFIG: {},
    location: { pathname: "/", reload: () => { reloads++; } },
    fetch: async () => ({ ok: true, json: async () => ({ bundle: { meta: { version: 1 } } }) }),
    dispatchEvent() {}
  };
  const document = { currentScript: { getAttribute: () => null } };
  vm.runInNewContext(dataSource, { window, document, localStorage, sessionStorage, fetch: window.fetch, CustomEvent: class {} });
  await window.CDC.data.refreshRemote();
  assert.equal(reloads, 1);
});

test("página preserva campanha, acessibilidade, etapas e carregamento ordenado", () => {
  const expectedFields = [
    "name", "unit", "rating_reception", "rating_weight_training", "rating_group_classes",
    "rating_muay_thai", "rating_welcome", "employee_who_makes_day_better", "recognition_reason",
    "quarterly_highlight", "special_mention", "final_suggestion", "employee_role",
    "employee_nomination", "nomination_reason", "admired_qualities", "additional_nomination",
    "colleague_attitude", "professional_highlight_attitude"
  ];
  assert.match(pageSource, /Destaques do Trimestre/);
  assert.match(pageSource, /Quem cuida, merece ser cuidado!/);
  expectedFields.forEach((field) => assert.match(appSource, new RegExp(`field: "${field}"`)));
  assert.match(pageSource, /skip-link/);
  assert.match(appSource, /studentSteps/);
  assert.match(appSource, /employeeSteps/);
  assert.match(appSource, /aria-checked/);
  assert.match(pageSource, /data-reload-on-first-load="false"/);
  assert.ok(pageSource.indexOf("config.js") < pageSource.indexOf("data-service.js"));
  assert.ok(pageSource.indexOf("data-service.js") < pageSource.indexOf("quarterly-evaluation-service.js"));
  assert.ok(pageSource.indexOf("quarterly-evaluation-service.js") < pageSource.indexOf("quarterly-evaluation.js"));
  assert.doesNotMatch(pageSource + appSource + serviceSource, /script\.google\.com|no-cors|google\.com\/macros/i);
  assert.match(cssSource, /@media \(max-width: 560px\)/);
  assert.match(pageSource, /assets\/css\/styles\.css/);
  assert.match(pageSource, /assets\/css\/anamnese\.css/);
  assert.match(pageSource, /Archivo/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(sharedCssSource, /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/);
});
