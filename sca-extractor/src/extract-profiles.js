const config = require('./config');
const { logger } = require('./logger');
const browserManager = require('./browser');
const auth = require('./auth');
const profile = require('./profile');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  let page = null;

  try {
    const listPath = path.join(config.storage.dataDir, 'students-list-temp.json');
    let studentsList = [];

    try {
      const fileData = await fs.readFile(listPath, 'utf-8');
      studentsList = JSON.parse(fileData);
    } catch (err) {
      logger.error(`Não foi possível carregar ${listPath}. Certifique-se de que a lista de alunos foi extraída primeiro.`);
      process.exit(1);
    }

    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      logger.warn('A lista de alunos está vazia. Execute o extrator de lista primeiro.');
      process.exit(0);
    }

    logger.info(`📋 ${studentsList.length} alunos encontrados em ${listPath}`);

    // Inicializar navegador e login
    await browserManager.initialize();
    page = await auth.login();

    if (!(await auth.validateSession(page))) {
      throw new Error('Sessão não autenticada após login manual');
    }

    // Fechar a página de login/dashboard para economizar memória antes dos perfis
    await page.close().catch(() => {});

    // Executar extração com concorrência configurada
    const concurrency = config.crawler.concurrency || 3;
    await profile.extractAllProfiles(studentsList, concurrency);

    await browserManager.close().catch(() => {});
    logger.info('✅ Todos os perfis foram extraídos com sucesso e salvos no Bronze e Silver!');
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Erro fatal na extração de perfis');
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
    await browserManager.close().catch(() => {});
    process.exit(1);
  }
}

main();
