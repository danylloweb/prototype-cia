const cheerio = require('cheerio');
const { logger } = require('../logger');

const studentsParser = {
  parse(htmlContent) {
    try {
      const $ = cheerio.load(htmlContent);

      const students = [];
      const seenIds = new Set();

      // Procurar por links de perfil: /perfil?c=ID
      // Formatos possíveis:
      // 1. href="/perfil?c=26430753"
      // 2. href="perfil?c=26430753"
      // 3. dentro de <a> tags com padrão de link

      $('a[href*="/perfil?c="], a[href*="perfil?c="]').each((index, element) => {
        const href = $(element).attr('href');

        if (!href) return;

        // Extrair parâmetro 'c' da URL
        const match = href.match(/[?&]c=(\d+)/);
        if (!match) return;

        const studentId = match[1];

        // Evitar duplicatas
        if (seenIds.has(studentId)) return;
        seenIds.add(studentId);

        // Tentar extrair informações adicionais da linha/contexto
        const $row = $(element).closest('tr').first();
        const cells = $row.find('td').map((_, td) => $(td).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
        const nameCandidate =
          $row.find('span[rel="nome-completo"], .student-name').first().text().trim() ||
          cells.find((text) => /\s/.test(text) && !/(mês|meses|anos)/i.test(text) && !/^#?\d+$/.test(text)) ||
          null;
        const registrationMatch = nameCandidate ? nameCandidate.match(/#?(\d{3,})/) : null;
        const name = nameCandidate
          ? nameCandidate.replace(/\s*(?:#|\()\d{3,}\)?\s*$/, '').trim() || nameCandidate
          : null;
        const registration_number = registrationMatch ? registrationMatch[1] : null;
        const phone =
          $row.find('.student-phone').first().text().trim() ||
          cells.find((text) => /\(?\d{2}\)?\s?\d{4,5}-\d{4}/.test(text)) ||
          null;
        const photoUrl =
          $row.find('a.elemento.tf-6.foto img, a.foto img, img[src*="/arquivos/fotos/"]').first().attr('src') ||
          $(element).prevAll('a.elemento.tf-6.foto').find('img').first().attr('src') ||
          null;

        students.push({
          student_id: studentId,
          profile_url: `/perfil?c=${studentId}`,
          name: name,
          registration_number,
          phone: phone,
          photo_url: photoUrl,
        });
      });

      logger.info({ studentCount: students.length }, `${students.length} alunos extraídos da página`);
      return students;
    } catch (error) {
      logger.error({ error: error.message }, 'Erro ao fazer parser da página de alunos');
      throw error;
    }
  },
};

module.exports = studentsParser;
