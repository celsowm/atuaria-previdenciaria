# Atuária Previdenciária

Plataforma web para conduzir o ciclo de avaliações atuariais de previdência complementar, substituindo progressivamente aplicações legadas, planilhas operacionais, cálculos estatísticos manuais e fluxos documentais dispersos.

O projeto é **white-label por deployment**: o core não pressupõe nome de produto nem organização específica. Nome, nome curto e entidade são configurados em runtime.

## Fundação atual

A base funcional inclui:

- monorepo TypeScript;
- backend com `adorn-api`;
- SQLite com `metal-orm` e entities anotadas;
- schema sincronizado a partir das entities;
- frontend React + Material UI;
- OpenAPI + contratos gerados por `better-openapi-typescript`;
- autenticação bearer, usuários e RBAC básico;
- branding configurável por deployment;
- cadastro de Planos BD/CD/CV;
- Dashboard e Workspace de Avaliação;
- Data Studio com wizard XLSX/XLS/CSV;
- mapping N:N e transformações;
- persistência auditável `RAW → NORMALIZED → CANONICAL`;
- Mapping Profiles versionados e detecção de mudança de layout;
- Crítica Cadastral determinística e comparação com exercício anterior;
- Biblioteca de Tábuas Biométricas versionada;
- derivação imutável por escala de qx e deslocamento etário;
- Hypothesis Lab com observado × esperado, χ², KS, Z, Fisher e DQM;
- ranking persistido das versões biométricas candidatas;
- fundação para providers LLM OpenAI-compatible.

## White-label

O mesmo build pode ser usado por entidades diferentes sem fork de código:

```env
APP_NAME=Plataforma Atuarial
APP_SHORT_NAME=Atuária
APP_ORGANIZATION_NAME=
```

O backend expõe a configuração pública em:

```text
GET /api/config
```

O frontend usa esse endpoint para nome do login, sidebar e título do navegador. `APP_ORGANIZATION_NAME` pode ser diferente em cada deployment.

White-label não é o mesmo que multi-tenant: hoje a arquitetura suporta deployments independentes por entidade. Uma instalação única atendendo várias entidades deverá ganhar isolamento explícito por tenant em um slice próprio.

## Arquitetura

```text
atuaria-previdenciaria/
├── apps/
│   ├── backend/               # Adorn API + Metal ORM + SQLite
│   └── frontend/              # React + MUI
├── docs/
├── openapi/                   # snapshot base + fragmentos por domínio
└── package.json               # npm workspaces
```

Os workspaces são:

```text
@atuaria-previdenciaria/backend
@atuaria-previdenciaria/frontend
```

O domínio é organizado ao redor de uma **Avaliação Atuarial**:

```text
Dados
  ↓
Crítica cadastral
  ↓
Hipóteses
  ↓
Aderência
  ↓
Parametrização
  ↓
Cálculo
  ↓
Fechamento
  ↓
Documentos
  ↓
Regulatório
```

## Data Studio

A massa não é importada cegamente:

```text
Arquivo → Estrutura → Mapping → Transformações → Preview → Validação → Concluir
```

O mapping é N:N e permite, por exemplo:

```text
DIA_NASC + MES_NASC + ANO_NASC
              ↓
       Data de nascimento
```

```text
CPF_MATRICULA
      ↓ split "-"
CPF + Matrícula
```

```text
SAL_BASE + GRATIFICACAO + ADICIONAL
                 ↓ soma
        Salário de contribuição
```

O browser exibe preview, mas o resultado oficial é recalculado no backend a partir do arquivo original.

```text
arquivo original
      │
      ├── SHA-256 + storage imutável
      │
      ▼
     RAW
      ↓
 NORMALIZED
      ↓
 CANONICAL
      ↓
 validação estrutural
      ↓
 crítica cadastral
```

## Crítica Cadastral

O motor trabalha sobre o CANONICAL persistido e gera ocorrências próprias, separadas das falhas estruturais da importação.

```text
CritiqueRule
    ↓
CritiqueRun
    ↓
CritiqueIssue
```

As severidades são `BLOCKING`, `INCONSISTENCY`, `WARNING` e `INFO`. Uma ocorrência tratada passa para `RESOLVED`, `JUSTIFIED` ou `IGNORED` e mantém a proveniência `RAW → NORMALIZED → CANONICAL`.

## Biblioteca de Tábuas Biométricas

```text
BiometricTable
      ↓ 1:N
BiometricTableVersion
      ↓ 1:N
BiometricTablePoint
```

