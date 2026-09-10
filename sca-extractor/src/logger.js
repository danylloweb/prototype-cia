const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.logging.level,
});

// Log events with structured format
const eventLogger = {
  loginStart: (username) => {
    logger.info({ event: 'LOGIN_START', username: username.substring(0, 3) + '***' }, 'Iniciando login');
  },

  loginSuccess: (username) => {
    logger.info({ event: 'LOGIN_SUCCESS', username: username.substring(0, 3) + '***' }, 'Login bem-sucedido');
  },

  loginError: (error) => {
    logger.error({ event: 'LOGIN_ERROR', error: error.message }, 'Erro ao fazer login');
  },

  studentsPageAccess: (studentCount) => {
    logger.info({ event: 'STUDENTS_PAGE', studentCount }, `${studentCount} alunos encontrados`);
  },

  profileStart: (studentId) => {
    logger.info({ event: 'PROFILE_START', studentId }, `Iniciando extração do perfil do aluno ${studentId}`);
  },

  profileSuccess: (studentId, name) => {
    logger.info({ event: 'PROFILE_SUCCESS', studentId, name }, `Perfil do aluno ${studentId} extraído`);
  },

  profileError: (studentId, error) => {
    logger.error({ event: 'PROFILE_ERROR', studentId, error: error.message }, `Erro ao extrair perfil ${studentId}`);
  },

  cadastroStart: (studentId) => {
    logger.info({ event: 'CADASTRO_START', studentId }, `Iniciando postback Editar Cadastro para aluno ${studentId}`);
  },

  cadastroSuccess: (studentId) => {
    logger.info({ event: 'CADASTRO_SUCCESS', studentId }, `Modal Editar Cadastro capturado para aluno ${studentId}`);
  },

  cadastroError: (studentId, error) => {
    logger.error({ event: 'CADASTRO_ERROR', studentId, error: error.message }, `Erro ao executar postback ${studentId}`);
  },

  studentProcessingStart: (studentId) => {
    logger.debug({ event: 'STUDENT_PROCESSING_START', studentId }, `Processando aluno ${studentId}`);
  },

  studentProcessingSuccess: (studentId) => {
    logger.info({ event: 'STUDENT_SUCCESS', studentId }, `Aluno ${studentId} processado com sucesso`);
  },

  studentProcessingError: (studentId, error, attempt, maxRetries) => {
    logger.warn(
      { event: 'STUDENT_ERROR', studentId, error: error.message, attempt, maxRetries },
      `Erro ao processar aluno ${studentId} (tentativa ${attempt}/${maxRetries})`
    );
  },

  retry: (studentId, attempt, maxRetries, delay) => {
    logger.info({ event: 'RETRY', studentId, attempt, maxRetries, delayMs: delay }, `Tentando novamente aluno ${studentId}`);
  },

  crawlerStart: () => {
    logger.info({ event: 'CRAWLER_START' }, 'Iniciando extração de dados');
  },

  crawlerFinished: (stats) => {
    logger.info({ event: 'CRAWLER_FINISHED', ...stats }, 'Extração de dados finalizada');
  },

  crawlerError: (error) => {
    logger.error({ event: 'CRAWLER_ERROR', error: error.message }, 'Erro durante extração');
  },
};

module.exports = { logger, eventLogger };
