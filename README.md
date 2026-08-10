# ATUAS

Plataforma web para conduzir o ciclo de trabalho de avaliações atuariais de previdência complementar, substituindo progressivamente aplicações Delphi, planilhas operacionais, cálculos estatísticos manuais e fluxos documentais dispersos.

## v0.0.1

A primeira versão estabelece o fluxo e a arquitetura do produto:

- monorepo TypeScript;
- backend com `adorn-api`;
- persistência SQLite com `metal-orm` e entities anotadas;
- schema SQLite sincronizado a partir das entities do Metal ORM;
- OpenAPI 3.2 gerado pelo backend;
- frontend React + Material UI;
- contratos frontend gerados e consumidos com `better-openapi-typescript`;
- Dashboard operacional;
- Workspace de Avaliação Atuarial;
- Data Studio com wizard/stepper para XLSX/XLS/CSV;
- mapping N:N entre colunas de origem e campos canônicos;
- transformações de data, sexo, split, concatenação e soma;
- preview do modelo canônico antes da importação;
- persistência auditável `RAW → NORMALIZED → CANONICAL`;
- armazenamento imutável do arquivo-fonte com SHA-256;
- Mapping Profiles e Mapping Rules versionados;
- detecção de compatibilidade e diff do layout recebido contra perfis anteriores;
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

### Persistência e proveniência

O browser oferece o preview, mas o resultado oficial não depende do JavaScript do frontend. Ao concluir, o arquivo original e as regras são enviados ao backend, que abre novamente a planilha e repete deterministicamente o mapping.

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

Para cada importação o ATUAS mantém:

- `ImportFile`: nome original, MIME type, tamanho, SHA-256 e localização no storage;
- `ImportJob`: população, aba, cabeçalho, fingerprint do schema, perfil aplicado, status e contagens;
- `ImportRow`: número da linha, JSON RAW, NORMALIZED e CANONICAL, status e erros de validação;
- `MappingProfile`: família/versionamento do mapping e fingerprints;
- `MappingRule`: origens, destinos, transformação e ordem da regra.

### Reutilização de mappings

Depois da primeira importação, o perfil pode ser reutilizado em novos exercícios. O backend compara os cabeçalhos normalizados:

```text
mesmo layout
  → 100% compatível
  → regras reaplicadas automaticamente

layout alterado
  → percentual de compatibilidade
  → colunas removidas
  → colunas novas
  → aplicar apenas regras ainda compatíveis
  → revisar diferenças
```

Se schema ou regras mudarem, o ATUAS cria uma nova versão do perfil em vez de sobrescrever o histórico.

## Backend

O backend usa os padrões atuais do Adorn API e Metal ORM:

- Stage 3 decorators;
- `createExpressApp`;
- OpenAPI em `/openapi.json`;
- Swagger em `/docs`;
- `Orm` + `SqliteDialect` + `createSqliteExecutor`;
- `bootstrapEntities` + introspecção/diff/sincronização de schema;
- SQLite em modo WAL;
- multipart para importações de até 100 MB nesta primeira versão.

Endpoints atuais:

```text
GET  /api/health
GET  /api/dashboard
GET  /api/evaluations/
GET  /api/mapping-profiles/
POST /api/mapping-profiles/match
POST /api/imports/
GET  /api/llm/providers/
```

## Frontend e OpenAPI

O snapshot OpenAPI versionado fica em `openapi/atuas.openapi.json`.

Os contratos são gerados por controller/tag com `better-openapi-typescript`:

```bash
npm run api:generate
```

A saída fica em:

```text
apps/frontend/src/api/generated/
```

O `client.ts` usa os schemas gerados para os DTOs de resposta. `dev`, `build` e `typecheck` regeneram os contratos automaticamente antes de executar.

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

Banco e storage padrão:

```text
data/atuas.sqlite
data/storage/
```

Podem ser alterados com:

```bash
ATUAS_DB_PATH=/caminho/atuas.sqlite \
ATUAS_STORAGE_PATH=/caminho/storage \
npm run dev -w @atuas/backend
```

## CI

A CI faz:

```text
install
  ↓
OpenAPI codegen
  ↓
typecheck
  ↓
build
  ↓
health smoke test
  ↓
importação CSV real via multipart
  ↓
validação das contagens
  ↓
reconhecimento do Mapping Profile em 100%
```

## Princípio para IA

A camada de IA nunca é a fonte dos resultados atuariais oficiais.

```text
motor determinístico → fatos estruturados → LLM → explicação/minuta/revisão
```

Providers são OpenAI-compatible e podem possuir múltiplas credenciais referenciadas por secret store/environment, sem persistir API keys em texto puro no SQLite.

## Próximos slices

1. Crítica cadastral e comparação automática com o exercício anterior.
2. Biblioteca versionada de tábuas biométricas.
3. Hypothesis Lab: exposição, observados/esperados, Qui-Quadrado, KS, Z, Fisher e DQM.
4. Orquestração do motor Delphi legado como golden master.
5. Fechamento estruturado para substituir gradualmente a planilha de fechamento.
6. Document Studio e providers LLM OpenAI-compatible com múltiplas API keys.