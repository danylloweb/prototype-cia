const config = require('./config');
const { eventLogger, logger } = require('./logger');
const browserManager = require('./browser');
const { parseProfile } = require('./parser/profile-parser');
const bronze = require('./storage/bronze');
const silver = require('./storage/silver');
const fs = require('fs').promises;
const path = require('path');

async function fetchProfile(student, index = 1, total = 1, retryCount = 0) {
  const context = browserManager.getContext();
  const page = await context.newPage();

  try {
    eventLogger.profileStart(student.student_id);
    logger.info(`[${index}/${total}] 🔍 Acessando perfil do aluno: ${student.name || ''} (ID: ${student.student_id})`);

    await page.goto(`${config.sca.baseUrl}/perfil?c=${student.student_id}`, {
      waitUntil: 'domcontentloaded',
      timeout: config.crawler.requestTimeoutMs,
    });

    // Aguardar elemento principal do perfil ou pequeno delay para scripts renderizarem
    await page.locator('[rel="nome-completo"], #c_lblCod, #c_panObs, .elemento').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(config.crawler.requestDelayMs || 500);

    // Abre a aba de Matrículas para capturar os planos/matrículas do aluno
    // (feito antes de abrir o formulário de edição, que pode alterar o estado da página)
    try {
      await page.hover('#c_btnEdi');
      await page.hover('#c_abaMat');
      await page.click('#c_abaMat');
      // O clique dispara um postback assíncrono (UpdatePanel); aguarda a tabela ser injetada no DOM
      await page.locator('a[id*="_rptMat_"]').first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
      await page.hover('#c_tro_lnkUnidade');
      await page.hover('#c_btnMat');
      await page.waitForTimeout(config.crawler.requestDelayMs || 500);
    } catch (err) {
      logger.warn(`[${index}/${total}] ⚠️ Não foi possível abrir aba de Matrículas para ID ${student.student_id}: ${err.message}`);
    }

    // Abre o formulário de edição de cadastro para capturar dados adicionais (dados pessoais e endereço)
    try {
      await page.hover('#c_btnAce');
      await page.hover('#c_btnEdi');
      await page.hover('#c_btnAuxEdiCad');
      await page.click('.ico.tf-6.t-br.pos-rel.il-lapis');
      await page.hover('text=Informações');
      await page.click('text=Informações');
      await page.hover('text=Endereço');
      await page.click('img');
      await page.hover('text=Contatos');
      await page.waitForTimeout(config.crawler.requestDelayMs || 500);
    } catch (err) {
      logger.warn(`[${index}/${total}] ⚠️ Não foi possível abrir formulário de edição para ID ${student.student_id}: ${err.message}`);
    }

    const html = await page.content();
    const parsed = parseProfile(html);
    const extractedAt = new Date().toISOString();

    const payload = {
      source: 'sistemasca',
      student_id: student.student_id,
      profile_url: `/perfil?c=${student.student_id}`,
      name: parsed.name || student.name || null,
      extracted_at: extractedAt,
      ...parsed,
    };

    await bronze.saveHtml({ kind: 'profiles', studentId: student.student_id, html });
    await silver.saveJson({ kind: 'profiles', studentId: student.student_id, data: payload });

    eventLogger.profileSuccess(student.student_id, payload.name);
    logger.info(`[${index}/${total}] ✅ Aluno extraído: ${payload.name || student.student_id}`);

    return payload;
  } catch (error) {
    if (retryCount < config.crawler.maxRetries) {
      logger.warn(`[${index}/${total}] ⚠️ Erro ao extrair perfil ID ${student.student_id}. Tentando novamente (${retryCount + 1}/${config.crawler.maxRetries})...`);
      await page.close().catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
      return fetchProfile(student, index, total, retryCount + 1);
    }

    eventLogger.profileError(student.student_id, error);
    logger.error({ studentId: student.student_id, error: error.message }, `[${index}/${total}] ❌ Falha ao extrair perfil`);

    return {
      source: 'sistemasca',
      student_id: student.student_id,
      profile_url: `/perfil?c=${student.student_id}`,
      name: student.name || null,
      extracted_at: new Date().toISOString(),
      status: 'failed',
      error: error.message,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function extractAllProfiles(studentsList, concurrency = 3) {
  const total = studentsList.length;
  logger.info(`🚀 Iniciando extração de ${total} perfis com concorrência = ${concurrency}`);

  const results = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < total) {
      const idx = currentIndex++;
      const student = studentsList[idx];
      const res = await fetchProfile(student, idx + 1, total);
      results.push(res);

      // Salva progresso parcial a cada 5 alunos
      if (results.length % 5 === 0 || results.length === total) {
        const output = {
          metadata: {
            extracted_at: new Date().toISOString(),
            total,
            processed: results.filter((r) => r.status !== 'failed').length,
            failed: results.filter((r) => r.status === 'failed').length,
          },
          students: results,
        };

        await fs.mkdir(path.join(config.storage.dataDir), { recursive: true });
        await fs.writeFile(
          path.join(config.storage.dataDir, 'output.json'),
          JSON.stringify(output, null, 2)
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  logger.info(`🎉 Extração de todos os ${total} perfis finalizada!`);
  return results;
}

module.exports = { fetchProfile, extractAllProfiles };
