# SCA Extrator - Extração de Dados para Data Lake

Extrator de dados em **Node.js puro** que coleta informações de alunos do sistema SCA (https://app.sistemasca.com) para posterior análise em Data Lake.

## Características

- ✅ Login dinâmico (sem hardcoding de credenciais)
- ✅ Extração de perfil de alunos
- ✅ Parser de formulários genérico
- ✅ Coleta de dados com postback ASP.NET AJAX
- ✅ Concorrência configurável com retry automático
- ✅ Checkpoint para retomar de onde parou
- ✅ Interface visual em tempo real (http://localhost:3000)
- ✅ Armazenamento em JSON
- ✅ Logs estruturados

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

2. Preencha com suas credenciais SCA:

```env
SCA_USERNAME=seu_usuario
SCA_PASSWORD=sua_senha
```

## Execução

```bash
npm start
```

Acesse o dashboard em **http://localhost:3000** para acompanhar a extração em tempo real.

## Estrutura de Dados

### Output JSON (`data/output.json`)

Após a execução, um arquivo `data/output.json` é gerado contendo:

```json
{
  "metadata": {
    "extracted_at": "2026-08-28T10:16:56.000Z",
    "total_students": 1273,
    "processed": 512,
    "failed": 3,
    "success_rate": 0.995
  },
  "students": [
    {
      "student_id": "26430753",
      "registration_number": "56109",
      "name": "Abenito João Souza Gomes",
      "email": "dsafinanceiro@hotmail.com",
      "phone": "(83) 98753-4393",
      "age": 76,
      "access_blocked": true,
      "block_reasons": ["membership_payment_overdue"],
      "contacts": [],
      "relationships": [],
      "cadastro": {},
      "extracted_at": "2026-08-28T10:16:56.000Z",
      "status": "success"
    }
  ]
}
```

## Configurações Avançadas

Edite o arquivo `.env` para ajustar:

```env
# Concorrência (quantos alunos simultaneamente)
CONCURRENCY=5

# Delay entre requests (ms)
REQUEST_DELAY_MS=500

# Máximo de retentativas
MAX_RETRIES=3

# Timeout de requisição (ms)
REQUEST_TIMEOUT_MS=30000
```

## Checkpoint

Se o crawler parar, ele retomará de onde parou usando `data/checkpoint/progress.json`.

## Docker

```bash
docker build -t sca-extractor .
docker run -p 3000:3000 -e SCA_USERNAME=seu_usuario -e SCA_PASSWORD=sua_senha sca-extractor
```

## Segurança

- ✅ Credenciais apenas em `.env` (nunca no código)
- ✅ Logs não expõem senhas ou tokens
- ✅ Session state ignorado em `.gitignore`
- ✅ Apenas operações de leitura (GET/AJAX)

## Arquitetura

- `src/config.js` - Configurações
- `src/logger.js` - Logging estruturado
- `src/browser.js` - Gerenciamento de Playwright
- `src/auth.js` - Autenticação dinâmica
- `src/students.js` - Coleta de lista de alunos
- `src/parser/` - Parsers para diferentes conteúdos
- `src/storage/` - Camadas Bronze/Silver
- `src/api.js` - API Express + Socket.IO

## Etapas

1. ✅ Login dinâmico + listagem
2. ⏳ Extração de 1º aluno
3. ⏳ Acesso ao perfil
4. ⏳ Parser do perfil
5. ⏳ Postback Editar Cadastro
6. ⏳ Parser genérico de formulário
7. ⏳ Coleta de todos alunos
8. ⏳ Concorrência e retry
9. ⏳ JSON + API visual
10. ⏳ Docker

## Troubleshooting

Se tiver problemas com login, verifique:

1. Se as credenciais estão corretas em `.env`
2. Se o sistema SCA está acessível
3. Verifique os logs em `data/debug/login-page.html` (se gerado)

## Desenvolvedor

Danyllo Ferreira
