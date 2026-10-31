# Aprovação de Conteúdo

Aplicação React + TypeScript para planejar conteúdos, acompanhar revisões e aprovações. O Supabase mantém os dados sincronizados entre os editores.

## Requisitos

- Node.js 20+
- Um projeto Supabase

## Supabase

1. Execute [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor do projeto.
2. Em **Authentication → Providers → Email**, desative novos cadastros públicos.
3. Em **Authentication → Users**, convide as pessoas que poderão acessar o painel.
4. No SQL Editor, autorize cada usuário convidado, substituindo o e-mail:

   ```sql
   insert into public.panel_editors (user_id)
   select id from auth.users where email = 'editor@exemplo.com'
   on conflict do nothing;
   ```

   Somente os usuários incluídos em `panel_editors` podem ler ou alterar os conteúdos compartilhados.
5. Em **Authentication → URL Configuration**, configure a URL do GitHub Pages como Site URL e Redirect URL.

O cliente usa uma chave **publishable** no navegador. Ela é pública por definição; nunca coloque chaves `secret` ou `service_role` no código. A tabela tem RLS habilitado e restringe operações aos usuários explicitamente autorizados em `panel_editors`.

## Desenvolvimento local

```sh
npm install
npm start
```

## Importar planilha

Exporte a aba do Google Sheets como CSV. No painel, clique em **Importar CSV** e escolha o arquivo. São aceitos CSVs com colunas de título/data e o modelo de planejamento com linhas `Tema`, `Data` e `Dia`. No modelo de campanha, o ano é inferido pelos dias da semana; confirme as datas na visualização antes de usar os registros.

No modo de demonstração (`?demo=1`), a importação existe apenas na sessão do navegador. Na versão normal, os registros são gravados no Supabase e exigem uma conta autorizada.

## Deploy

O workflow [deploy.yml](./.github/workflows/deploy.yml) compila a aplicação React e publica `dist` no GitHub Pages a cada push para `main`. Em **Settings → Pages**, selecione **GitHub Actions** como origem do deploy.
