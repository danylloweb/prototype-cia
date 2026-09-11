# Página de Assinatura Digital - assign.html

## 📋 Visão Geral
Implementação completa de um fluxo de assinatura digital seguindo o tema visual do `anamnese.html`. A página permite que alunos aceitem termos, capturem assinatura e tirem foto para reconhecimento facial.

## 📁 Arquivos Criados

### 1. **assign.html** (17KB)
- Estrutura HTML com 4 etapas principais
- Estados: Loading, Error, Form, Submitting, Success
- Elementos interativos: Canvas de assinatura, Câmera, Forms
- Segue o padrão visual do anamnese.html

### 2. **assets/css/assign.css** (5.9KB)
- Estilos responsivos mobile-first
- Grid layout para informações do contrato
- Canvas e estilos de câmera
- Animações de loading e progress
- Suporte para dark mode

### 3. **assets/js/assign.js** (18KB)
- Classe `AssignmentFlow` que gerencia todo o fluxo
- Validação e carregamento de dados via API
- Captura e armazenamento local de dados
- Submissão sequencial de requisições

## 🔄 Fluxo de Funcionamento

### Etapa 1: Dados do Contrato
1. Extrai parâmetro `code` da URL (`?code=...`)
2. Faz GET request a `/signature/{code}`
3. Exibe dados do aluno e plano

### Etapa 2: Termos e Condições
1. Baixa arquivo de termos via `termsUrl`
2. Força scroll completo (95%)
3. Libera checkbox apenas após scroll completo
4. Validação de aceite obrigatória

### Etapa 3: Assinatura Digital
1. Canvas com suporte a touch, mouse e caneta
2. Funcionalidades: desfazer, limpar, salvar
3. Armazena assinatura como base64 PNG
4. Validação de assinatura não vazia

### Etapa 4: Foto para Reconhecimento Facial
1. Acessa a câmera só ao entrar na etapa 4 (MediaDevices API), com fallback de upload da galeria
2. Preview e captura de foto
3. Permite recapturar
4. Armazena foto como JPEG (lado maior até 1024px, qualidade 0.82), sem espelhamento — só a prévia na tela é espelhada

### Submissão Final
1. Mostra tela de loading com animações
2. **Primeira requisição:** POST `/signature/{code}/photo` (foto)
3. **Segunda requisição:** POST `/signature/{code}/finalize` (assinatura + aceite)
4. Mostra sucesso ou erro com opção de retry

## 📡 Endpoints Esperados

### GET /signature/{code}
**Response esperado:**
```json
{
  "success": true,
  "data": {
    "signatureGymMember": {
      "unitName": "Ouro Preto",
      "name": "Nelson Filipe dos Santos",
      "email": "nfilipesantos@outlook.com",
      "cpf": "08775119420",
      "phone": "81994992220",
      "type": "monthly",
      "startDate": "20/01/2026",
      "birth_date": "17/11/1990",
      "age": 35
    },
    "plan": {
      "name": "MENSAL",
      "groupLabel": "Exclusive",
      "priceFrom": 160,
      "matricula": 0
    },
    "termsUrl": "https://msadmin.s3.amazonaws.com/...",
    "termsVersion": "1.0",
    "code": "01M23ZQ39F19KCGJ4FES7KY66P"
  }
}
```

### POST /signature/{code}/photo
**Payload:** Multipart form com campo `file` (`face.jpg`, image/jpeg)  
**Response esperado:**
```json
{
  "success": true,
  "data": { ... }
}
```

### POST /signature/{code}/finalize
**Payload:**
```json
{
  "accepted_terms": true,
  "terms_version": "1.0",
  "accepted_at": "2026-09-09T12:00:00",
  "signature": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Response esperado:**
```json
{
  "success": true,
  "data": { ... }
}
```

## 🎨 Recursos Implementados

- ✅ **Responsivo** - Mobile-first com grid layout adaptativo
- ✅ **Acessibilidade** - Labels, ARIA, navegação por teclado
- ✅ **Validações** - Campos obrigatórios, scroll completo, assinatura não vazia
- ✅ **Feedback Visual** - Toast messages, progress bar, animações
- ✅ **Tratamento de Erros** - Fallbacks para câmera indisponível
- ✅ **Privacy** - Dados armazenados localmente apenas até submissão
- ✅ **Performance** - Cache de canvas, lazy loading

## 🖼️ Etapas Visuais

1. **Step Indicator** - Barra com 4 etapas (Dados → Termos → Assinatura → Foto)
2. **Info Display** - Grid com informações formatadas do aluno e plano
3. **Terms Scroll** - Container com scrollbar de progresso
4. **Signature Canvas** - Quadro para assinatura com placeholder
5. **Camera Capture** - Preview de câmera com frame de reconhecimento facial
6. **Progress Submit** - Animação com 2 itens: foto → assinatura
7. **Success Screen** - Confirmação e link para continuar

## 🔐 Armazenamento Local

Dados armazenados temporariamente no navegador:
- Código do contrato
- Dados do contrato (leitura)
- Assinatura (canvas base64)
- Foto (canvas base64)
- Estado dos termos

Todos os dados são **automaticamente limpos** ao sair da página ou fechar a aba.

## 📱 Navegação

| Botão | Ação |
|-------|------|
| **Continuar** | Avança para próxima etapa |
| **Voltar** | Retorna para etapa anterior |
| **Concluir assinatura** | Submete dados finais (etapa 4) |
| **Salvar assinatura** | Captura canvas como PNG |
| **Fotografar** | Captura frame da câmera |
| **Usar esta foto** | Confirma foto capturada |

## 🚀 Como Usar

1. **URL com código:**
   ```
   https://seu-dominio.com/assign.html?code=01M23ZQ39F19KCGJ4FES7KY66P
   ```

2. **Fluxo esperado:**
   - Página carrega e busca dados
   - Usuário avança pelas 4 etapas
   - Na última etapa, clica "Concluir assinatura"
   - Página mostra loading e envia 2 requisições em ordem
   - Sucesso = redirecionamento para conta

## 🐛 Tratamento de Erros

- **Link inválido/expirado** → Tela de erro com opção de retry
- **Termos não encontrados** → Toast de erro, continue mesmo assim
- **Câmera indisponível** → Mensagem de erro no container de câmera
- **Assinatura vazia** → Validação ao clicar "Continuar"
- **Foto não capturada** → Validação ao clicar "Continuar"
- **Erro de submissão** → Volta ao form, mostra erro

## 📊 Compatibilidade

- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ✅ Mobile browsers
- ⚠️ Requer HTTPS para acesso à câmera

## 📝 Notas

- O canvas de assinatura detecta automáticamente múltiplos traços
- A foto capturada usa a câmera frontal por padrão
- Todos os dados enviados via HTTPS
- Versão dos termos rastreada no aceite
- Timestamp de aceite em ISO 8601

