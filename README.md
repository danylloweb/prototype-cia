# Cia do Corpo — Site v1 (client-side)

Reconstrução completa do site academiaciadocorpo.com como **plataforma de conversão e performance**: site estático moderno (HTML/CSS/JS), data-driven, com painel administrativo, telemetria ponta a ponta e SEO/GEO/AEO.

## Como rodar localmente

Site 100% estático — sirva a pasta `site/` (não abra via `file://` para o painel admin funcionar):

```bash
cd site
python3 -m http.server 8080
# acesse http://localhost:8080
```

Deploy: suba `site/` em **Vercel, Netlify, Cloudflare Pages ou GitHub Pages**. Nenhum backend necessário nesta versão.

## Estrutura

```
site/
  index.html              Home (landing page de conversão)
  unidades.html           Lista de unidades (renderizada da config)
  unidade.html            Página individual de unidade (?u=ID)
  modalidades.html        Modalidades
  planos.html             Planos (Hexa, Plus, Kids)
  sobre.html              Institucional
  contato.html            Formulário → WhatsApp
  clube-da-parceria.html  Página institucional do clube
  clube-parceria-lp.html  LP do Clube com diretório filtrável (dinâmico)
  admin/                  Painel administrativo (login)
  assets/
    css/styles.css        Design system
    js/config.js          ★ Fonte de dados (unidades, popups, parceiros, telemetria)
    js/data-service.js    Camada de dados (localStorage + export/import)
    js/telemetry.js       Telemetria + consent LGPD
    js/site.js            Render dinâmico (unidades, popups, schema, logo)
    js/experience.js      Geolocalização, quiz, barra fixa
    js/main.js            Interações de UI
    img/
      LOGO-HORI-BRA.png   Logo oficial horizontal branco (PNG)
      LOGO-HORI-BRA.avif  Versão AVIF (fallback Wix CDN se necessário)
  robots.txt  sitemap.xml
```

## Hierarquia de dados

```
config.js (seed padrão)
  ↑ sobreposto por localStorage (edições salvas no admin)
  ↑ preparado para sobrepor com backend API no futuro
```

Tudo gerenciado por `window.CDC.data` (`data-service.js`). Chave localStorage: `cdc_site_config_v4`.

## Conversão — foco WhatsApp

- CTAs com `data-cdc="wa-default"` apontam para o WhatsApp da **unidade escolhida pela pessoa**
- **Minha Unidade**: escolha persiste no navegador; site inteiro se adapta
- **Geolocalização**: detecta unidade mais próxima por GPS (Haversine sobre coordenadas em `config.js`). Requer HTTPS em produção; fallback para escolha manual
- **Quiz "Montar plano"**: 3 passos (objetivo → momento → unidade) → recomendação + WhatsApp pré-preenchido
- **Barra de conversão fixa** + botão flutuante WhatsApp

## Telemetria

Em **Admin → Integrações**, cole os IDs (entram em vigor imediatamente):

| Campo | Exemplo |
|---|---|
| Google Tag Manager | `GTM-XXXXXXX` |
| GA4 | `G-XXXXXXXXXX` |
| Meta Pixel | `000000000000000` |
| Microsoft Clarity | `xxxxxxxxxx` |
| CAPI endpoint | URL server-side (opcional) |

Eventos disparados: `page_view`, `whatsapp_click`, `call_click`, `lead_submit`, `trial_request`, `popup_view`, `popup_cta`, `unit_selected`, `geo_unit_selected`, `quiz_start`, `club_filter`, `consent_choice`.

**Consent Mode v2 / LGPD**: tags só carregam após aceite. Eventos gravados em first-party (localStorage) para alimentar o Dashboard sem backend.

## SEO / GEO / AEO

- Metas, Open Graph, Twitter Card por página; `canonical`; `robots.txt`; `sitemap.xml`
- JSON-LD: `Organization`, `ExerciseGym`/`LocalBusiness` por unidade, `FAQPage`, `BreadcrumbList`, `WebSite + SearchAction`
- AEO: blocos de FAQ objetivos + liberação de crawlers de IA (GPTBot, PerplexityBot etc.) no `robots.txt`

## Painel administrativo (`/admin`)

Login demo: usuário **admin** · senha **ciadocorpo2026** (troque em Configurações no primeiro acesso).

| Seção | O que faz |
|---|---|
| Dashboard | KPIs de telemetria first-party (WhatsApp, ligações, leads, conversão), gráfico por dia, origem de tráfego, conversões por unidade |
| Unidades | Adicionar, editar, remover, ligar/desligar unidades |
| Popups & Campanhas | Criar/editar campanhas, gatilhos (tempo, scroll, saída, imediato), frequência, agendamento, prévia |
| Clube & Parceiros | CRUD do diretório de parceiros e categorias |
| Grade de Aulas | Editar grade por dia/horário/unidade |
| Conteúdo & Oferta | Oferta principal, dados gerais, horários, depoimentos |
| Integrações | IDs de tag + conexão de APIs (Google Ads, GA4, Search Console, Meta Ads, CAPI, GTM) |
| Configurações | Trocar senha, exportar/importar JSON, restaurar padrão |

> Alterações ficam salvas no localStorage do navegador. Para publicar para todos os visitantes: **Exportar JSON** e substituir o seed em `config.js` (ou conectar um backend — a camada de dados já está preparada).

## Clube da Parceria

`clube-parceria-lp.html`: diretório com busca e filtro por categoria em tempo real, dados em `config.js` (`partnersClub` / `partnerCategories`).

## Design

- Hero com fundo em preto e branco (`filter: grayscale(100%)`) para destacar os elementos em laranja
- Logo oficial PNG (`LOGO-HORI-BRA.png`) usado no header, footer e admin; fallback automático para CDN Wix
- Design system em `styles.css` com variáveis CSS, dark theme nativo

## Próximos passos

1. Preencher IDs de telemetria reais (GTM/GA4/Pixel/Clarity) no admin
2. Ajustar coordenadas GPS das unidades para precisão de geolocalização
3. Conectar backend leve para: persistência multiusuário do admin e sincronização de dados de Google/Meta Ads no Dashboard (CPL, ROAS, investimento)
4. Auto-hospedar imagens das unidades e gerar `srcset` para performance máxima
