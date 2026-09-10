const cheerio = require('cheerio');

const BLOCK_MAP = {
  c_lblBloMen: 'membership_payment_overdue',
  c_lblBloSer: 'service_payment_overdue',
  c_lblBloVen: 'sales_payment_overdue',
  c_lblBloAva: 'evaluation_payment_overdue',
  c_lblBloTre: 'training_payment_overdue',
  c_lblBloDoc: 'document_payment_overdue',
  c_lblBloMan: 'maintenance_payment_overdue',
  c_lblBloMat: 'enrollment_payment_overdue',
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isVisibleElement($, el) {
  let current = $(el);
  while (current && current.length) {
    const style = normalizeText(current.attr('style')).toLowerCase();
    const classes = normalizeText(current.attr('class')).toLowerCase();
    if (
      style.includes('display:none') ||
      style.includes('visibility:hidden') ||
      classes.includes('inv') ||
      classes.includes('hidden') ||
      classes.includes('oculto') ||
      classes.includes('esconde')
    ) {
      return false;
    }
    current = current.parent();
    if (!current || !current.length || current[0].type === 'root') break;
  }
  return true;
}

function collectPanelText($, selector) {
  const panel = $(selector).first();
  if (!panel.length || !isVisibleElement($, panel)) return [];
  return normalizeText(panel.text())
    .split(/\n|•|·|\|/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function collectRelationships($) {
  const panel = $('#c_panRel').first();
  if (!panel.length || !isVisibleElement($, panel)) return [];

  const items = [];
  panel.find('a, .ite, li, tr').each((_, el) => {
    const item = $(el);
    const text = normalizeText(item.text());
    const href = item.attr('href') || '';
    if (!text) return;

    const studentMatch = href.match(/[?&]c=(\d+)/);
    items.push({
      name: text || null,
      type: null,
      student_id: studentMatch ? studentMatch[1] : null,
      profile_url: href && href !== '#' ? href : null,
    });
  });

  if (items.length) return items;

  const raw = normalizeText(panel.text());
  return raw ? [{ name: raw, type: null, student_id: null, profile_url: null }] : [];
}

function collectContacts($) {
  const panel = $('#c_panCon').first();
  if (!panel.length || !isVisibleElement($, panel)) return [];

  const items = [];
  panel.find('a, .ite, li, tr').each((_, el) => {
    const item = $(el);
    const text = normalizeText(item.text());
    if (!text) return;

    const phoneMatch = text.match(/(\(?\d{2}\)?\s?\d{4,5}-\d{4})/);
    const name = phoneMatch ? normalizeText(text.replace(phoneMatch[1], '')) : text;
    items.push({
      name: name || null,
      phone: phoneMatch ? phoneMatch[1] : null,
    });
  });

  if (items.length) return items;

  const raw = normalizeText(panel.text());
  return raw ? [{ name: raw, phone: null }] : [];
}

function selectedOptionText($, selectEl) {
  const selected = selectEl.find('option[selected]');
  return selected.length ? normalizeText(selected.first().text()) || null : null;
}

function collectPersonalInfo($) {
  const fullNameEl = $('#alu_txtNome');
  if (!fullNameEl.length) return null;

  const tags = $('#alu_cboTags option[selected]')
    .map((_, el) => normalizeText($(el).text()))
    .get()
    .filter(Boolean);

  return {
    full_name: normalizeText(fullNameEl.attr('value')) || null,
    first_name: normalizeText($('#alu_txtApelido').attr('value')) || null,
    login_email: normalizeText($('#alu_txtLogin').attr('value')) || null,
    gender: selectedOptionText($, $('#alu_cboSexo')),
    cpf: normalizeText($('#alu_txtDocumento').attr('value')) || null,
    rg: normalizeText($('#alu_txtIdentidade').attr('value')) || null,
    birth_date: normalizeText($('#alu_txtNascimento').attr('value')) || null,
    marital_status: selectedOptionText($, $('#alu_cboEstadoCivil')),
    phone_1: normalizeText($('#alu_txtTelefone1').attr('value')) || null,
    phone_2: normalizeText($('#alu_txtTelefone2').attr('value')) || null,
    profession: normalizeText($('#alu_txtProfissao').attr('value')) || null,
    company: normalizeText($('#alu_txtEmpresa').attr('value')) || null,
    tags,
  };
}

function collectAddressInfo($) {
  const cepEl = $('#alu_txtCep');
  if (!cepEl.length) return null;

  return {
    zip_code: normalizeText(cepEl.attr('value')) || null,
    street: normalizeText($('#alu_txtEndereco').attr('value')) || null,
    number: normalizeText($('#alu_txtNumero').attr('value')) || null,
    complement: normalizeText($('#alu_txtComplemento').attr('value')) || null,
    neighborhood: normalizeText($('#alu_txtBairro').attr('value')) || null,
    city: normalizeText($('#alu_txtCidade').attr('value')) || null,
    state: selectedOptionText($, $('#alu_cboEstado')),
  };
}

function collectMemberships($) {
  const memberships = [];
  $('a[id*="_rptMat_"][id$="_lEd"]').each((_, el) => {
    const link = $(el);
    const row = link.closest('tr');
    if (!row.length) return;

    const cells = row.find('> td');
    const planCell = cells.eq(0);
    const dateCell = cells.eq(2);
    const dueDayText = normalizeText(dateCell.find('span').eq(1).text());
    const dueDayMatch = dueDayText.match(/dia\s*(\d+)/i);
    const statusEl = row.find('.botao.estatico').first();

    memberships.push({
      plan_name: normalizeText(link.text()) || null,
      modality: normalizeText(planCell.find('span').first().text()) || null,
      unit: normalizeText(cells.eq(1).text()) || null,
      enrollment_date: normalizeText(dateCell.find('span').first().text()) || null,
      due_day: dueDayMatch ? Number(dueDayMatch[1]) : null,
      periodicity: normalizeText(cells.eq(3).text()) || null,
      value: normalizeText(cells.eq(5).text()) || null,
      status: statusEl.length ? normalizeText(statusEl.attr('tt')) || null : null,
    });
  });
  return memberships;
}

function collectBlockReasons($) {
  const reasons = [];
  Object.entries(BLOCK_MAP).forEach(([id, reason]) => {
    const el = $(`#${id}`).first();
    if (el.length && isVisibleElement($, el)) {
      reasons.push(reason);
    }
  });
  return Array.from(new Set(reasons));
}

function parseProfile(html) {
  const $ = cheerio.load(html);

  const name = normalizeText($('[rel="nome-completo"]').first().text()) || null;

  const registrationText = normalizeText(
    $('#c_lblCod, #c_lblMat, #c_lblMatricula, [id*="lblCod"], [id*="lblMat"]').first().text()
  );
  const registrationMatch = registrationText.match(/#?(\d+)/);
  const registration_number = registrationMatch ? registrationMatch[1] : null;

  const emailEl = $('#c_lnkEmailErro, #c_lnkEmail, a[href^="mailto:"]').first();
  const email = normalizeText(emailEl.text() || emailEl.attr('href') || '') || null;

  const phone = normalizeText($('#c_lnkCelular, #c_lnkTel, a[href^="tel:"]').first().text()) || null;
  const photo_url =
    $('img[src*="/arquivos/fotos/"], img[alt*="Foto"], img[alt*="foto"]').first().attr('src') ||
    null;

  const ageText = normalizeText(
    $('#c_lblIdade, [id*="lblIdade"], [rel*="idade"]').first().text() ||
    $('body').text().match(/\b\d+\s*anos\b/i)?.[0] ||
    ''
  );
  const ageMatch = ageText.match(/(\d+)\s*anos/i);
  const age = ageMatch ? Number(ageMatch[1]) : null;

  const observations = collectPanelText($, '#c_panObs, #c_panObsCon, #c_panObs *').filter(Boolean);
  const contacts = collectContacts($);
  const relationships = collectRelationships($);
  const memberships = collectMemberships($);

  const blockReasons = collectBlockReasons($);
  const access_blocked = blockReasons.length > 0;

  const email_confirmed = email ? !String(emailEl.attr('id') || '').toLowerCase().includes('erro') : null;
  const personalInfo = collectPersonalInfo($);
  const addressInfo = collectAddressInfo($);
  return {
    name,
    registration_number,
    email,
    email_confirmed,
    phone,
    photo_url,
    age,
    access_blocked,
    block_reasons: blockReasons,
    observations,
    contacts,
    relationships,
    memberships,
    ...personalInfo,
    ...addressInfo,
  };
}

module.exports = { parseProfile };
