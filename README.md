# ATUAS

Plataforma web para conduzir o ciclo de trabalho de avaliações atuariais de previdência complementar, substituindo progressivamente aplicações Delphi, planilhas operacionais, cálculos estatísticos manuais e fluxos documentais dispersos.

## v0.0.1

A primeira versão estabelece o fluxo e a arquitetura do produto:

- monorepo TypeScript;
- backend com `adorn-api`;
- persistência SQLite com `metal-orm`;
- OpenAPI 3.2 gerado pelo backend;
- frontend React + Material UI;
- contratos frontend preparados com `better-openapi-typescript`;
- Dashboard operacional;
- Workspace de Avaliação Atuarial;
- Data Studio com wizard/stepper para XLSX/XLS/CSV;
- mapping N:N entre colunas de origem e campos canônicos;
- transformações de data, sexo, split, concatenação e soma;
- preview do modelo canônico antes da importação;
- fundação para providers LLM OpenAI-compatible.

## Arquitetura

```text
atuas/
├── apps/
│   ├── backend/               # Adorn API + Metal ORM + SQLite
│   └── frontend/              # React + MUI + Data Studio
├── openapi/
│   └── atuas.openapi.json     # snapshot versionado para codegen
└── package.json               # npm workspaces
```

O domínio é organizado ao redor de uma **Avaliação Atuarial**, e não de arquivos isolados:

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

A entrada de uma massa não é uma importação cega. O wizard segue:

```text
Arquivo → Estrutura → Mapping → Transformações → Preview → Validação → Concluir
```

O mapping é explicitamente N:N. Exemplos válidos:

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

O objetivo do pipeline é preservar três representações:

```text
RAW → NORMALIZED → CANONICAL
```

O arquivo recebido nunca deve ser sobrescrito silenciosamente.

## Backend

O backend usa os padrões atuais do Adorn API e Metal ORM:

- Stage 3 decorators;
- `createExpressApp`;
- OpenAPI em `/openapi.json`;
- Swagger em `/docs`;
- `Orm` + `SqliteDialect` + `createSqliteExecutor`;
- SQLite em modo WAL.

Endpoints iniciais:

```text
GET /api/health
GET /api/dashboard
GET /api/evaluations/
GET /api/mapping-profiles/
GET /api/llm/providers/
```

## Frontend e OpenAPI

O snapshot OpenAPI versionado fica em `openapi/atuas.openapi.json`.

Para gerar os tipos separados por controller/tag com `better-openapi-typescript`:

```bash
npm run api:generate
```

A saída é gerada em:

```text
apps/frontend/src/api/generated/
```

Quando o backend estiver rodando, o snapshot deverá ser atualizado a partir do `/openapi.json` canônico antes de releases.

## Desenvolvimento

Requisitos:

- Node.js 22+
- npm com suporte a workspaces

Instale tudo na raiz:

```bash
npm install
```

Suba backend e frontend juntos:

```bash
npm run dev
```

Serviços:

```text
Frontend  http://localhost:5173
API       http://localhost:3001
Swagger   http://localhost:3001/docs
OpenAPI   http://localhost:3001/openapi.json
```

Banco padrão:

```text
data/atuas.sqlite
```

Pode ser alterado com:

```bash
ATUAS_DB_PATH=/caminho/atuas.sqlite npm run dev -w @atuas/backend
```

## Princípio para IA

A camada de IA nunca é a fonte dos resultados atuariais oficiais.

```text
motor determinístico → fatos estruturados → LLM → explicação/minuta/revisão
```

Providers serão OpenAI-compatible e poderão possuir múltiplas credenciais, modelos, profiles e políticas de fallback/roteamento.

## Próximos slices

1. Persistência completa da importação RAW/NORMALIZED/CANONICAL e dos Mapping Profiles.
2. Crítica cadastral e comparação automática com o exercício anterior.
3. Biblioteca versionada de tábuas biométricas.
4. Hypothesis Lab: exposição, observados/esperados, Qui-Quadrado, KS, Z, Fisher e DQM.
5. Orquestração do motor Delphi legado como golden master.
6. Fechamento estruturado para substituir gradualmente a planilha de fechamento.
7. Document Studio e providers LLM OpenAI-compatible com múltiplas API keys.
