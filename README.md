# Aprovação de Conteúdo

Aplicação React + TypeScript para planejar conteúdos, acompanhar revisões e aprovações. O Supabase mantém os dados sincronizados entre os editores.

## Requisitos

- Node.js 20+
- Um projeto Supabase

## Supabase

1. Execute [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor do projeto.
2. Em **Authentication → Providers → Email**, habilite o cadastro por e-mail e mantenha a confirmação de e-mail ativa.
3. Crie uma conta para `gomesheitorvp@gmail.com` pela página inicial e confirme o endereço. O SQL configura essa conta como administradora geral e programadora, automaticamente. Se ela já existir e estiver confirmada, a configuração também é aplicada ao executar o SQL.
4. Em **Authentication → URL Configuration**, configure a URL publicada (incluindo o caminho do GitHub Pages, se houver) como Site URL e Redirect URL. Adicione também a URL de confirmação usada pelo cadastro, com `?auth=confirmed` ao final; por exemplo, `https://seu-site.com/?auth=confirmed` ou `https://seu-usuario.github.io/marketing-content-dashboard/?auth=confirmed`. Para desenvolvimento, adicione também `http://localhost:5173/aprovacao-conteudo/?auth=confirmed`.
5. Os usuários podem criar a própria conta na tela de login. Após confirmar o e-mail, recebem automaticamente o perfil **Revisor**. O administrador pode alterar o perfil para **Programador**, **Revisor** ou **Sem acesso** em **Gerenciar acessos**. A lista é atualizada ao voltar para a aba e periodicamente; as alterações são salvas imediatamente. Administradores não podem ser rebaixados por essa tela.

Para ativar a atribuição automática de Revisor em contas confirmadas, execute novamente o arquivo completo `SUPABASE_SETUP.sql` no SQL Editor do Supabase. A regra não substitui perfis existentes definidos pelo administrador e mantém a conta principal como administradora/programadora.

Se o setup multiempresa anterior já foi executado, execute novamente este arquivo completo. Ele retorna ao painel único: preserva as publicações, migra os cargos do espaço `your-space` para os acessos antigos, remove as funções multiempresa antigas e atualiza o cache de funções do Supabase.

Se a gestão mostrar `structure of query does not match function result type`, execute novamente no SQL Editor a definição atualizada da função `public.list_panel_accounts()` neste arquivo. Os casts explícitos mantêm os tipos de retorno consistentes em projetos onde `auth.users.email` ou `panel_editors.role` têm tipos diferentes.

Ao confirmar o e-mail, a pessoa volta para a tela de login e entra com a senha cadastrada. O perfil escolhido pelo administrador continua salvo no Supabase e é aplicado quando ela entrar; confirme que a função `list_panel_accounts` e as tabelas estão configuradas executando o SQL acima. O link **Esqueci minha senha** envia uma mensagem de recuperação para o e-mail informado. Configure a URL local e publicada como Redirect URL do Supabase para que o link retorne ao app.

O cliente usa uma chave **publishable** no navegador. Ela é pública por definição; nunca coloque chaves `secret` ou `service_role` no código. A tabela tem RLS habilitado: programadores editam, revisores leem os conteúdos e enviam pareceres pela função controlada do banco, e administradores gerenciam os perfis por funções restritas.

O painel do revisor mostra publicações em revisão, aprovadas e devolvidas para ajustes nas visualizações Cards, Calendário e Tabela; rascunhos continuam restritos aos programadores. Para habilitar a leitura dos pareceres já registrados, execute novamente o arquivo completo [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor.

Administradores podem abrir uma publicação e usar **Resetar observações** para apagar todos os pareceres dos revisores daquele conteúdo. O status, o histórico e as observações de produção são preservados. A função protegida do banco exige que um administrador esteja autenticado; execute novamente o `SUPABASE_SETUP.sql` no SQL Editor para habilitá-la.

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
