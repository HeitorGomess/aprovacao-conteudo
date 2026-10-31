# YS · Your Space

Aplicação React + TypeScript para planejar conteúdos, acompanhar revisões e aprovações em espaços privados por empresa.

## Requisitos

- Node.js 20+
- Um projeto Supabase

## Configuração do Supabase

1. Execute o arquivo completo [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) no SQL Editor do projeto conectado ao app. Ele configura as tabelas, o isolamento por empresa e os cargos; em instalações existentes, migra os conteúdos e acessos legados para o espaço `your-space`.
2. Em **Authentication → Providers → Email**, habilite o cadastro por e-mail e mantenha a confirmação de e-mail ativa.
3. Em **Authentication → URL Configuration**, configure como Site URL `https://heitorgomess.github.io/aprovacao-conteudo/` e adicione essa URL e `https://heitorgomess.github.io/aprovacao-conteudo/?auth=confirmed` às Redirect URLs. Adicione também `http://localhost:5173/aprovacao-conteudo/` e `http://localhost:5173/aprovacao-conteudo/?auth=confirmed` para desenvolvimento.
4. A conta confirmada `gomesheitorvp@gmail.com` é reconhecida como administradora geral. O SQL também a adiciona como administradora do espaço `Your Space`.

## Como funciona

- A home apresenta o produto e permite entrar ou criar uma conta.
- Depois de confirmar o e-mail e entrar, uma nova conta pode criar um painel para sua empresa e escolher um endereço único, como `/aprovacao-conteudo/empresa/minha-empresa`.
- A pessoa que cria o painel torna-se sua administradora e pode adicionar membros já cadastrados pelo e-mail na opção **Gerenciar equipe**.
- Cada painel tem membros, cargos e conteúdos próprios. Os cargos são **Administrador**, **Programador**, **Revisor** e **Sem acesso**. O acesso e as alterações são validados no Supabase; o link do painel, sozinho, não concede permissão.
- Os conteúdos antigos e os cargos legados são migrados para o espaço `Your Space` ao executar o SQL. As políticas antigas de leitura e gravação global são removidas no final do script.
- O link de recuperação de senha envia um e-mail para a conta informada. Configure as URLs de redirecionamento acima para retornar ao app.

O navegador usa somente a chave **publishable** do Supabase. Ela é pública por definição; nunca coloque chaves `secret` ou `service_role` no código. As tabelas usam RLS e as funções de gestão validam a associação e o cargo no workspace.

## Desenvolvimento local

```sh
npm install
npm start
```

## Importar planilha

Exporte a aba do Google Sheets como CSV. No painel, clique em **Importar CSV** e escolha o arquivo. São aceitos CSVs com colunas de título/data e o modelo de planejamento com linhas `Tema`, `Data` e `Dia`. No modelo de campanha, o ano é inferido pelos dias da semana; confirme as datas na visualização antes de usar os registros.

No modo de demonstração (`?demo=1`), as alterações existem apenas na sessão do navegador. Use `?demo=1&role=revisor` para visualizar a tela de revisão e `?demo=1&role=admin&admin=1` para experimentar a gestão de equipe.

## Deploy

O workflow [deploy.yml](./.github/workflows/deploy.yml) compila a aplicação React e publica `dist` no GitHub Pages a cada push para `main`. O arquivo `public/404.html` restaura rotas de painéis como `/empresa/minha-empresa` no Pages. Em **Settings → Pages**, selecione **GitHub Actions** como origem do deploy.