Cada ponto possui idade, sexo e `qx`. Versões são imutáveis e derivações registram versão-mãe, transformação e parâmetros.

```text
QX_SCALE
  qx_novo(x) = qx_origem(x) × fator

AGE_SHIFT
  qx_novo(x) = qx_origem(x + deslocamento)
```

Nenhuma tábua oficial é inventada por seed: valores atuariais entram apenas por importação ou derivação explícita.

## Hypothesis Lab

Os Estudos de Aderência recebem uma base histórica com ano, idade, sexo, exposição e eventos observados. O backend calcula deterministicamente observado × esperado, χ², Kolmogorov-Smirnov, Teste Z, Exato de Fisher e DQM.

O identificador persistido do motor é neutro:

```text
adherence-engine-v1
```

O ranking inicial usa:

1. menor quantidade de testes rejeitados;
2. menor DQM;
3. maior p-value do χ².

O ranking é auxílio operacional e não aprova automaticamente uma hipótese.

## OpenAPI e frontend

Os contratos ficam em `openapi/`, com um snapshot base e fragmentos independentes por domínio. O script `apps/frontend/scripts/generate-api.mjs` mescla os fragmentos antes de executar `better-openapi-typescript`.

```bash
npm run api:generate
```

A saída gerada fica em `apps/frontend/src/api/generated/` e não é versionada.

## Backend

Padrões principais:

- Stage 3 decorators;
- `createExpressApp`;
- Swagger em `/docs`;
- OpenAPI runtime em `/openapi.json`;
- `Orm` + `SqliteDialect` + `createSqliteExecutor`;
- `bootstrapEntities` + introspecção/diff/sincronização de schema;
- SQLite WAL;
- multipart para importações.

Endpoints centrais incluem:

```text
GET   /api/health
GET   /api/config
POST  /api/auth/login
GET   /api/auth/me
POST  /api/auth/logout
GET   /api/users/
GET   /api/plans/
POST  /api/plans/
GET   /api/dashboard
GET   /api/evaluations/
POST  /api/imports/
POST  /api/mapping-profiles/match
POST  /api/critique/runs
GET   /api/critique/runs/:id/issues
PATCH /api/critique/issues/:id
GET   /api/biometric-tables/
POST  /api/biometric-tables/
POST  /api/biometric-tables/:id/derive
GET   /api/biometric-versions/:id/points
GET   /api/adherence-studies/
POST  /api/adherence-studies/
GET   /api/adherence-studies/:id
GET   /api/adherence-candidates/:id/points
GET   /api/llm/providers/
```

## Desenvolvimento

Requisitos:

- Node.js 22+
- npm com workspaces

```bash
npm install
npm run dev
```

Serviços locais:

```text
Frontend  http://localhost:5173
API       http://localhost:3001
Swagger   http://localhost:3001/docs
OpenAPI   http://localhost:3001/openapi.json
```

Banco e storage padrão:

```text
data/actuarial.sqlite
data/storage/
```

Podem ser alterados com:

```env
APP_DB_PATH=./data/actuarial.sqlite
APP_STORAGE_PATH=./data/storage
```

Os caminhos relativos são resolvidos a partir da raiz do repositório, não do `cwd` do processo.

## Primeiro administrador

Não existe usuário ou senha padrão. Para uma base vazia:

```env
APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
APP_BOOTSTRAP_ADMIN_PASSWORD=uma-senha-forte
APP_BOOTSTRAP_ADMIN_NAME=Administrador
```

A validade das sessões pode ser configurada com `APP_SESSION_TTL_DAYS`.

## Demo e IA

Dados de demonstração são opt-in:

```env
APP_SEED_DEMO=false
```

Quando habilitado, o seed de IA usa nomes neutros (`OpenAI-compatible` e `OpenAI`) e referências de secret por ambiente. Nenhuma configuração institucional específica pertence ao core.

A IA nunca é fonte dos resultados atuariais oficiais:

```text
motor determinístico → fatos estruturados → LLM → explicação/minuta/revisão
```

## Persistência

O diretório `/data/` inteiro é ignorado pelo Git. SQLite é adequado enquanto cada deployment operar com uma única instância escritora e volume persistente. Escala horizontal com múltiplos writers deve migrar a persistência operacional para PostgreSQL, sem contaminar as regras atuariais.

Detalhes adicionais estão em `docs/SAAS_FOUNDATION.md`.
