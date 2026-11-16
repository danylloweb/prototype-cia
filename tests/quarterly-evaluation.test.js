const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const serviceSource = fs.readFileSync("assets/js/quarterly-evaluation-service.js", "utf8");
const pageSource = fs.readFileSync("avaliacao-trimestral.html", "utf8");
const appSource = fs.readFileSync("assets/js/quarterly-evaluation.js", "utf8");
const cssSource = fs.readFileSync("assets/css/quarterly-evaluation.css", "utf8");
const sharedCssSource = fs.readFileSync("assets/css/styles.css", "utf8");
const legacyPageSource = fs.readFileSync("atendimento-cliente/cia-funcionariotrimestre.netlify.app/index.html", "utf8");

function createService(fetch) {
  const window = {
    location: { origin: "https://www.academiaciadocorpo.com" },
    fetch: fetch || (() => Promise.resolve({ ok: true, status: 201, json: async () => ({}) })),
    AbortController,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(serviceSource, { window, URL });
  return window.CiaQuarterlyEvaluationService;
}

test("payload de aluno contém somente as propriedades do fluxo aluno", () => {
  const service = createService();
  const payload = service.buildPayload("Aluno", {
    name: " Ana Silva ",
    unit: "Afogados",
    rating_reception: 5,
    rating_weight_training: 4,
    rating_group_classes: 3,
    rating_muay_thai: 5,
    rating_welcome: 4,
    employee_who_makes_day_better: "Joana",
    recognition_reason: "Acolhe todos",
    quarterly_highlight: "Joana",
    special_mention: "Pedro",
    final_suggestion: ""
  });

  assert.deepEqual(Object.keys(payload), [
    "type", "name", "unit", "rating_reception", "rating_weight_training",
    "rating_group_classes", "rating_muay_thai", "rating_welcome",
    "employee_who_makes_day_better", "recognition_reason",
    "quarterly_highlight", "special_mention", "final_suggestion"
  ]);
  assert.equal(payload.type, "Aluno");
  assert.equal(payload.name, "Ana Silva");
  assert.equal("employee_role" in payload, false);
  assert.equal("employee_nomination" in payload, false);
});

test("payload de funcionário contém somente as propriedades do fluxo funcionário", () => {
  const service = createService();
  const payload = service.buildPayload("Funcionário", {
    name: "Carlos Lima",
    unit: "Água Fria",
    employee_role: "Gestão",
    employee_nomination: "Ana",
    nomination_reason: "Colaboração",
    admired_qualities: "Empatia",
    additional_nomination: "",
    colleague_attitude: "Apoio ao time",
    professional_highlight_attitude: "Cuidar das pessoas",
    final_suggestion: "Parabéns"
  });

  assert.deepEqual(Object.keys(payload), [
    "type", "name", "unit", "employee_role", "employee_nomination",
    "nomination_reason", "admired_qualities", "additional_nomination",
    "colleague_attitude", "professional_highlight_attitude", "final_suggestion"
  ]);
  assert.equal(payload.type, "Funcionário");
  assert.equal("rating_reception" in payload, false);
  assert.equal("quarterly_highlight" in payload, false);
});

test("envia JSON ao endpoint confirmado e aceita confirmação HTTP 201", async () => {
  let request;
  const service = createService((url, options) => {
    request = { url, options };
    return Promise.resolve({ ok: true, status: 201, json: async () => ({ message: "Created" }) });
  });

  const result = await service.submit("Aluno", { name: "Ana" });
  assert.equal(result.message, "Created");
  assert.equal(request.url, "https://www.academiaciadocorpo.com/landing/register-satisfaction-survey");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.equal(request.options.headers.Accept, "application/json");
  assert.equal(JSON.parse(request.options.body).type, "Aluno");
});

for (const status of [422, 429, 500, 503]) {
  test(`HTTP ${status} é erro e não pode ser tratado como sucesso`, async () => {
    const service = createService(() => Promise.resolve({
      ok: false,
      status,
      json: async () => ({ message: `Erro ${status}` })
    }));

    await assert.rejects(service.submit("Aluno", {}), (error) => {
      assert.equal(error.status, status);
      assert.equal(error.message, `Erro ${status}`);
      return true;
    });
  });
}

test("timeout e falha de conexão permitem tentativa posterior sem alterar respostas", async () => {
  const service = createService((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const answers = { name: "Ana", unit: "Areias" };

  await assert.rejects(service.submit("Aluno", answers, 2), { name: "TimeoutError" });
  assert.deepEqual(answers, { name: "Ana", unit: "Areias" });

  const networkError = createService(() => Promise.reject(new Error("offline")));
  await assert.rejects(networkError.submit("Funcionário", answers), /conectar/);
});

test("página preserva campanha, acessibilidade, etapas e não usa integração Google", () => {
  const expectedFields = [
    "name", "unit", "rating_reception", "rating_weight_training",
    "rating_group_classes", "rating_muay_thai", "rating_welcome",
    "employee_who_makes_day_better", "recognition_reason",
    "quarterly_highlight", "special_mention", "final_suggestion",
    "employee_role", "employee_nomination", "nomination_reason",
    "admired_qualities", "additional_nomination", "colleague_attitude",
    "professional_highlight_attitude"
  ];

  assert.match(pageSource, /Destaques do Trimestre/);
  assert.match(pageSource, /Quem cuida, merece ser cuidado!/);
  assert.match(pageSource, /banner\.png/);
  assert.ok(fs.existsSync("atendimento-cliente/cia-funcionariotrimestre.netlify.app/banner.png"));
  expectedFields.forEach((field) => assert.match(appSource, new RegExp(`field: "${field}"`)));
  assert.match(pageSource, /skip-link/);
  assert.match(appSource, /studentSteps/);
  assert.match(appSource, /employeeSteps/);
  assert.match(appSource, /aria-checked/);
  assert.doesNotMatch(pageSource + appSource + serviceSource + legacyPageSource, /script\.google\.com|no-cors|google\.com\/macros/i);
  assert.match(legacyPageSource, /\/avaliacao-trimestral\.html/);
  assert.match(cssSource, /@media \(max-width: 560px\)/);
  assert.match(pageSource, /assets\/css\/styles\.css/);
  assert.match(pageSource, /assets\/css\/anamnese\.css/);
  assert.match(pageSource, /Archivo/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(sharedCssSource, /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/);
});
