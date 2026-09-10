const config = require('./config');
const { logger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

const students = {
  async closeDashboardPopups(page) {
    const closeSelectors = [
      '#r_fee_btnFec',
      '.i-deletar',
    ];

    for (const selector of closeSelectors) {
      const el = page.locator(selector);
      if (await el.count()) {
        try {
          await el.first().click({ timeout: 1500 });
          await page.waitForTimeout(400);
        } catch (_) {
          // Ignora se popup já fechou ou elemento não está clicável.
        }
      }
    }
  },

  async switchUnitIfConfigured(page) {
    if (!config.sca.unitName) {
      return false;
    }

    const openSelector = '#c_tro_lnkUnidade';
    const trigger = page.locator(openSelector);
    if (!(await trigger.count())) {
      logger.warn('Seletor de unidade não encontrado');
      return false;
    }

    logger.info({ unitName: config.sca.unitName }, 'Trocando unidade');
    await trigger.first().click({ timeout: config.crawler.requestTimeoutMs });
    await page.waitForTimeout(1000);

    const option = page.locator(`span:has-text("${config.sca.unitName}")`).first();
    if (!(await option.count())) {
      logger.warn({ unitName: config.sca.unitName }, 'Unidade não encontrada na lista');
      return false;
    }

    await option.click({ timeout: config.crawler.requestTimeoutMs });
    await page.waitForTimeout(2500);
    return true;
  },

  async openStudentsDashboard(page) {
    const menuLink = page.locator('#c_men_lnkAlu');
    if (await menuLink.count()) {
      await menuLink.first().click({ timeout: config.crawler.requestTimeoutMs }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    await page.goto(`${config.sca.baseUrl}/dashboard/alunos`, {
      waitUntil: 'domcontentloaded',
      timeout: config.crawler.requestTimeoutMs,
    });
  },

  async ensureStudentsPage(page) {
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard/alunos')) {
      logger.info('Abrindo página de alunos');
      await this.openStudentsDashboard(page);
    }
    // Aguardar página e scripts inicializarem
    await page.waitForTimeout(15000);
  },

  async triggerPostbackAndWait(page, eventTarget, eventArgument = '') {
    logger.info({ eventTarget, eventArgument }, 'Disparando postback ASP.NET');

    // Aguardar qualquer postback assíncrono pendente terminar antes de disparar o próximo
    await page.waitForFunction(() => {
      try {
        return (
          typeof window.Sys === 'undefined' ||
          typeof window.Sys.WebForms === 'undefined' ||
          !window.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()
        );
      } catch (_) {
        return true;
      }
    }, { timeout: 10000 }).catch(() => {});

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/dashboard/alunos') &&
        res.request().method() === 'POST' &&
        res.status() === 200,
      { timeout: config.crawler.requestTimeoutMs }
    );

    const executed = await page.evaluate(
      ({ target, arg }) => {
        try {
          // Usar setTimeout para desacoplar da stack estrita do Playwright,
          // evitando erro de 'caller'/'callee' do ScriptManager ASP.NET
          window.setTimeout(() => {
            if (typeof window.__doPostBack === 'function') {
              window.__doPostBack(target, arg);
            } else {
              const form = document.getElementById('frm') || document.forms[0];
              if (form) {
                let eventTargetInput = form.querySelector('#__EVENTTARGET');
                let eventArgumentInput = form.querySelector('#__EVENTARGUMENT');

                if (!eventTargetInput) {
                  eventTargetInput = document.createElement('input');
                  eventTargetInput.type = 'hidden';
                  eventTargetInput.name = '__EVENTTARGET';
                  eventTargetInput.id = '__EVENTTARGET';
                  form.appendChild(eventTargetInput);
                }

                if (!eventArgumentInput) {
                  eventArgumentInput = document.createElement('input');
                  eventArgumentInput.type = 'hidden';
                  eventArgumentInput.name = '__EVENTARGUMENT';
                  eventArgumentInput.id = '__EVENTARGUMENT';
                  form.appendChild(eventArgumentInput);
                }

                eventTargetInput.value = target;
                eventArgumentInput.value = arg;
                form.submit();
              }
            }
          }, 0);
          return true;
        } catch (_) {
          return false;
        }
      },
      { target: eventTarget, arg: eventArgument }
    );

    if (!executed) {
      throw new Error(`Não foi possível disparar postback para ${eventTarget}`);
    }

    const response = await responsePromise;
    // Intervalo para o ScriptManager renderizar a resposta no DOM
    await page.waitForTimeout(1000);
    return response;
  },

  async openActiveStudentsModal(page) {
    const isAlreadyOpen = await page.locator('#r_panJanDet, table.sem-bor-inf').first().isVisible().catch(() => false);
    if (isAlreadyOpen) {
      logger.info('Modal de alunos ativos já está aberto no navegador.');
      return true;
    }

    logger.info('Aguardando 20 segundos antes da abertura do modal de alunos...');
    await page.waitForTimeout(20000);

    logger.info('Tentando abrir modal de alunos ativos...');
    try {
      await this.triggerPostbackAndWait(page, 'ctl00$c$btnAluAti', '');
      await page.locator('#r_panJanDet, #r_updJan, .janela').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      logger.info('Modal aberto com sucesso.');
      await page.waitForTimeout(1000);
      return true;
    } catch (error) {
      logger.warn({ error: error.message }, 'Falha no postback direto ao abrir modal, tentando clique no seletor');
      const modalSelectors = [
        '#c_btnAluAti',
        '#c_updAluAti a#c_btnAluAti',
        'a:has(.i-seta-direita)',
        'span:has-text("1.")',
      ];

      for (const selector of modalSelectors) {
        const modalTrigger = page.locator(selector);
        if (await modalTrigger.count()) {
          logger.info({ selector }, 'Clicando no gatilho do modal de alunos');
          await Promise.all([
            page
              .waitForResponse(
                (res) => res.url().includes('/dashboard/alunos') && res.request().method() === 'POST' && res.status() === 200,
                { timeout: config.crawler.requestTimeoutMs }
              )
              .catch(() => null),
            modalTrigger.first().click({ timeout: config.crawler.requestTimeoutMs }).catch(() => {}),
          ]);
          await page.waitForTimeout(1000);
          return true;
        }
      }

      logger.warn('Gatilho do modal não encontrado; continuando com HTML atual');
      return false;
    }
  },

  async setPageSize(page, value = '100') {
    logger.info({ value }, 'Ajustando registros por página via postback');
    try {
      await this.triggerPostbackAndWait(page, `ctl00$r$pagDet$b${value}`, '');
      await page.waitForTimeout(1500);
      return true;
    } catch (error) {
      logger.warn({ value, error: error.message }, 'Falha no postback do page size, tentando clique no elemento');
      const selector = `#r_pagDet_b${value}`;
      const button = page.locator(selector);
      if (!(await button.count())) {
        logger.warn({ value }, 'Opção de registros por página não encontrada');
        return false;
      }

      const disabled = await button.evaluate((el) => el.classList.contains('aspNetDisabled')).catch(() => false);
      if (disabled) {
        logger.warn({ value }, 'Opção de registros por página desabilitada');
        return false;
      }

      await Promise.all([
        page
          .waitForResponse(
            (res) => res.url().includes('/dashboard/alunos') && res.request().method() === 'POST' && res.status() === 200,
            { timeout: config.crawler.requestTimeoutMs }
          )
          .catch(() => null),
        button.first().click({ timeout: config.crawler.requestTimeoutMs }),
      ]);
      await page.waitForTimeout(1500);
      return true;
    }
  },

  async fetchStudentsPage(page, pageIndex = 1) {
    try {
      logger.info({ pageIndex }, 'Capturando página atual de alunos');

      const pageContent = await page.content();

      const date = new Date().toISOString().slice(0, 10);
      await fs.mkdir(path.join(config.storage.dataDir, 'debug'), { recursive: true });
      await fs.writeFile(
        path.join(config.storage.dataDir, 'debug', `students-page-${String(pageIndex).padStart(3, '0')}.html`),
        pageContent
      );

      const bronzeDir = path.join(config.storage.dataDir, 'bronze', 'students', date);
      await fs.mkdir(bronzeDir, { recursive: true });
      await fs.writeFile(path.join(bronzeDir, `page-${String(pageIndex).padStart(3, '0')}.html`), pageContent);

      return pageContent;
    } catch (error) {
      logger.error({ error: error.message }, 'Erro ao acessar página de alunos');
      throw error;
    }
  },

  async getNextPageTargetFromHtml(htmlContent, currentPageNumber) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(htmlContent);
    const nextPageNumber = currentPageNumber + 1;

    // 1. Tentar encontrar o link numérico direto para a próxima página (ex: "2", "3", etc.)
    let directTarget = null;
    $('a[id^="r_pagDet_rp_l_"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text === String(nextPageNumber)) {
        const href = $(el).attr('href') || '';
        const match = href.match(/__doPostBack\('([^']+)'/);
        if (match) {
          directTarget = { target: match[1], type: 'page' };
          return false;
        }
      }
    });

    if (directTarget) {
      return directTarget;
    }

    // 2. Se não encontrou o link numérico (ou mudou de bloco de 10 páginas), verificar a seta de avançar
    const nextRange = $('#r_pagDet_lP');
    if (nextRange.length && !nextRange.hasClass('aspNetDisabled')) {
      const href = nextRange.attr('href') || '';
      const match = href.match(/__doPostBack\('([^']+)'/);
      if (match) {
        return { target: match[1], type: 'range' };
      }
      return { target: 'ctl00$r$pagDet$lP', type: 'range' };
    }

    return null;
  },

  async goToNextPage(page, htmlContent, currentPageNumber) {
    const next = await this.getNextPageTargetFromHtml(htmlContent, currentPageNumber);
    if (!next) {
      logger.info('Nenhum próximo controle de página encontrado (última página atingida)');
      return false;
    }

    logger.info({ currentPageNumber, nextTarget: next.target }, 'Avançando página de alunos via postback');
    try {
      await this.triggerPostbackAndWait(page, next.target, '');
      return true;
    } catch (error) {
      logger.warn({ error: error.message, nextTarget: next.target }, 'Erro ao avançar página via postback');
      return false;
    }
  },
};

module.exports = students;
