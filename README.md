# Atuária Previdenciária

Plataforma web para conduzir o ciclo de avaliações atuariais de previdência complementar, substituindo progressivamente aplicações legadas, planilhas operacionais, cálculos estatísticos manuais e fluxos documentais dispersos.

**Atuária Previdenciária** é o nome do produto e corresponde ao repositório `atuaria-previdenciaria`. Uma implantação pode identificar a UE/entidade que a opera, mas isso não renomeia o sistema.

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
- cadastro de Planoos BD/CD/CV;
- regras atuariais dos planos versionadas por vigência, modalidade e fingerprint;
- vínculo estável `Avaliacao.planoId` com backfill conservador para bases anteriores;
- Dashboard e Workspace de Avaliação;
- Data Studio com wizard XLSX/XLS/CSV;
- mapping N:N e transformações;
- persistência auditável `RAW → NORMALIZED → CANONICAL`;
- Mapeamento Profiles versionados e detecção de mudança de layout;
- Crítica Cadastral determinística e comparação com exercício anterior;
- Biblioteca de Tábuas Biométricas versionada;
- derivação imutável por escala de qx e deslocamento etário;
- Hypothesis Lab com observado × esperado, χ², KS, Z, Fisher e DQM;
- ranking persistido das versões biométricas candidatas;
- Parametrização Atuarial versionada, com promoção de hipóteses, parâmetros tipados e snapshot aprovado imutável;
- Motor de Cálculo com `ExecucaoCalculo` imutável, registry de engines, inputs congelados e fingerprints reproduzíveis;
- `CORE_PRECALCULATION` para consolidação determinística comum a BD/CD/CV;
- primeiro engine `ACTUARIAL`, `BD_PVFB`, para valor presente dos benefícios futuros de aposentadoria de Ativos em plano BD;
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
Planoo + regras versionadas
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
Arquivo → Estrutura → Mapeamento → Transformações → Preview → Validação → Concluir
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

O browser exibe preview, mas o resultado oficial da importação é recalculado no backend a partir do arquivo original.

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

O backend compartilha o mesmo parser numérico entre o Data Studio e os engines de cálculo para evitar interpretações divergentes de valores como `9.321,74` e `9321.74`.

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
TabuaBiometria
      ↓ 1:N
TabuaBiometriaVersion
      ↓ 1:N
TabuaBiometriaPoint
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

## Regras Atuariais do Planoo

O cadastro mestre do plano permanece pequeno. Elegibilidade, contribuições e regras de benefício ficam em versões próprias:

```text
Plano
  └─ VersaoRegrasPlanoo 1:N
        └─ PlanoRuleValue 1:N
```

Cada versão congela a modalidade `BD/CD/CV`, vigência, valores tipados e fingerprint SHA-256. O fluxo é:

```text
RASCUNHO → APROVADO → SUBSTITUIDO
```

`APROVADO` e `SUBSTITUIDO` são snapshots imutáveis. `SUBSTITUIDO` significa apenas que uma versão mais nova foi aprovada; a versão antiga continua válida para reprodução histórica quando sua vigência cobre a data-base da avaliação.

A UI oferece um catálogo inicial sem qualquer valor regulatório default. Valores devem ser transcritos do regulamento/nota técnica. Uma nova versão pode copiar os valores da anterior, mas a vigência é deliberadamente zerada para exigir confirmação explícita antes da aprovação.

URLs:

```text
/planos/:id/regras
/planos/:id/regras/:versaoRegrasId
```

`Avaliacao` possui `planoId` com FK opcional para o cadastro mestre. Bases anteriores só são ligadas automaticamente quando existe exatamente um plano com o mesmo nome histórico; casos ambíguos permanecem sem vínculo.

Detalhes estão em `docs/PLAN_RULES.md`.

## Parametrização Atuarial

Cada avaliação pode possuir uma sequência versionada de parametrizações. Existe no máximo um `RASCUNHO`; após aprovação, a versão vira um snapshot imutável e a aprovada anterior passa para `SUBSTITUIDO`.

```text
ParametrizacaoAtuarial
  ├─ ActuarialParameterValue 1:N
  └─ ActuarialHypothesisSelection 1:N
```

A UI cobre taxa real de juros, crescimento real de salários, crescimento real de benefícios, rotatividade e método de financiamento. O modelo de valores é tipado e extensível.

Candidatos dos Estudos de Aderência podem ser promovidos explicitamente para o snapshot. A seleção persiste estudo, resultado candidato, versão biométrica, tábua e posição no ranking.

No cálculo, a parametrização congelada incorpora ao fingerprint também os pontos `age / sex / qx` efetivamente lidos da versão biométrica selecionada. Portanto o hash não depende apenas de um UUID.

URLs:

```text
/avaliacoes/:id/parametrizacao
/avaliacoes/:id/parametrizacao/:parametrizacaoId
```

Detalhes estão em `docs/PARAMETERIZATION.md`.

## Motor de Cálculo

