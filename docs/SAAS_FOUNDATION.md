# Fundação SaaS, white-label e ciclo de vida do SQLite

Este documento descreve a fundação de autenticação, usuários, configuração por deployment e persistência local da plataforma atuarial.

## White-label por deployment

O core não possui nome institucional fixo. O mesmo build pode ser usado por entidades diferentes alterando apenas configuração de runtime:

```env
APP_NAME=Plataforma Atuarial
APP_SHORT_NAME=Atuária
APP_ORGANIZATION_NAME=
```

`APP_NAME` é o nome completo exibido no login, título do navegador e documentação da API. `APP_SHORT_NAME` é usado na navegação lateral. `APP_ORGANIZATION_NAME` é opcional e identifica a entidade que está operando aquele deployment.

O frontend consulta `GET /api/config`, uma rota pública que expõe somente esses dados de apresentação. Nenhuma identidade de organização é compilada no bundle como requisito para funcionamento.

## Autenticação

A aplicação usa contas locais persistidas no próprio banco e sessões bearer opacas.

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
4. a sessão recebe validade configurável por `APP_SESSION_TTL_DAYS`;
5. logout, troca de senha ou desativação revogam a sessão.

`user_sessions.userId` possui chave estrangeira para `users.id` com `ON DELETE CASCADE`.

A verificação de sessão usa lookup pela coluna única `tokenHash`, e não varredura da tabela inteira.

### Autorização

O backend usa a autenticação bearer nativa do `adorn-api`.

- `/api/health` é público;
- `/api/config` é público;
- `/api/auth/login` é público;
- as rotas funcionais exigem usuário autenticado;
- `/api/users/*` exige perfil `admin`;
- o backend impede desativar ou rebaixar o último administrador ativo.

O primeiro administrador não possui senha padrão no código. Quando a tabela de usuários está vazia, ele pode ser criado uma única vez com:

```env
APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
APP_BOOTSTRAP_ADMIN_PASSWORD=uma-senha-forte
APP_BOOTSTRAP_ADMIN_NAME=Administrador
```

Depois que já existe algum usuário, essas variáveis não recriam nem sobrescrevem contas.

## SQLite

### Arquivo

O caminho é configurado por:

```env
APP_DB_PATH=./data/actuarial.sqlite
```

Caminhos relativos são resolvidos a partir da raiz do repositório, independentemente do diretório corrente usado para iniciar o backend. O arquivo, WAL, SHM e todo o diretório `/data/` são ignorados pelo Git.

O storage privado de uploads usa, por padrão:

```env
APP_STORAGE_PATH=./data/storage
```

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
- **demo**: planos, avaliações, perfis e providers genéricos de exemplo; somente quando `APP_SEED_DEMO=true`.

Produção deve manter:

```env
APP_SEED_DEMO=false
```

O seed opcional de IA usa apenas nomes genéricos (`OpenAI-compatible` e `OpenAI`) e referências como `APP_LLM_KEY_1` e `OPENAI_API_KEY`; não carrega identidade ou infraestrutura de uma organização específica.

### Encerramento

O servidor trata `SIGINT` e `SIGTERM`, fecha primeiro o listener HTTP e depois fecha a conexão SQLite. Isso reduz risco de encerrar o processo com escrita ainda em trânsito.

## Estratégia de implantação

SQLite continua sendo uma boa escolha enquanto cada deployment for executado como uma única instância de aplicação com volume local persistente e backup do arquivo.

```text
1 processo/contêiner
        │
        ├── volume persistente
        │     ├── actuarial.sqlite
        │     ├── actuarial.sqlite-wal
        │     └── actuarial.sqlite-shm
        │
        └── storage privado de imports
```

Não se deve colocar o mesmo arquivo SQLite em um filesystem de rede e permitir vários pods independentes gravando nele como estratégia de escala horizontal.

Quando houver necessidade real de múltiplas instâncias simultâneas, failover ativo ou volume elevado de escritores concorrentes, a persistência operacional deve migrar para PostgreSQL. A separação por entidades, serviços e dialeto do Metal-ORM existe justamente para que essa mudança não contamine as regras atuariais.

## Multi-entidade

White-label e multi-tenant são problemas diferentes. A configuração atual permite vários deployments independentes, cada um com nome e entidade próprios, sem fork de código.

Se no futuro uma única instalação precisar hospedar várias entidades simultaneamente, isso deverá entrar como um slice explícito de tenancy, com isolamento de dados, autorização e auditoria por `tenantId`. O core não deve presumir uma organização específica para facilitar essa evolução.

## Próximos hardenings SaaS

A fundação atual cobre login, sessão, usuários, RBAC básico e branding por deployment. Ainda são slices separados:

- recuperação/troca de senha pelo próprio usuário;
- MFA;
- auditoria de ações administrativas e atuariais;
- rate limiting e bloqueio progressivo de tentativas de login;
- tenancy real, caso uma instalação passe a atender várias entidades ao mesmo tempo;
- política automatizada de backup e restore testado do SQLite;
- expurgo periódico de sessões expiradas/revogadas.
