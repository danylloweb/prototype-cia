const { firefox } = require('playwright');
const path = require('path');
const { logger } = require('./logger');

let browser = null;
let context = null;

const browserManager = {
  async initialize() {
    try {
      logger.info('Inicializando navegador...');
      browser = await firefox.launch({
        headless: false,
      });

      context = await browser.newContext();
      logger.info('Contexto do navegador criado');

      return { browser, context };
    } catch (error) {
      logger.error({ error: error.message }, 'Erro ao inicializar navegador');
      throw error;
    }
  },

  async loadStorageState(storageStatePath) {
    try {
      const fs = require('fs').promises;
      const storageState = JSON.parse(await fs.readFile(storageStatePath, 'utf-8'));
      await context.addInitScript(() => {
        // Script para restaurar localStorage/sessionStorage se necessário
      });
      logger.info('Storage state carregado');
      return storageState;
    } catch (error) {
      logger.warn({ error: error.message }, 'Storage state não encontrado, login será necessário');
      return null;
    }
  },

  async saveStorageState(storageStatePath) {
    try {
      const fs = require('fs').promises;
      const storageState = await context.storageState();
      await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
      await fs.writeFile(storageStatePath, JSON.stringify(storageState, null, 2));
      logger.info('Storage state salvo');
    } catch (error) {
      logger.error({ error: error.message }, 'Erro ao salvar storage state');
      throw error;
    }
  },

  getContext() {
    return context;
  },

  async close() {
    if (browser) {
      await browser.close();
      logger.info('Navegador fechado');
    }
  },
};

module.exports = browserManager;