O cálculo não consulta estado mutável depois de iniciado.

```text
VersaoRegrasPlanoo APROVADO/SUBSTITUIDO   # engines atuariais
                  +
ParametrizacaoAtuarial APROVADO/SUBSTITUIDO
                  +
frozen canonical imports
                  ↓
            ExecucaoCalculo
              ├─ CalculationInput 1:N
              └─ CalculationResultMetric 1:N
```

Cada `ExecucaoCalculo` guarda, conforme o engine:

- avaliação e data-base;
- parametrização imutável;
- versão de regras do plano e `planRulesFingerprint` para engines atuariais;
- engine code/version;
- imports congelados;
- fingerprint dos parâmetros + qx;
- fingerprint dos dados canônicos;
- fingerprint completo do input;
- fingerprint dos resultados.

O registry `CalculationEngine` evita `switch` por modalidade. Cada engine declara `resultKind`, se exige regras do plano e quais modalidades suporta.

### CORE_PRECALCULATION

```text
CORE_PRECALCULATION / core-precalculation-v1
PRECALCULATION · BD/CD/CV
```

Produz consolidação cadastral, idade média, composição por sexo e fatores de desconto. Não produz resultado de benefício ou provisão.

### BD_PVFB

```text
BD_PVFB / bd-pvfb-v1
ACTUARIAL · BD
```

Calcula deterministicamente o **Valor Presente dos Benefícios Futuros (PVFB)** da renda de aposentadoria da população `Ativos`, usando:

- regras BD versionadas e vigentes;
- taxa real de juros;
- crescimento real dos salários;
- crescimento real dos benefícios;
- hipótese biométrica selecionada com seus `qx`;
- massa CANONICAL congelada.

O v1 implementa explicitamente `BENEFIT.CALCULATION_BASIS = FINAL_SALARY`.

**PVFB não é reserva matemática nem provisão técnica.** O engine ainda não apropria o valor presente por serviço passado/futuro segundo método de financiamento, não calcula contribuições futuras e não determina déficit ou superávit.

Solicitar novamente o mesmo engine com exatamente os mesmos inputs reutiliza o `ExecucaoCalculo CONCLUIDO` pelo `inputFingerprint`.

Self-tests determinísticos:

```bash
npm run calculation:self-test
npm run bd-pvfb:self-test
npm run plan-rules:self-test
```

O self-test do BD contém um caso fechado com `PVFB = 9.000`.

URLs:

```text
/avaliacoes/:id/calculos
/avaliacoes/:id/calculos/:calculationId
```

Detalhes e fórmulas estão em `docs/CALCULATION_ENGINE.md`.

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
GET   /api/usuarios/
GET   /api/planos/
POST  /api/planos/
GET   /api/planos/:planoId/regras
POST  /api/planos/:planoId/regras
GET   /api/regras-plano/:id
PATCH /api/regras-plano/:id
PATCH /api/regras-plano/:id/valores
POST  /api/regras-plano/:id/approve
GET   /api/dashboard
GET   /api/avaliacoes/
GET   /api/avaliacoes/:avaliacaoId/parametrizacoes
POST  /api/avaliacoes/:avaliacaoId/parametrizacoes
GET   /api/parametrizacoes/:id
PATCH /api/parametrizacoes/:id/parameters
POST  /api/parametrizacoes/:id/adherence-candidate
POST  /api/parametrizacoes/:id/hypothesis/remove
POST  /api/parametrizacoes/:id/approve
GET   /api/motores-calculo
GET   /api/avaliacoes/:avaliacaoId/calculos
POST  /api/avaliacoes/:avaliacaoId/calculos
GET   /api/calculos/:id
POST  /api/importacoes/
POST  /api/perfis-mapeamento/match
POST  /api/critica/runs
GET   /api/critica/runs/:id/issues
PATCH /api/critica/issues/:id
GET   /api/tabuas-biometricas/
POST  /api/tabuas-biometricas/
POST  /api/tabuas-biometricas/:id/derive
GET   /api/versoes-tabuas-biometricas/:id/points
GET   /api/estudos-aderencia/
POST  /api/estudos-aderencia/
GET   /api/estudos-aderencia/:id
GET   /api/candidatos-aderencia/:id/points
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

O primeiro engine `ACTUARIAL` já existe, mas ele produz **PVFB**, não reserva matemática.

O próximo passo técnico é modelar a apropriação do passivo de um plano BD segundo um **método de financiamento explicitamente suportado e validado**, começando por uma implementação concreta — por exemplo `PROJECTED_UNIT_CREDIT` — e persistir também resultados suficientemente detalhados para reconciliação atuarial.

Somente depois de existir uma rodada de cálculo com passivo/provisão validável o módulo de **Fechamento Atuarial** deve selecionar explicitamente um `ExecucaoCalculo CONCLUIDO`, reconciliar valores e congelar a rodada final.

Detalhes adicionais da fundação SaaS estão em `docs/SAAS_FOUNDATION.md`.
