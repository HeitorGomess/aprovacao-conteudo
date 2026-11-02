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
5. Os usuários podem criar a própria conta na tela de login. Depois de confirmar o e-mail e entrar, recebem automaticamente um espaço de trabalho pessoal com perfil de administrador. Participar de outras empresas é opcional e não é necessário para começar a usar o painel.

Se o cadastro mostrar `email rate limit exceeded`, a cota de e-mails foi atingida. Ela é diferente do limite de requisições de cadastro/login: a cota de e-mails é compartilhada pelo projeto e inclui confirmações e outros e-mails de autenticação enviados, inclusive reenvios e recuperações de senha. O SMTP padrão do Supabase permite somente 2 e-mails por hora. Para usar a cota configurada em **Authentication → Rate Limits → Emails sent**, é necessário ter um SMTP personalizado ativo ou um Send Email Hook; confira também a cota do próprio provedor. Configure o SMTP em [Authentication → SMTP](https://supabase.com/dashboard/project/rinsachmljzzzvcgqowi/auth/smtp) e revise os limites em [Authentication → Rate Limits](https://supabase.com/dashboard/project/rinsachmljzzzvcgqowi/auth/rate-limits). Não existe envio literalmente ilimitado.

O SQL migra as publicações atuais para a empresa principal **Your Space** (`your-space`) e preserva as publicações já vinculadas a outras empresas. Também cria um espaço pessoal, com acesso de administrador, para cada conta confirmada existente e prepara a criação automática para novas contas após a confirmação do e-mail. A conta `gomesheitorvp@gmail.com` permanece como administradora geral e administradora do Your Space. Se ela já existir e estiver confirmada, a configuração é aplicada ao executar o SQL.

Na aplicação, use o seletor no topo para alternar entre empresas ou **+ Nova empresa** para criar uma. O menu **Perfil** reúne a navegação para o painel, as configurações do perfil e a criação de empresas. Em **Gerenciar empresa**, administradores podem administrar a equipe, renomear ou arquivar a empresa; arquivar preserva conteúdos e equipe, e a restauração fica disponível na lista de empresas arquivadas. Também é possível excluir permanentemente uma empresa arquivada; a confirmação informa que essa ação apaga todos os conteúdos e membros e não pode ser desfeita. O Your Space principal não pode ser arquivado nem excluído. Administradores também podem adicionar contas com e-mail confirmado e definir o perfil **Administrador**, **Programador** ou **Revisor** naquela empresa; remover alguém de uma equipe não altera o acesso dessa pessoa às outras empresas. O administrador geral pode visualizar e gerenciar as equipes de todas as empresas, mas espaços pessoais aparecem apenas para seus proprietários.

O botão de tema no cabeçalho oferece **Claro**, **Escuro** e **Sistema**. O modo **Claro** é o padrão na primeira visita; **Sistema**, quando selecionado, acompanha a preferência do navegador. O botão mostra o sol no modo claro e a lua no modo escuro. A escolha fica salva no próprio navegador e é aplicada antes da interface aparecer. O botão também está disponível nas telas de acesso, equipe, administração e perfil.

Em **Perfil → Configuração**, cada usuário pode atualizar o nome e a foto exibidos para sua equipe. Em **Gerenciar empresa → Configuração**, administradores também podem definir ou remover a foto da empresa ou do espaço pessoal; ela aparece no seletor de empresas, com iniciais como fallback. O e-mail da conta é mostrado como somente leitura. Para habilitar o envio e a exibição das fotos, execute novamente o arquivo completo `SUPABASE_SETUP.sql`; ele cria buckets públicos para os avatares, limita os arquivos a 5 MB, permite que cada usuário altere somente a própria foto de perfil e restringe fotos de empresa aos administradores daquele espaço e aos administradores gerais. Se o Supabase bloquear o envio por RLS, execute novamente essa versão atualizada do SQL no SQL Editor.

Para reduzir o tempo de carregamento, fotos de perfil e empresa são redimensionadas e convertidas para WebP antes do envio; GIFs mantêm a animação. O calendário carrega as capas apenas para o mês exibido, e as imagens abaixo da área visível são carregadas sob demanda. O `SUPABASE_SETUP.sql` cria um índice de empresa/data para acelerar essa consulta.

Na mesma tela, **Deletar conta** abre uma confirmação antes da exclusão permanente. A conta, o espaço pessoal e seus conteúdos são excluídos; a participação nas demais empresas é removida, mas os espaços e conteúdos delas são preservados. Se a conta possuir outra empresa, a propriedade é transferida para um administrador existente. Para uma empresa sem outro administrador, é necessário promover alguém antes de excluir a conta. A função protegida exige a sessão autenticada e é instalada pelo `SUPABASE_SETUP.sql`.

Execute o arquivo completo [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor do Supabase para instalar as funções, as políticas RLS e o isolamento de publicações por empresa. Execute-o novamente para aplicar a criação automática dos espaços pessoais e migrar contas confirmadas existentes; a operação preserva os registros existentes. O espaço pessoal não pode ser arquivado nem excluído. O arquivamento de outras empresas mantém os conteúdos e membros vinculados, e a restauração devolve o acesso. A exclusão permanente fica restrita a empresas arquivadas e administradores e remove em cascata seus conteúdos e membros.

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

Para verificar os temas localmente, abra `http://localhost:5173/aprovacao-conteudo/?demo=1` e alterne entre **Claro**, **Escuro** e **Sistema**. Repita nas visualizações Cards, Calendário e Tabela, no formulário de novo conteúdo e nas telas `?demo=1&role=admin&profile=1`, `?demo=1&role=admin&team=1` e `?demo=1&admin=1`. Recarregue em cada opção para confirmar a persistência; em **Sistema**, altere a preferência de aparência do navegador e confirme que uma escolha manual de **Claro** continua clara.

## Deploy

O workflow [deploy.yml](./.github/workflows/deploy.yml) compila a aplicação React e publica `dist` no GitHub Pages a cada push para `main`. Em **Settings → Pages**, selecione **GitHub Actions** como origem do deploy.
