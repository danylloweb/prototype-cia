# Deploy

O deploy é automático: push na `main` dispara o workflow `.github/workflows/main.yml`,
que entra por SSH no servidor e roda `git pull origin main` em `/var/www/html/prototype-cia`.

## URLs sem `.html`

Os `canonical` das páginas e o `sitemap.xml` usam URLs limpas (`/planos`, `/unidades`),
que é o formato que o site atual já usa e o que está indexado no Google. Para o servidor
entender essas URLs é preciso uma regra de reescrita:

| Servidor | O que fazer |
|---|---|
| **Apache** | Nada: o `.htaccess` na raiz já faz. Requer `AllowOverride All` no vhost e `mod_rewrite` ativo. |
| **Nginx** | O `.htaccess` é ignorado. Copiar `deploy/nginx.conf.example` para o `server{}` do site. |

Como conferir qual está em uso:

```bash
curl -sI https://SEU-DOMINIO/ | grep -i ^server
```

E confirmar que a reescrita está valendo (deve responder `200`, e `/planos.html` deve
responder `301` para `/planos`):

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://SEU-DOMINIO/planos
```

Se `AllowOverride` estiver como `None` no vhost do Apache, o `.htaccess` é ignorado em
silêncio — as URLs limpas dão 404 e o `.git` continua acessível. Ajustar no vhost:

```apache
<Directory /var/www/html/prototype-cia>
    AllowOverride All
</Directory>
```

### Por que os links internos ainda usam `.html`

Os `href` entre as páginas continuam apontando para `unidades.html`, e não para
`/unidades`. É proposital: assim o site funciona **mesmo que a regra de reescrita não
esteja ativa** (servidor Nginx sem a config aplicada, ou Apache com `AllowOverride None`).
Com a regra ativa, esses links respondem um 301 para a URL limpa — um salto a mais por
clique, em troca de o site nunca quebrar.

Quando a reescrita estiver confirmada em produção, dá para trocar os links internos para
o formato limpo e eliminar esse redirect.

## `.git` dentro da pasta pública

Como o deploy é um `git pull` na própria pasta servida, o diretório `.git/` fica dentro
do webroot. Sem bloqueio, `/.git/config` e `/.git/HEAD` expõem o histórico do projeto e
podem revelar credenciais de acesso ao repositório.

O `.htaccess` (Apache) e o `nginx.conf.example` (Nginx) já negam esses caminhos. O
`robots.txt` também pede para não indexar, mas isso **não** é controle de acesso — a
regra no servidor é o que protege de fato.

Alternativa mais robusta, se um dia quiserem trocar o fluxo: publicar apenas os arquivos
do site (via `rsync` ou `git archive`), deixando o `.git` fora do diretório público.
