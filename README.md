# CIA NET — Plataforma de Gestão para Academias
### Proposta Comercial · Academia CIA do Corpo

---

## Visão Geral

A **CIA NET** é uma proposta de transformação digital completa desenvolvida exclusivamente para a Academia CIA do Corpo. O projeto cobre quatro pilares estratégicos:

1. **Estratégia Avançada de Marketing e Jornada de Vendas**
2. **Landing Pages de Alta Conversão**
3. **Plataforma CIA NET** (SaaS completo para academias)
4. **WhatsApp com Inteligência Artificial**

Este repositório contém o **POC (Proof of Concept)** — interfaces funcionais para apresentação comercial, desenvolvidas em HTML/CSS/JS puro sem frameworks.

---

## Estrutura de Pastas

```
cia-net/
│
├── index.html              ← Apresentação comercial (slides)
├── logo-cia.png            ← Logo oficial da CIA do Corpo
│
├── admin/                  ← Painel Administrativo
│   ├── index.html          (Dashboard principal)
│   ├── admin-campanhas.html
│   ├── admin-analytics.html
│   ├── admin-funil.html
│   ├── admin-unidades.html
│   ├── admin-alunos.html
│   ├── admin-financeiro.html
│   └── admin-nova-campanha.html
│
├── aluno/                  ← Área do Aluno
│   ├── index.html          (Dashboard do aluno)
│   ├── aluno-treinos.html
│   ├── aluno-agenda.html
│   ├── aluno-financeiro.html
│   ├── aluno-carteira.html
│   ├── aluno-planos.html
│   ├── aluno-pagamentos.html
│   ├── aluno-pendencias.html
│   └── aluno-login.html
│
└── checkout/               ← Checkout Digital
    └── index.html          (Matrícula online)
```

---

## Apresentação Comercial (`index.html`)

Apresentação em **9 slides** no estilo pitch deck interativo.

| # | Slide | Conteúdo |
|---|-------|----------|
| 1 | Hero | Logo, título, pills dos 4 pilares |
| 2 | Nossa Proposta | Cards dos 4 pilares clicáveis |
| 3 | Pilar 01 — Marketing | Funil de captação animado, KPIs |
| 4 | Pilar 02 — Landing Pages | Mockup de LP, taxas de conversão |
| 5 | Pilar 03 — CIA NET | Mockup da plataforma, demo links |
| 6 | Pilar 04 — WhatsApp IA | Chat animado com IA |
| 7 | Benefícios Esperados | 6 cards com métricas animadas |
| 8 | Cronograma | Timeline de 22 semanas |
| 9 | Próximos Passos | CTA, contato |

**Navegação:**
- Botões **Anterior / Próximo** no rodapé
- Setas do teclado `← →` (também `↑ ↓` e `Espaço`)
- Dots clicáveis no centro inferior
- Swipe em dispositivos touch
- `Home` = primeiro slide · `End` = último slide

---

## Área Administrativa (`admin/`)

Painel de gestão completo para operadores e gestores da academia.

### `index.html` — Dashboard Principal
- KPIs em tempo real: MRR, Alunos Ativos, Matrículas, Churn
- Gráfico de MRR e Matrículas (Chart.js, gradiente)
- Funil de conversão visual
- Tabela de unidades por performance
- Campanhas ativas resumidas
- Acesso rápido a todas as seções

### `admin-campanhas.html` — Campanhas de Marketing
- Listagem de campanhas com status, alcance e conversão
- Filtros por tipo, status e unidade
- Métricas agregadas (total enviado, taxa de abertura, leads gerados)
- Botão **+ Nova Campanha** → redireciona para o wizard

### `admin-nova-campanha.html` — Wizard de Nova Campanha
Wizard em **5 etapas**:
1. **Tipo** — WhatsApp, Email, SMS, Push, Social, Sequência
2. **Público** — segmentação por comportamento, filtros de unidade e plano
3. **Conteúdo** — editor com chips de variáveis, preview WhatsApp em tempo real
4. **Agendamento** — data, hora, orçamento, recorrência
5. **Revisão** — resumo completo + lançamento

### `admin-analytics.html` — Analytics & BI
- Métricas de performance de marketing
- Gráficos de tendência e comparativos
- Análise por canal de captação

### `admin-funil.html` — Funil de Captação
- Visualização do funil completo (Visitantes → Lead → Contato → Visita → Matrícula)
- Taxa de conversão por etapa
- Histórico e tendência

### `admin-unidades.html` — Gestão de Unidades
- Cards por unidade com MRR, alunos, ocupação
- Mapa de localização
- Performance comparativa entre unidades

### `admin-alunos.html` — Gestão de Alunos
- Listagem com busca e filtros
- Status do plano, frequência, pendências
- Ações rápidas: contato, editar, bloquear

### `admin-financeiro.html` — Financeiro
- MRR, inadimplência, projeções
- Relatórios por período
- Cobranças automáticas e pendentes

---

## Área do Aluno (`aluno/`)

Portal self-service completo para os alunos da academia.

### `index.html` — Dashboard do Aluno
- Banner de boas-vindas com nome, plano ativo e validade
- Ring de progresso (meta mensal de treinos)
- Cards rápidos: frequência, próxima aula, entradas restantes
- Treino do dia em destaque
- Ações rápidas: agendar, ver treino, financeiro

