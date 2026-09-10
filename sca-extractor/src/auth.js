const config = require('./config');
const { eventLogger, logger } = require('./logger');
const browserManager = require('./browser');

async function prefillLoginFields(page) {
  const emailSelectors = ['#txtEmail', 'input[name="txtEmail"]', 'input[type="email"]'];
  const passwordSelectors = ['#txtSenha', 'input[name="txtSenha"]', 'input[type="password"]'];

  for (const selector of emailSelectors) {
    const input = await page.$(selector);
    if (input) {
      await input.fill(config.sca.username);
      break;
    }
  }

  let passwordFound = false;
  for (const selector of passwordSelectors) {
    const input = await page.$(selector);
    if (input) {
      await input.fill(config.sca.password);
      passwordFound = true;
      break;
    }
  }

  if (!passwordFound) {
    const continueButton = await page.$('#btnEmail, a#btnEmail');
    if (continueButton) {
      const isDisabled = await continueButton
        .evaluate((el) => el.classList.contains('aspNetDisabled'))
        .catch(() => false);
      if (!isDisabled) {
        await continueButton.click().catch(() => {});
      }
    }
  }
}

const auth = {
  async login() {
    const context = browserManager.getContext();
    const page = await context.newPage();

    try {
      eventLogger.loginStart(config.sca.username);

      logger.info(`Abrindo ${config.sca.baseUrl}/login`);
      await page.goto(`${config.sca.baseUrl}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: config.crawler.requestTimeoutMs,
      });

      await prefillLoginFields(page);
      logger.info('Faça o login manualmente no navegador aberto.');
      logger.info('O crawler vai continuar assim que a sessão sair da página de login.');

      let waitedSeconds = 0;
      while (page.url().includes('/login')) {
        if (waitedSeconds % 3 === 0) {
          await prefillLoginFields(page);
        }
        if (waitedSeconds % 15 === 0) {
          logger.info(`Aguardando login manual... (${waitedSeconds}s)`);
        }
        await page.waitForTimeout(1000);
        waitedSeconds += 1;
      }

      const currentUrl = page.url();
      logger.info({ currentUrl }, 'Sessão autenticada no navegador');
      eventLogger.loginSuccess(config.sca.username);

      return page;
    } catch (error) {
      eventLogger.loginError(error);
      await page.close().catch(() => {});
      throw error;
    }
  },

  async validateSession(page) {
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('login')) {
        logger.warn('Sessão ainda não autenticada');
        return false;
      }

      logger.info('Sessão válida');
      return true;
    } catch (error) {
      logger.error({ error: error.message }, 'Erro ao validar sessão');
      return false;
    }
  },
};

module.exports = auth;
