# ATUAS

Plataforma web para conduzir o ciclo de trabalho de avaliações atuariais de previdência complementar, substituindo progressivamente aplicações Delphi, planilhas operacionais, cálculos estatísticos manuais e fluxos documentais dispersos.

## v0.0.1

A base funcional atual já inclui:

- monorepo TypeScript;
- backend com `adorn-api`;
- SQLite com `metal-orm` e entities anotadas;
- schema sincronizado a partir das entities;
- frontend React + Material UI;
- OpenAPI 3.2 + contratos gerados por `better-openapi-typescript`;
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

## Arquitetura

```text
atuas/
├── apps/
│   ├── backend/               # Adorn API + Metal ORM + SQLite
│   └── frontend/              # React + MUI
├── docs/
│   └── HYPOTHESIS_LAB.md
├── openapi/
│   ├── atuas.openapi.json     # snapshot base
│   └── adherence.openapi.json # fragmento do Hypothesis Lab
└── package.json               # npm workspaces
```

O domínio é organizado ao redor de uma **Avaliação Atuarial**, não de arquivos isolados:

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

A massa não é importada cegamente. O fluxo é:

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

As regras iniciais cobrem matrícula ausente/duplicada, nascimento inválido, idade fora de faixa, ingresso no plano anterior à admissão, salário não positivo, mudanças entre exercícios, variação salarial, entradas e saídas da massa.

As severidades são `BLOCKING`, `INCONSISTENCY`, `WARNING` e `INFO`. Uma ocorrência nunca é apagada ao ser tratada: ela passa para `RESOLVED`, `JUSTIFIED` ou `IGNORED` e mantém a proveniência `RAW → NORMALIZED → CANONICAL`.

## Biblioteca de Tábuas Biométricas

```text
BiometricTable
      ↓ 1:N
BiometricTableVersion
      ↓ 1:N
BiometricTablePoint
```

Cada ponto possui idade, sexo e `qx`. O qx é validado em `0 <= qx <= 1` e persistido como `decimal(18,12)`.

Versões são imutáveis. Derivações registram a versão-mãe, transformação e parâmetros:

```text
QX_SCALE
  qx_novo(x) = qx_origem(x) × fator

AGE_SHIFT
  qx_novo(x) = qx_origem(x + deslocamento)
```

A UI importa XLSX/XLS/CSV, permite mapear idade/qx/sexo, revisar os pontos e comparar curvas entre versões. Percentuais como `0,10%` são normalizados para `0,001`.

Nenhuma tábua oficial é inventada por seed: valores atuariais entram apenas por importação ou derivação explícita.

## Hypothesis Lab

O módulo de Estudos de Aderência já é funcional.

O wizard recebe uma base histórica com:

```text
ano
idade
sexo
exposição
eventos observados
```

O usuário seleciona uma ou mais versões imutáveis da Biblioteca Biométrica e o backend calcula deterministicamente:

```text
observado × esperado
χ²
Kolmogorov-Smirnov
Teste Z
Exato de Fisher
DQM
```

O modelo é:

```text
AdherenceStudy
  ├─ AdherenceObservation 1:N
  └─ AdherenceCandidateResult 1:N
       └─ AdherenceCandidatePoint 1:N
```

Cada candidato preserva, por idade/sexo:

- exposição;
- eventos observados;
- qx usado;
- eventos esperados;
- resíduo.

Também são persistidos:

- estatísticas calculadas;
- valores críticos de χ², KS e Z;
- p-values;
- decisão rejeita/não rejeita por teste;
- DQM;
- quantidade de testes rejeitados;
- ranking;
- versão do motor estatístico.

A versão atual do motor é:

```text
atuas-adherence-v1
```

O ranking inicial usa:

1. menor quantidade de testes rejeitados;
2. menor DQM;
3. maior p-value do χ².

O ranking é auxílio operacional e não aprova automaticamente uma hipótese.

A metodologia detalhada está em `docs/HYPOTHESIS_LAB.md`. O objetivo seguinte é comparar os resultados com as planilhas históricas usadas como **golden master**.

## OpenAPI e frontend

O contrato base fica em:

```text
openapi/atuas.openapi.json
```

Domínios podem adicionar fragmentos, como:

```text
openapi/adherence.openapi.json
```

O script `apps/frontend/scripts/generate-api.mjs` mescla os fragmentos antes de executar `better-openapi-typescript`.

```bash
npm run api:generate
```

A saída fica em:

```text
apps/frontend/src/api/generated/
```

O frontend consome esses schemas gerados em vez de duplicar DTOs manualmente.

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

Endpoints centrais atuais:

```text
GET   /api/health
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

Serviços:

```text
Frontend  http://localhost:5173
API       http://localhost:3001
Swagger   http://localhost:3001/docs
OpenAPI   http://localhost:3001/openapi.json
```

Banco e storage padrão:

```text
data/atuas.sqlite
data/storage/
```

Podem ser alterados com `ATUAS_DB_PATH` e `ATUAS_STORAGE_PATH`.

## CI

A CI cobre Data Studio, Crítica Cadastral e Biblioteca Biométrica. Há também um workflow específico do Hypothesis Lab que:

```text
cria uma tábua biométrica
  ↓
deriva uma segunda versão
  ↓
executa estudo observado × esperado
  ↓
valida ranking e resultados
  ↓
abre os pontos persistidos do candidato vencedor
```

## Princípio para IA

A IA nunca é fonte dos resultados atuariais oficiais.

```text
motor determinístico → fatos estruturados → LLM → explicação/minuta/revisão
```

Providers são OpenAI-compatible e podem possuir múltiplas credenciais referenciadas por secret store/environment, sem persistir API keys em texto puro no SQLite.

## Próximos slices

1. regressão do Hypothesis Lab contra os Excel históricos como golden master;
2. integração dos estudos às Avaliações e snapshot formal das hipóteses aprovadas;
3. orquestração do motor Delphi legado como golden master da avaliação;
4. fechamento estruturado para substituir gradualmente `FECHAMENTO.xlsx`;
5. Document Studio e IA contextual para relatório/parecer.
