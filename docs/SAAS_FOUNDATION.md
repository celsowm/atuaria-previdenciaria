# Fundação SaaS e ciclo de vida do SQLite

Este documento descreve a fundação de autenticação, usuários, configuração por deployment e persistência local do **Atuária Previdenciária**.

## Produto e organização do deployment

O nome do produto é fixo e corresponde ao repositório:

```text
Atuária Previdenciária
atuaria-previdenciaria
```

O que varia por deployment é somente a organização/UE que opera aquela instância:

```env
APP_ORGANIZATION_NAME=
```

O frontend consulta `GET /api/config`, uma rota pública que expõe o nome do produto e, opcionalmente, a organização da instância. A organização pode aparecer como contexto institucional no login, sidebar e título do navegador, mas não renomeia o sistema.

## Autenticação

A aplicação usa contas locais persistidas no próprio banco e sessões bearer opacas.

### Usuários

A entidade `Usuario` é a fonte de verdade para:

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
- `/api/usuarios/*` exige perfil `admin`;
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
APP_DB_PATH=./data/atuaria-previdenciaria.sqlite
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
        │     ├── atuaria-previdenciaria.sqlite
        │     ├── atuaria-previdenciaria.sqlite-wal
        │     └── atuaria-previdenciaria.sqlite-shm
        │
        └── storage privado de imports
```

Não se deve colocar o mesmo arquivo SQLite em um filesystem de rede e permitir vários pods independentes gravando nele como estratégia de escala horizontal.

Quando houver necessidade real de múltiplas instâncias simultâneas, failover ativo ou volume elevado de escritores concorrentes, a persistência operacional deve migrar para PostgreSQL. A separação por entidades, serviços e dialeto do Metal-ORM existe justamente para que essa mudança não contamine as regras atuariais.

## Multi-entidade

O produto poder ser usado por diferentes UEs não significa que seu nome seja variável. Cada UE pode operar um deployment independente do **Atuária Previdenciária**, identificado por `APP_ORGANIZATION_NAME`.

Se no futuro uma única instalação precisar hospedar várias entidades simultaneamente, isso deverá entrar como um slice explícito de tenancy, com isolamento de dados, autorização e auditoria por `tenantId`.

## Próximos hardenings SaaS

A fundação atual cobre login, sessão, usuários e RBAC básico. Ainda são slices separados:

- recuperação/troca de senha pelo próprio usuário;
- MFA;
- auditoria de ações administrativas e atuariais;
- rate limiting e bloqueio progressivo de tentativas de login;
- tenancy real, caso uma instalação passe a atender várias entidades ao mesmo tempo;
- política automatizada de backup e restore testado do SQLite;
- expurgo periódico de sessões expiradas/revogadas.
