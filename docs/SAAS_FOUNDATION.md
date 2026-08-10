# Fundação SaaS e ciclo de vida do SQLite

Este documento descreve a fundação de autenticação, usuários e persistência local do ATUAS.

## Autenticação

O ATUAS usa contas locais persistidas no próprio banco e sessões bearer opacas.

### Usuários

A entidade `User` é a fonte de verdade para:

- e-mail normalizado e único;
- nome de exibição;
- hash de senha;
- perfil (`admin`, `actuary` ou `reviewer`);
- estado ativo/inativo;
- datas de criação, alteração e último login.

Senhas nunca são persistidas em claro. O backend usa `scrypt` com salt aleatório por senha e comparação em tempo constante.

### Sessões

Ao autenticar:

1. o backend gera 32 bytes aleatórios;
2. o token bruto é devolvido uma única vez ao cliente;
3. somente `SHA-256(token)` é persistido em `user_sessions`;
4. a sessão recebe validade configurável por `ATUAS_SESSION_TTL_DAYS`;
5. logout, troca de senha ou desativação revogam a sessão.

`user_sessions.userId` possui chave estrangeira para `users.id` com `ON DELETE CASCADE`.

A verificação de sessão usa lookup pela coluna única `tokenHash`, e não varredura da tabela inteira.

### Autorização

O backend usa a autenticação bearer nativa do `adorn-api`.

- `/api/health` é público;
- `/api/auth/login` é público;
- as rotas funcionais exigem usuário autenticado;
- `/api/users/*` exige perfil `admin`;
- o backend impede desativar ou rebaixar o último administrador ativo.

O primeiro administrador não possui senha padrão no código. Quando a tabela de usuários está vazia, ele pode ser criado uma única vez com:

```env
ATUAS_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
ATUAS_BOOTSTRAP_ADMIN_PASSWORD=uma-senha-forte
ATUAS_BOOTSTRAP_ADMIN_NAME=Administrador ATUAS
```

Depois que já existe algum usuário, essas variáveis não recriam nem sobrescrevem contas.

## SQLite

### Arquivo

O caminho é configurado por:

```env
ATUAS_DB_PATH=./data/atuas.sqlite
```

O arquivo e seus sidecars de WAL são ignorados pelo Git. Dados de produção nunca devem ser versionados.

### Inicialização

Na subida do backend:

1. o diretório do banco é criado quando necessário;
2. a conexão SQLite é aberta;
3. são aplicados os pragmas operacionais;
4. o Metal-ORM introspecta o schema real;
5. as entidades anotadas são sincronizadas com `allowDestructive: false`;
6. dados de referência idempotentes são carregados;
7. dados de demonstração somente são carregados quando explicitamente habilitados;
8. o ORM fica disponível para as sessões da aplicação.

Pragmas atuais:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

Transações iniciadas pelo adaptador SQLite usam `BEGIN IMMEDIATE`, reduzindo surpresas de promoção tardia de uma transação de leitura para escrita.

### Evolução do schema

As entidades do Metal-ORM são a fonte de verdade do schema. O bootstrap chama `introspectSchema` e `synchronizeSchema` com:

```ts
{ allowDestructive: false }
```

Assim, a aplicação pode criar/adicionar estruturas necessárias, mas não deve apagar silenciosamente colunas ou tabelas existentes durante a inicialização.

Alterações destrutivas futuras devem ser tratadas como migrações explícitas e revisáveis, com backup anterior do arquivo SQLite.

### Seeds

Existem dois tipos diferentes de seed:

- **referência**: regras determinísticas necessárias à aplicação; idempotentes e sempre aplicadas;
- **demo**: avaliações, perfis e providers de exemplo; somente quando `ATUAS_SEED_DEMO=true`.

Produção deve manter:

```env
ATUAS_SEED_DEMO=false
```

### Encerramento

O servidor trata `SIGINT` e `SIGTERM`, fecha primeiro o listener HTTP e depois fecha a conexão SQLite. Isso reduz risco de encerrar o processo com escrita ainda em trânsito.

## Estratégia de implantação

SQLite continua sendo uma boa escolha enquanto o ATUAS for executado como uma única instância de aplicação com volume local persistente e backup do arquivo.

Recomendação para esse estágio:

```text
1 processo/contêiner ATUAS
        │
        ├── volume persistente
        │     ├── atuas.sqlite
        │     ├── atuas.sqlite-wal
        │     └── atuas.sqlite-shm
        │
        └── storage privado de imports
```

Não se deve colocar o mesmo arquivo SQLite em um filesystem de rede e permitir vários pods independentes gravando nele como estratégia de escala horizontal.

Quando houver necessidade real de múltiplas instâncias simultâneas, failover ativo ou volume elevado de escritores concorrentes, a persistência operacional deve migrar para PostgreSQL. A separação por entidades, serviços e dialeto do Metal-ORM existe justamente para que essa mudança não contamine as regras atuariais.

## Próximos hardenings SaaS

A fundação atual cobre login, sessão, usuários e RBAC básico. Ainda são slices separados:

- recuperação/troca de senha pelo próprio usuário;
- MFA;
- auditoria de ações administrativas e atuariais;
- rate limiting e bloqueio progressivo de tentativas de login;
- organizações/tenants, caso o produto passe a atender várias entidades isoladas no mesmo deployment;
- política automatizada de backup e restore testado do SQLite;
- expurgo periódico de sessões expiradas/revogadas.
