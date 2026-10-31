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
5. Os usuários podem criar a própria conta na tela de login. Depois de confirmar o e-mail, podem criar uma empresa ou pedir para um administrador adicioná-los a uma equipe. Uma conta confirmada não recebe acesso automático às empresas existentes.

O SQL migra as publicações atuais para a empresa principal **Your Space** (`your-space`) e preserva as publicações já vinculadas a outras empresas. A conta `gomesheitorvp@gmail.com` permanece como administradora geral e administradora do Your Space. Se ela já existir e estiver confirmada, a configuração é aplicada ao executar o SQL.

Na aplicação, use o seletor no topo para alternar entre empresas ou **+ Nova empresa** para criar uma. O menu **Perfil** reúne a navegação para o painel, as configurações do perfil e a criação de empresas. Em **Gerenciar empresa**, administradores podem administrar a equipe, renomear ou arquivar a empresa; arquivar preserva conteúdos e equipe, e a restauração fica disponível na lista de empresas arquivadas. O Your Space principal não pode ser arquivado. Administradores também podem adicionar contas com e-mail confirmado e definir o perfil **Administrador**, **Programador** ou **Revisor** naquela empresa; remover alguém de uma equipe não altera o acesso dessa pessoa às outras empresas. O administrador geral pode visualizar e gerenciar as equipes de todas as empresas.

Em **Perfil → Configuração**, cada usuário pode atualizar o nome e a foto exibidos para sua equipe. O e-mail da conta é mostrado como somente leitura. Para habilitar o envio e a exibição das fotos, execute novamente o arquivo completo `SUPABASE_SETUP.sql`; ele cria o bucket público de avatares, limita os arquivos a 5 MB e permite que cada usuário altere somente a própria foto.

Execute o arquivo completo `SUPABASE_SETUP.sql` no SQL Editor do Supabase antes de testar a criação, renomeação, arquivamento e troca de empresas. Ele instala as funções, as políticas RLS e o isolamento de publicações por empresa. Reexecutá-lo preserva os registros existentes; o arquivamento mantém os conteúdos e membros vinculados, e a restauração devolve o acesso à empresa. A atribuição automática do perfil padrão de Revisor não concede acesso a nenhuma empresa até que a pessoa seja adicionada à equipe.

Ao confirmar o e-mail, a pessoa volta para a tela de login e entra com a senha cadastrada. O perfil escolhido pelo administrador continua salvo no Supabase e é aplicado quando ela entrar; confirme que a função `list_panel_accounts` e as tabelas estão configuradas executando o SQL acima. O link **Esqueci minha senha** envia uma mensagem de recuperação para o e-mail informado. Configure a URL local e publicada como Redirect URL do Supabase para que o link retorne ao app.

O cliente usa uma chave **publishable** no navegador. Ela é pública por definição; nunca coloque chaves `secret` ou `service_role` no código. O RLS isola as publicações e equipes por empresa: programadores editam, revisores leem conteúdos em revisão, aprovados e devolvidos para ajustes, e administradores gerenciam os perfis locais por funções protegidas do banco.

O painel do revisor mostra publicações em revisão, aprovadas e devolvidas para ajustes nas visualizações Cards, Calendário e Tabela; rascunhos continuam restritos aos programadores. Para habilitar a leitura dos pareceres já registrados, execute novamente o arquivo completo [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor.

Administradores podem abrir uma publicação e usar **Resetar observações** para apagar todos os pareceres dos revisores daquele conteúdo. O status, o histórico e as observações de produção são preservados. A função protegida do banco exige que um administrador esteja autenticado; execute novamente o `SUPABASE_SETUP.sql` no SQL Editor para habilitá-la.

## Desenvolvimento local

```sh
npm install
npm start
```

## Importar planilha

Exporte a aba do Google Sheets como CSV. No painel, clique em **Importar CSV** e escolha o arquivo. São aceitos CSVs com colunas de título/data e o modelo de planejamento com linhas `Tema`, `Data` e `Dia`. No modelo de campanha, o ano é inferido pelos dias da semana; confirme as datas na visualização antes de usar os registros.

No modo de demonstração (`?demo=1`), as alterações existem apenas na sessão do navegador. Use `?demo=1&role=revisor` para visualizar a tela de revisão e `?demo=1&role=admin&admin=1` para experimentar a administração. Na versão normal, os registros são gravados no Supabase e exigem uma conta com acesso à empresa selecionada.

## Deploy

O workflow [deploy.yml](./.github/workflows/deploy.yml) compila a aplicação React e publica `dist` no GitHub Pages a cada push para `main`. Em **Settings → Pages**, selecione **GitHub Actions** como origem do deploy.
