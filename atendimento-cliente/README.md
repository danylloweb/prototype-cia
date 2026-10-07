# Central de Atendimento ao Cliente

Página standalone para registro de ocorrências de atendimento da Cia do Corpo, pronta para abrir no navegador sem framework ou etapa de build.

## Arquivos

- `index.html`
- `style.css`
- `app.js`

## Como configurar `apiBase` e `landingToken`

Abra `app.js` e edite o bloco abaixo:

```js
const CONFIG = {
  apiBase: "https://sua-api.com",
  landingToken: "seu-token-aqui"
};
```

### Regras importantes

- `apiBase` deve apontar para a base da API, sem a rota final.
- `landingToken` deve ser preenchido no deploy/publicação, não commitado com valor real em produção.
- O envio é feito para:

```txt
POST {apiBase}/landing/register-customer-service-incident
```

## Como rodar localmente

Como a solução é estática, basta abrir `index.html` no navegador.

Opções comuns:

1. Clique duas vezes em `index.html`.
2. Ou sirva a pasta com um servidor estático simples da sua preferência.

Se for testar o envio real localmente, confirme antes:

- se a API aceita a origem usada no navegador;
- se `apiBase` e `landingToken` estão preenchidos;
- se o endpoint responde com `Accept: application/json`.

## Checklist de publicação

1. Preencher `CONFIG.apiBase` com a URL correta da API.
2. Injetar `CONFIG.landingToken` de forma segura no ambiente de publicação.
3. Confirmar CORS liberado para o domínio onde a página será hospedada.
4. Validar o endpoint `POST /landing/register-customer-service-incident`.
5. Revisar textos, contatos e links da página final.
6. Testar os fluxos de sucesso, erro `422` e falha de rede.
7. Garantir que nenhum token real foi commitado no repositório público.

## Exemplo de requisição enviada

```http
POST /landing/register-customer-service-incident HTTP/1.1
Host: sua-api.com
X-Landing-Token: seu-token-aqui
Content-Type: application/json
Accept: application/json
```

```json
{
  "type": "cancelamento",
  "name": "João da Silva",
  "phone": "81999999999",
  "cpf": "12345678900",
  "email": "joao@email.com",
  "plan_id": 1,
  "unit_id": 2,
  "description": "Solicito o cancelamento do meu plano."
}
```

## Observações de integração

- `phone` e `cpf` são mascarados visualmente no formulário, mas enviados somente com números.
- `unit_id`, `plan_id`, `email` e `description` podem ser enviados como `null` quando não forem preenchidos.
- As listas de unidades e planos usam mocks locais e já estão estruturadas em funções separadas para futura troca por API real.
