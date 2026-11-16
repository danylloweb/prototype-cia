const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/js/experience.js", "utf8");

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
}

function element(value = "") {
  const listeners = {};
  const classes = new Set();
  return {
    value,
    dataset: {},
    attributes: {},
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    dispatch(name) { (listeners[name] || []).forEach(callback => callback()); },
    focus() {}
  };
}

function fields(initialPhone = "") {
  const phone = element(initialPhone);
  const name = element("Ana Silva");
  const email = element();
  const button = element();
  const error = { textContent: "" };
  const map = {
    ".quiz-lead-phone": phone, ".quiz-lead-name": name,
    ".quiz-lead-email": email, "#quizGo": button, "#quizPhoneError": error
  };
  return {
    phone, name, email, button, error,
    body: {
      querySelector(selector) {
        return selector === ".quiz-lead .quiz-invalid"
          ? [name, phone, email].find(el => el.classList.contains("quiz-invalid"))
          : map[selector];
      },
      querySelectorAll() { return [name, phone, email]; }
    }
  };
}

test("telefone deve ser válido antes de habilitar e enviar", () => {
  const context = {};
  vm.runInNewContext(extract("  function validLeadPhone", "  function nextDateFor"), context);
  const f = fields();
  context.bindLeadFields(f.body);
  assert.equal(f.button.disabled, true);

  for (const value of ["(55) 81996-7394", "+55 81 99673-9494", "8199", "819999999999"]) {
    f.phone.value = value;
    f.phone.dispatch("input");
    assert.equal(f.button.disabled, true, value);
    assert.match(f.error.textContent, /inválido/);
    assert.equal(context.collectLead(f.body), null);
  }
  f.phone.value = "81996739494";
  f.phone.dispatch("input");
  assert.equal(f.phone.value, "(81) 99673-9494");
  assert.equal(f.button.disabled, false);
  assert.equal(context.collectLead(f.body).phone, "81996739494");
  assert.equal(f.error.textContent, "");
  f.phone.value = "8133334444";
  f.phone.dispatch("input");
  assert.equal(f.button.disabled, false);
  assert.equal(context.collectLead(f.body).phone, "8133334444");
  f.button.dataset.submitting = "true";
  f.phone.dispatch("change");
  assert.equal(f.button.disabled, true);
  f.button.dataset.submitting = "false";
  f.phone.value = "";
  f.phone.dispatch("input");
  assert.equal(f.button.disabled, true);
});

test("telefone preenchido antes da abertura do quiz também é validado", () => {
  const context = {};
  vm.runInNewContext(extract("  function validLeadPhone", "  function nextDateFor"), context);
  const f = fields("+55 81 99673-9494");
  context.bindLeadFields(f.body);
  assert.equal(f.phone.value, "+55 81 99673-9494");
  assert.equal(f.button.disabled, true);
  assert.match(f.error.textContent, /inválido/);
});

test("ambos os resultados usam o mesmo envio e endpoint", async () => {
  const calls = [];
  let closed = 0;
  const context = {
    localStorage: { getItem() { return null; }, setItem() {} },
    DATA: { get() { return { meta: { apiBase: "https://example.test/", landingToken: "token" } }; } },
    T: null,
    w: { fetch: true },
    fetch(url, options) {
      calls.push({ url, options });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: false, data: { url: "/anamnese" } }) });
    },
    showLeadLoading() { return { close() { closed++; } }; },
    showLeadSuccess(url) { assert.equal(url, "/anamnese"); },
    console
  };
  vm.runInNewContext(extract("  function submitLead", "  function openQuiz"), context);
  const info = { name: "Ana", phone: "81996739494", date: "2026-11-13", time: "08:00" };
  assert.equal(await context.submitLead(info), true);
  assert.equal(calls[0].url, "https://example.test/landing/register-trial");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(JSON.parse(calls[0].options.body).phone, info.phone);
  assert.equal(closed, 1);
  assert.equal((source.match(/sendTrial\(body, \{/g) || []).length, 2);
});

test("falhas da API não são tratadas como agendamento concluído", async () => {
  let closed = 0;
  const context = {
    localStorage: { getItem() { return null; }, setItem() {} },
    DATA: { get() { return { meta: { apiBase: "https://example.test", landingToken: "token" } }; } },
    T: null,
    w: { fetch: true },
    fetch() { return Promise.resolve({ ok: false, status: 500 }); },
    showLeadLoading() { return { close() { closed++; } }; },
    showLeadSuccess() { assert.fail("não deve mostrar sucesso"); },
    console: { error() {} }
  };
  vm.runInNewContext(extract("  function submitLead", "  function openQuiz"), context);
  assert.equal(await context.submitLead({}), false);
  assert.equal(closed, 1);
  context.DATA.get = () => ({ meta: {} });
  assert.equal(await context.submitLead({}), false);
  assert.equal(closed, 1);
});

test("contato para aula experimental encaminha dados ao quiz", () => {
  const html = fs.readFileSync("contato.html", "utf8");
  const inline = html.match(/<script>\s*(\(function\(\)\{[\s\S]*?\}\)\(\);)\s*<\/script>/);
  assert.ok(inline);
  const listeners = {};
  const unit = { id: "peixinhos", name: "Peixinhos", city: "Olinda" };
  const selector = { value: unit.id, appendChild() {} };
  const reason = { value: "trial", addEventListener(name, fn) { listeners.reason = fn; } };
  const button = {};
  const form = { addEventListener(name, fn) { listeners.submit = fn; } };
  let opts;
  const context = {
    document: {
      getElementById(id) { return { unidade: selector, motivo: reason, contactSubmit: button, contactForm: form }[id]; },
      createElement() { return {}; },
      querySelector() { return null; }
    },
    window: { CDC: {
      data: { activeUnits: () => [unit], unitById: () => unit, defaultUnit: () => unit, get: () => ({ meta: {} }) },
      exp: { openQuiz(value) { opts = value; } }
    } }
  };
  vm.runInNewContext(inline[1], context);
  const target = {
    nome: { value: "Ana" }, sobrenome: { value: "Silva" },
    telefone: { value: "+55 81 99673-9494" }, email: { value: "ana@example.test" },
    motivo: reason, mensagem: { value: "teste" }
  };
  listeners.submit({ preventDefault() {}, target });
  assert.equal(opts.unitId, unit.id);
  assert.equal(opts.lead.name, "Ana Silva");
  assert.equal(opts.lead.phone, target.telefone.value);
  assert.equal(opts.interest, "teste");
  reason.value = "Outro";
  listeners.reason();
  assert.equal(button.textContent, "Enviar pelo WhatsApp");
});
