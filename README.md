# Atuária Previdenciária

Plataforma web para conduzir o ciclo de avaliações atuariais de previdência complementar, substituindo progressivamente aplicações legadas, planilhas operacionais, cálculos estatísticos manuais e fluxos documentais dispersos.

**Atuária Previdenciária** é o nome do produto e corresponde ao nome do repositório `atuaria-previdenciaria`. Uma implantação pode identificar a UE/entidade que a opera, mas isso não renomeia o sistema.

## Fundação atual

A base funcional inclui:

- monorepo TypeScript;
- backend com `adorn-api`;
- SQLite com `metal-orm` e entities anotadas;
- schema sincronizado a partir das entities;
- frontend React + Material UI;
- OpenAPI + contratos gerados por `better-openapi-typescript`;
- autenticação bearer, usuários e RBAC básico;
- identificação configurável da organização responsável pelo deployment;
- cadastro de Planos BD/CD/CV;
- regras atuariais dos planos versionadas por vigência, modalidade e fingerprint;
- vínculo estável `Evaluation.planId` com backfill conservador para bases anteriores;
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
- Parametrização Atuarial versionada, com promoção de hipóteses, parâmetros tipados e snapshot aprovado imutável;
- Motor de Cálculo com `CalculationRun` imutável, registry de engines, inputs congelados e fingerprints reproduzíveis;
- fundação para providers LLM OpenAI-compatible.

## Produto e organização

O produto mantém sempre a identidade **Atuária Previdenciária**. O que pode variar por deployment é a organização/UE responsável pela instância:

```env
APP_ORGANIZATION_NAME=
```

O backend expõe a configuração pública em:

```text
GET /api/config
```

O frontend usa a organização como contexto institucional no login, sidebar e título do navegador, sem alterar o nome do produto.

Isso também não é o mesmo que multi-tenant: hoje a arquitetura suporta deployments independentes por entidade. Uma instalação única atendendo várias entidades deverá ganhar isolamento explícito por tenant em um slice próprio.

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
Plano + regras versionadas
          ↓
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

## Regras Atuariais do Plano

O cadastro mestre do plano permanece pequeno. Elegibilidade, contribuições e regras de benefício ficam em versões próprias:

```text
Plan
  └─ PlanRulesVersion 1:N
        └─ PlanRuleValue 1:N
```

Cada versão congela a modalidade `BD/CD/CV`, vigência, valores tipados e fingerprint SHA-256. O fluxo é `DRAFT → APPROVED → SUPERSEDED`; uma versão aprovada não pode ser editada.

A UI oferece um catálogo inicial sem qualquer valor regulatório default. Valores devem ser transcritos do regulamento/nota técnica. Uma nova versão pode copiar os valores da anterior, mas a vigência é deliberadamente zerada para exigir confirmação explícita antes da aprovação.

URLs:

```text
/planos/:id/regras
/planos/:id/regras/:rulesVersionId
```

`Evaluation` agora possui `planId` com FK opcional para o cadastro mestre. Bases anteriores só são ligadas automaticamente quando existe exatamente um plano com o mesmo nome histórico; casos ambíguos permanecem sem vínculo.

Detalhes estão em `docs/PLAN_RULES.md`.

## Parametrização Atuarial

Cada avaliação pode possuir uma sequência versionada de parametrizações. Existe no máximo um `DRAFT`; após aprovação, a versão vira um snapshot imutável e a aprovada anterior passa para `SUPERSEDED`.

```text
ActuarialParameterization
  ├─ ActuarialParameterValue 1:N
  └─ ActuarialHypothesisSelection 1:N
```

A primeira UI cobre taxa real de juros, crescimento real de salários, crescimento real de benefícios, rotatividade e método de financiamento. O modelo de valores é tipado e extensível para não transformar a tabela em uma lista fixa de colunas.

Candidatos dos Estudos de Aderência podem ser promovidos explicitamente para o snapshot. A seleção persiste o estudo, resultado candidato, versão biométrica, tábua e posição no ranking. Um estudo sem avaliação ainda pode ser associado na promoção; um estudo de outra avaliação é rejeitado.

Versões aprovadas não podem ser editadas. Uma nova versão pode copiar a anterior, alterar/remover parâmetros e hipóteses enquanto estiver em rascunho e então ser aprovada novamente.

URLs:

```text
/avaliacoes/:id/parametrizacao
/avaliacoes/:id/parametrizacao/:parameterizationId
```

Detalhes do contrato estão em `docs/PARAMETERIZATION.md`.

## Motor de Cálculo

O cálculo não consulta estado mutável depois de iniciado. Cada `CalculationRun` referencia uma parametrização `APPROVED`, congela o import mais recente de cada população e persiste fingerprints de parâmetros, dados, input completo e resultado.

```text
APPROVED Parameterization
          +
COMPLETED imports
          ↓
CalculationRun
  ├─ CalculationInput 1:N
  └─ CalculationResultMetric 1:N
```

O registry `CalculationEngine` permite adicionar novos motores sem um `switch` central por modalidade ou versão. O motor inicial é:

```text
CORE_PRECALCULATION / core-precalculation-v1
```

Ele é classificado como `PRECALCULATION`: produz consolidação cadastral, idade média, composição por sexo e fatores de desconto quando existe taxa real de juros parametrizada. Ele deliberadamente **não** declara reservas, provisões, déficit ou superávit como resultado oficial.

Solicitar novamente o mesmo engine com exatamente os mesmos inputs reutiliza o `CalculationRun` concluído pelo `inputFingerprint`.

URLs:

```text
/avaliacoes/:id/calculos
/avaliacoes/:id/calculos/:calculationId
```

Detalhes estão em `docs/CALCULATION_ENGINE.md`.

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
GET   /api/plans/:planId/rules
POST  /api/plans/:planId/rules
GET   /api/plan-rules/:id
PATCH /api/plan-rules/:id
PATCH /api/plan-rules/:id/values
POST  /api/plan-rules/:id/approve
GET   /api/dashboard
GET   /api/evaluations/
GET   /api/evaluations/:evaluationId/parameterizations
POST  /api/evaluations/:evaluationId/parameterizations
GET   /api/parameterizations/:id
PATCH /api/parameterizations/:id/parameters
POST  /api/parameterizations/:id/adherence-candidate
POST  /api/parameterizations/:id/hypothesis/remove
POST  /api/parameterizations/:id/approve
GET   /api/calculation-engines
GET   /api/evaluations/:evaluationId/calculations
POST  /api/evaluations/:evaluationId/calculations
GET   /api/calculations/:id
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
data/atuaria-previdenciaria.sqlite
data/storage/
```

Podem ser alterados com:

```env
APP_DB_PATH=./data/atuaria-previdenciaria.sqlite
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

## Próximo slice

Agora existem os três snapshots necessários para um cálculo oficial reproduzível:

```text
PlanRulesVersion APPROVED
+ ActuarialParameterization APPROVED
+ frozen canonical imports
```

O próximo passo é fazer o primeiro `CalculationEngine` de `resultKind: ACTUARIAL`, exigindo explicitamente `planRulesVersionId` no `CalculationRun`. Os motores por modalidade devem ser implementações separadas do registry e começar por uma modalidade com fórmula validada contra golden master/legado, em vez de inventar reservas genéricas.

Depois disso, o **Fechamento Atuarial** poderá selecionar explicitamente um `CalculationRun` concluído, reconciliar resultados e congelar a rodada final.

Detalhes adicionais da fundação SaaS estão em `docs/SAAS_FOUNDATION.md`.