### `aluno-treinos.html` — Meus Treinos
- Programa de treino atual (A/B/C/D)
- Exercícios com séries, repetições e tempo de descanso
- Vídeo thumbnail placeholder por exercício

### `aluno-agenda.html` — Agenda e Aulas
- Calendário semanal com grade de horários
- Aulas disponíveis por modalidade (Musculação, Spinning, Pilates, Funcional)
- Indicador de vagas por aula
- Agendar/cancelar com um clique

### `aluno-financeiro.html` — Financeiro (visão geral)
- Plano ativo com data de renovação
- Histórico de pagamentos
- Saldo pendente
- Geração de boleto/PIX

### `aluno-carteira.html` — Minha Carteira
- Cartões de crédito cadastrados (visual de cartão físico)
- Adicionar novo cartão
- Seção PIX

### `aluno-planos.html` — Meus Planos
- Plano atual em destaque (banner laranja)
- Grade de planos disponíveis: Mensal, Trimestral, Semestral, Anual
- Tabela comparativa de benefícios

### `aluno-pagamentos.html` — Histórico de Pagamentos
- KPIs: total pago, próximo vencimento, cartão principal
- Tabela de transações com status e download de recibo

### `aluno-pendencias.html` — Pendências
- Resumo de pendências (documentos, avaliações, etc.)
- Badge de contagem na sidebar
- Histórico de itens resolvidos

### `aluno-login.html` — Login
- Tela de autenticação com email/senha
- Acesso ao checkout para novos alunos

---

## Checkout Digital (`checkout/`)

### `index.html` — Matrícula Online
Fluxo em **3 etapas** com progress indicator:

1. **Escolha seu Plano**
   - Cards: Mensal (R$89,90), Trimestral (R$79,90/mês), Semestral (R$69,90/mês), Anual (R$59,90/mês)
   - Destaque no plano mais popular

2. **Escolha sua Unidade**
   - Dropdown Estado → Cidade → Cards de unidade com endereço e horário

3. **Dados Pessoais + Pagamento**
   - Formulário: nome, email, CPF, telefone
   - Pagamento: cartão de crédito ou PIX
   - Resumo do pedido antes de confirmar

---

## A Proposta Comercial

### Pilar 01 — Estratégia de Marketing e Jornada de Vendas
- Mapeamento completo da jornada do cliente
- Funil de vendas com rastreamento de conversões
- Google Analytics 4, Meta Pixel e GTM configurados
- Remarketing e retargeting de visitantes
- Dashboards gerenciais com KPIs em tempo real

**Meta:** aumentar a taxa de conversão de 2,1% para 4,5%+ (+114%)

### Pilar 02 — Landing Pages de Alta Conversão
- Design focado em conversão com CTAs estratégicos
- Páginas por campanha: matrícula, eventos, promoções
- A/B testing para otimização contínua
- Integração com pixels de rastreamento e CRM
- Mobile-first com carregamento ultra-rápido

**Meta:** +127% na taxa de conversão, -43% no custo por lead

### Pilar 03 — Plataforma CIA NET
- Checkout digital com PIX e cartão de crédito
- Área do aluno completa (treinos, agenda, financeiro)
- Dashboard administrativo com KPIs e BI
- Gestão financeira, funil e análise de retenção
- Campanhas automáticas e analytics avançado

### Pilar 04 — WhatsApp com Inteligência Artificial
- IA treinada para qualificação de leads com contexto
- Atendimento automático 24/7 sem equipe adicional
- Recuperação automática de oportunidades perdidas
- Sequências inteligentes de nutrição de leads
- Integração nativa com CRM e plataforma CIA NET

---

## Cronograma Estimado

| Fase | Período | Duração |
|------|---------|---------|
| Planejamento | Semanas 1–2 | 2 semanas |
| Landing Pages | Semanas 3–4 | 2 semanas |
| Marketing & Rastreamento | Semanas 5–6 | 2 semanas |
| CIA NET Plataforma | Semanas 7–18 | 8–12 semanas |
| IA WhatsApp | Semanas 19–20 | 2 semanas |
| Testes & Go Live | Semanas 21–22 | 2 semanas |

**Total estimado:** 22 semanas · Metodologia ágil · Reporte semanal

---

## Resultados Esperados

| Indicador | Projeção |
|-----------|----------|
| Leads qualificados | +40% |
| Taxa de conversão | +25% |
| Atendimento | 24/7 automático |
| Redução de custos operacionais | -30% |
| Crescimento do MRR | +15% |
| Centralização de operações | 6 unidades em 1 painel |

---

## Tecnologia

- **Frontend:** HTML5 / CSS3 / JavaScript puro (sem frameworks)
- **Gráficos:** Chart.js 4.4.0
- **Fontes:** Inter (Google Fonts)
- **Design:** Dark theme premium, glassmorphism, animações CSS
- **Responsivo:** Mobile-first

---

## Como abrir

Abrir qualquer arquivo `.html` diretamente no navegador:

```
cia-net/index.html              → Apresentação comercial
cia-net/admin/                  → Painel admin
cia-net/aluno/                  → Área do aluno
cia-net/checkout/               → Checkout digital
```

> **Nota:** todos os links internos são relativos. Não é necessário servidor web — funciona com `file://` direto no browser.

---

*Proposta exclusiva para Academia CIA do Corpo · CIA NET © 2026*
# prototype-cia
