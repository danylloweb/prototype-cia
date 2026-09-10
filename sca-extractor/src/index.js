const config = require('./config');
const { eventLogger, logger } = require('./logger');
const browserManager = require('./browser');
const auth = require('./auth');
const students = require('./students');
const studentsParser = require('./parser/students-parser');
const profile = require('./profile');
const path = require('path');
const fs = require('fs').promises;

async function main() {
  let page = null;

  try {
    eventLogger.crawlerStart();

    // Inicializar navegador
    logger.info('Iniciando extrator SCA');
    await browserManager.initialize();

    // Login manual na sessão atual do navegador
    logger.info('Aguardando autenticação manual...');
    page = await auth.login();

    // Garantir que seguimos para a página de alunos na mesma sessão
    if (!(await auth.validateSession(page))) {
      throw new Error('Sessão não autenticada após login manual');
    }

    const output = {
      metadata: {
        extracted_at: new Date().toISOString(),
        pages: 0,
        processed: 0,
        failed: 0,
      },
      students: [],
    };

    await students.ensureStudentsPage(page);
    await students.openActiveStudentsModal(page);

    const seenStudents = new Set();
    const studentsList = [];
    let pageIndex = 1;
    let consecutiveEmptyCount = 0;

    logger.info('🚀 Modo de extração semi-manual iniciado (100 por página, intervalo de 8s para você avançar manualmente).');

    while (true) {
      if (page.isClosed()) {
        logger.info('Navegador fechado pelo usuário. Finalizando extração...');
        break;
      }

      const htmlContent = await students.fetchStudentsPage(page, pageIndex);
      const parsedStudents = studentsParser.parse(htmlContent);

      let newInThisPage = 0;
      for (const student of parsedStudents) {
        if (!seenStudents.has(student.student_id)) {
          seenStudents.add(student.student_id);
          studentsList.push(student);
          newInThisPage += 1;
        }
      }

      output.metadata.pages = pageIndex;
      output.metadata.processed = studentsList.length;
      output.students = studentsList;

      await fs.mkdir(path.join(config.storage.dataDir), { recursive: true });
      await fs.writeFile(
        path.join(config.storage.dataDir, 'students-list-temp.json'),
        JSON.stringify(studentsList, null, 2)
      );
      await fs.writeFile(
        path.join(config.storage.dataDir, 'output.json'),
        JSON.stringify(output, null, 2)
      );

      if (parsedStudents.length === 0) {
        consecutiveEmptyCount += 1;
        logger.warn({ pageIndex, consecutiveEmptyCount }, 'Nenhum aluno encontrado nesta página.');
        if (consecutiveEmptyCount >= 3) {
          logger.info('3 leituras vazias consecutivas detectadas. Encerrando ciclo de extração.');
          break;
        }
      } else {
        consecutiveEmptyCount = 0;
      }

      logger.info(
        `✅ [PÁGINA ${pageIndex} EXTRAÍDA] ${parsedStudents.length} alunos na tela | +${newInThisPage} novos adicionados | Total acumulado: ${studentsList.length}`
      );
      logger.info('⏳ Aguardando 8 segundos: você pode avançar/mudar para a próxima página manualmente agora...');

      await page.waitForTimeout(8000);

      pageIndex += 1;
    }

    // Limpar
    if (!page.isClosed()) {
      await page.close().catch(() => {});
    }
    await browserManager.close().catch(() => {});

    eventLogger.crawlerFinished({
      total: output.students.length,
      processed: output.metadata.processed,
      failed: output.metadata.failed,
    });

    logger.info('✅ Extração de perfis concluída página por página!');
  } catch (error) {
    eventLogger.crawlerError(error);
    logger.error({ error: error.message, stack: error.stack }, 'Erro fatal');
    process.exit(1);
  }
}

main();
