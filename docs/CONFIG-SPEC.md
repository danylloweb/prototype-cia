# Especificação — config.json publicado pelo painel admin

Este documento define o que o painel administrativo (backend) precisa publicar
no `config.json` (hoje em `https://msadmin.s3.amazonaws.com/config.json`) para
abastecer **todas** as seções do site. O arquivo
[`config-exemplo.json`](config-exemplo.json) nesta pasta é um exemplo completo
e válido, gerado a partir do conteúdo real do site — **o painel deve ser capaz
de gerar um arquivo com essa mesma estrutura**.

## Pré-requisito obrigatório: CORS

O bucket precisa de uma política de CORS liberando leitura pelo site, senão o
navegador bloqueia o fetch e nada do painel chega aos visitantes:

```json
[
  {
    "AllowedOrigins": ["https://www.academiaciadocorpo.com"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

## Como o site consome o arquivo

- Formato: `{ "bundle": { ...seções... } }`.
- **Toda seção é opcional**: o que não vier no bundle cai no conteúdo padrão
  embutido no site (seed). Nada quebra por seção ausente.
- **Arrays substituem por inteiro**: se `popups` vier com 1 item, o site passa a
  ter exatamente 1 popup (os padrões deixam de existir). O painel deve sempre
  publicar a lista completa de cada seção.
- Ordem de prioridade no site: edições locais do admin-protótipo (só no
  navegador de quem editou) > `config.json` (S3) > seed.
- `meta.version` deve ser incrementado a cada publicação (o site usa para
  controle de atualização/cache).

## Seções e status atual

| Seção do bundle | O que abastece no site | Status no config.json atual |
|---|---|---|
| `meta` | Dados da empresa, contatos, redes, horários gerais | ✅ OK |
| `units` | Cards e páginas das unidades | ✅ OK (ver observações) |
| `popups` | Popups/campanhas de todas as páginas | ✅ OK (manter sempre ≥1 ativo) |
| `plans` | Página e seção de planos, por unidade | ⚠️ Formato errado (ver abaixo) |
| `offer` | Faixa de campanha do topo (badge/título/subtítulo) | ❌ Faltando |
| `modalities` | Lista de modalidades | ❌ Faltando |
| `conceptExtraModalities` | Modalidades extras da unidade Concept | ❌ Faltando |
| `classesGrid` | Grade de aulas (por unidade ou `"unit": "all"`) | ❌ Faltando |
| `testimonials` | Depoimentos de alunos | ❌ Faltando |
| `partnerCategories` + `partnersClub` | Clube da Parceria (diretório filtrável) | ❌ Faltando |
| `partners` | Logos/nomes de convênios corporativos | ❌ Faltando |
| `totalpass` | Faixa TotalPass por unidade (`{ unitId: "TP3" }`) | ❌ Faltando |
| `acceptsWellhub` | Booleano Wellhub/Gympass | ❌ Faltando |
| `experimental` | Regras da aula experimental (dias, validade, observação) | ❌ Faltando |
| `telemetry` | IDs públicos de tags: GTM, GA4, Meta Pixel, Clarity | ❌ Faltando |

Campos de cada seção: seguir exatamente o `config-exemplo.json`.

## `plans` — formato exigido (hoje está incompatível)

O config atual publica `plans` como linhas de banco
(`{id, group, priceFrom: 99.99, matricula: 50, ...}`). O site **não consegue
renderizar** planos assim e ignora a seção. O formato exigido é por unidade,
com os cards completos:

```json
"plans": {
  "groupsOrder": ["Premium Standard", "Exclusive"],
  "byUnit": {
    "avenida-norte": {
      "tierLabel": "Premium Standard",
      "includedText": "Av. Norte, Ouro Preto, Peixinhos, Areias",
      "items": [
        {
          "key": "vip",
          "name": "Anual VIP",
          "desc": "Melhor custo-benefício para acesso total",
          "price": "12x de R$ 109,90",
          "unit": "",
          "old": "R$ 1.318,80",
          "note": "+ R$ 50,00",
          "featured": true,
          "cta": "Quero o Anual VIP",
          "badges": [
            { "t": "Compromete limite do cartão", "c": "amber" },
            { "t": "120 dias de carência", "c": "blue" }
          ],
          "features": ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a TODAS as 7 unidades"]
        }
      ]
    }
  }
}
```

- `price` é **string formatada** ("12x de R$ 109,90" ou "R$ 129,99"), não número.
- `badges[].c`: `green` | `blue` | `amber`.
- Cada unidade ativa precisa de uma entrada em `byUnit` (unidades do mesmo
  grupo podem repetir os mesmos itens).

## Observações sobre o conteúdo atual

- `units[].priceFrom` está como "Consulte valores" em todas as unidades — é o
  que será exibido nos cards. Confirmar se é intencional.
- `avenida-norte.experimentalDays: 7` difere das demais (3). Confirmar.
- O único popup expira em `2026-07-30`; depois disso o site fica sem popup.
- IDs das unidades (`units[].id`) são chaves usadas por `plans.byUnit`,
  `totalpass` e URLs (`unidade.html?u=<id>`) — não renomear sem combinar.

## Segurança

- **Nunca publicar segredos** neste arquivo (ele é público): tokens de API,
  `accessToken`, `apiSecret`, credenciais de integrações. Publicar apenas os
  IDs de tags que já são públicos por natureza (GTM, GA4, Pixel, Clarity).
- Credenciais de integrações (Google Ads, Meta CAPI etc.) ficam somente no
  backend do painel.
