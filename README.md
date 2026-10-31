# Aprovação de Conteúdo

Aplicação React + TypeScript para planejar conteúdos, acompanhar revisões e aprovações. O Supabase mantém os dados sincronizados entre os editores.

## Requisitos

- Node.js 20+
- Um projeto Supabase

## Supabase

1. Execute [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor do projeto.
2. Em **Authentication → Providers → Email**, desative novos cadastros públicos.
3. Em **Authentication → Users**, convide as pessoas que poderão acessar o painel.
4. Conceda o perfil de administrador ao responsável pelo painel uma única vez, substituindo pelo e-mail da conta já cadastrada:

   ```sql
   insert into public.panel_admins (user_id)
   select id from auth.users where email = 'admin@exemplo.com'
   on conflict do nothing;
   ```

   Se essa conta também for programadora, autorize-a para o calendário:

   ```sql
   insert into public.panel_editors (user_id, role)
   select id, 'programador' from auth.users where email = 'admin@exemplo.com'
   on conflict (user_id) do update set role = excluded.role;
   ```

   Depois, abra **Gerenciar acessos** no painel. Essa tela lista as contas existentes em Authentication → Users. Selecione **Programador**, **Revisor** ou **Sem acesso**; a alteração é salva imediatamente. Administradores não podem ser rebaixados por essa tela. A conta deve existir no Supabase antes de receber um perfil.
5. Em **Authentication → URL Configuration**, configure a URL do GitHub Pages como Site URL e Redirect URL.

O cliente usa uma chave **publishable** no navegador. Ela é pública por definição; nunca coloque chaves `secret` ou `service_role` no código. A tabela tem RLS habilitado: programadores editam, revisores leem os conteúdos e enviam pareceres pela função controlada do banco, e administradores gerenciam os perfis por funções restritas.

## Desenvolvimento local

```sh
npm install
npm start
```

## Importar planilha

Exporte a aba do Google Sheets como CSV. No painel, clique em **Importar CSV** e escolha o arquivo. São aceitos CSVs com colunas de título/data e o modelo de planejamento com linhas `Tema`, `Data` e `Dia`. No modelo de campanha, o ano é inferido pelos dias da semana; confirme as datas na visualização antes de usar os registros.

No modo de demonstração (`?demo=1`), as alterações existem apenas na sessão do navegador. Use `?demo=1&role=revisor` para visualizar a tela de revisão e `?demo=1&role=admin&admin=1` para experimentar a administração de acessos. Na versão normal, os registros são gravados no Supabase e exigem uma conta com perfil autorizado.

## Deploy

O workflow [deploy.yml](./.github/workflows/deploy.yml) compila a aplicação React e publica `dist` no GitHub Pages a cada push para `main`. Em **Settings → Pages**, selecione **GitHub Actions** como origem do deploy.
