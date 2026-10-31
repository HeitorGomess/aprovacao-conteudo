# Aprovação de Conteúdo

Aplicação React + TypeScript para planejar conteúdos, acompanhar revisões e aprovações. O Supabase mantém os dados sincronizados entre os editores.

## Requisitos

- Node.js 20+
- Um projeto Supabase

## Supabase

1. Execute [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor do projeto.
2. Em **Authentication → Providers → Email**, desative novos cadastros públicos.
3. Em **Authentication → Users**, convide as pessoas que poderão acessar o painel.
4. No SQL Editor, autorize cada usuário convidado e defina o perfil. Programadores podem criar, importar, editar e excluir conteúdos. Revisores veem apenas publicações em revisão e podem aprová-las ou pedir alterações com um comentário. Exemplo para um programador:

   ```sql
   insert into public.panel_editors (user_id)
   select id from auth.users where email = 'programador@exemplo.com'
   on conflict (user_id) do update set role = 'programador';
   ```

   Para autorizar um revisor:

   ```sql
   insert into public.panel_editors (user_id, role)
   select id, 'revisor' from auth.users where email = 'revisor@exemplo.com'
   on conflict (user_id) do update set role = excluded.role;
   ```

   Para alterar um perfil, use `update public.panel_editors set role = 'revisor' where user_id = (select id from auth.users where email = 'editor@exemplo.com');`. Os perfis e as políticas RLS são aplicados pelo script de setup. A decisão de revisão é registrada por uma função do banco; revisores não recebem permissão para editar diretamente os conteúdos.
5. Em **Authentication → URL Configuration**, configure a URL do GitHub Pages como Site URL e Redirect URL.

O cliente usa uma chave **publishable** no navegador. Ela é pública por definição; nunca coloque chaves `secret` ou `service_role` no código. A tabela tem RLS habilitado e restringe operações aos usuários explicitamente autorizados em `panel_editors`.

## Desenvolvimento local

```sh
npm install
npm start
```

## Importar planilha

Exporte a aba do Google Sheets como CSV. No painel, clique em **Importar CSV** e escolha o arquivo. São aceitos CSVs com colunas de título/data e o modelo de planejamento com linhas `Tema`, `Data` e `Dia`. No modelo de campanha, o ano é inferido pelos dias da semana; confirme as datas na visualização antes de usar os registros.

No modo de demonstração (`?demo=1`), as alterações existem apenas na sessão do navegador. Use `?demo=1&role=revisor` para visualizar a tela de revisão. Na versão normal, os registros são gravados no Supabase e exigem uma conta com perfil autorizado.

## Deploy

O workflow [deploy.yml](./.github/workflows/deploy.yml) compila a aplicação React e publica `dist` no GitHub Pages a cada push para `main`. Em **Settings → Pages**, selecione **GitHub Actions** como origem do deploy.
