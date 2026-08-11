# Motor de Cálculo

O módulo de cálculo transforma uma parametrização aprovada e uma fotografia explícita das massas canônicas em uma execução imutável e reproduzível.

```text
Evaluation
   │
   ├── APPROVED ActuarialParameterization
   │
   └── latest COMPLETED import por população
                    │
                    ▼
              CalculationRun
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
 CalculationInput      CalculationResultMetric
```

## Invariantes

Uma execução só pode começar quando:

- a avaliação existe;
- não há ocorrências bloqueantes registradas na avaliação;
- a parametrização pertence à avaliação;
- a parametrização está `APPROVED`;
- existe ao menos um import `COMPLETED` vinculado à avaliação;
- o motor solicitado está registrado no `CalculationEngine` registry.

A execução nunca busca "parâmetros atuais" depois de criada. `parameterizationId`, versão do motor e imports utilizados ficam congelados.

## Seleção da massa

Para cada população vinculada à avaliação, o serviço seleciona deterministicamente o import `COMPLETED` mais recente. O desempate usa o próprio UUID do import para evitar seleção não determinística quando timestamps coincidirem.

Cada `CalculationInput` registra:

- `importJobId`;
- população;
- SHA-256 do arquivo original;
- fingerprint do schema mapeado;
- fingerprint do conteúdo CANONICAL e do estado de validação;
- quantidade total, válida e inválida de linhas;
- timestamp da conclusão da importação.

As linhas inválidas não são entregues ao motor. Sua quantidade permanece registrada na execução.

## Fingerprints

Existem quatro níveis principais de fingerprint:

```text
parameterFingerprint
  = parametrização + valores + origem + hipóteses + proveniência dos estudos

dataFingerprint
  = imports + arquivo original + schema + conteúdo canonical

inputFingerprint
  = avaliação + data-base + parâmetros + dados + engine code/version

resultFingerprint
  = métricas tipadas produzidas pelo motor
```

Se uma nova solicitação possui o mesmo `inputFingerprint` e a mesma versão do motor, a execução `COMPLETED` anterior é reutilizada. Um motor determinístico não cria cópias indistinguíveis do mesmo cálculo.

## Registry de motores

O domínio não usa `switch` central por modalidade ou versão. Cada motor implementa o contrato `CalculationEngine` e é registrado pelo seu código.

```text
CalculationEngine
  ├── code
  ├── version
  ├── label
  ├── resultKind
  └── execute(context)
```

`resultKind` distingue:

- `PRECALCULATION`: consolidação e cálculos técnicos que ainda não representam a avaliação atuarial oficial;
- `ACTUARIAL`: motores futuros que implementem integralmente uma família de regras atuariais validada.

Isso permite adicionar motores BD, CD, CV, motores de comparação com legado ou versões regulatórias sem contaminar o orquestrador.

## Motor inicial

O primeiro motor registrado é:

```text
code:    CORE_PRECALCULATION
version: core-precalculation-v1
kind:    PRECALCULATION
```

Ele calcula deterministicamente:

- quantidade de imports congelados;
- quantidade de populações;
- linhas válidas e inválidas;
- participantes masculinos/femininos;
- idade média na data-base;
- quantidade de parâmetros ativos;
- quantidade de hipóteses selecionadas;
- taxa real de juros, quando parametrizada;
- fatores de desconto em 1, 10 e 30 anos.

Ele **não** produz reservas, provisões, custos normais, déficits ou superávits. Esses resultados só devem aparecer quando as regras de benefícios, contribuições e método de financiamento estiverem modeladas e validadas.

## Persistência

```text
CalculationRun
  ├── evaluationId
  ├── parameterizationId
  ├── engineCode / engineVersion
  ├── status
  ├── parameterFingerprint
  ├── dataFingerprint
  ├── inputFingerprint
  ├── resultFingerprint
  └── timestamps / contagens

CalculationInput
  └── snapshot de cada import utilizado

CalculationResultMetric
  └── resultado tipado e ordenado
```

Execuções históricas protegem suas referências com `RESTRICT`; apagar dados de origem não pode silenciosamente invalidar um resultado já persistido.

## API

```text
GET  /api/calculation-engines
GET  /api/evaluations/:evaluationId/calculations
POST /api/evaluations/:evaluationId/calculations
GET  /api/calculations/:id
```

Criar uma execução exige explicitamente o `parameterizationId` aprovado. `engineCode` é opcional e, quando omitido, usa o motor base atual.

## URLs

```text
/avaliacoes/:evaluationId/calculos
/avaliacoes/:evaluationId/calculos/:calculationId
```

A URL individual apenas recupera a execução persistida. Ela não dispara recálculo.

## Próxima evolução

O próximo passo técnico dentro do domínio atuarial é modelar regras suficientes para um engine `ACTUARIAL` real. Antes disso, o modelo de Plano precisa evoluir de cadastro mestre simples para regras versionadas de benefício/contribuição e elegibilidade.

Uma implementação futura pode seguir:

```text
PlanRulesVersion
       +
Approved Parameterization
       +
Frozen Canonical Inputs
       ↓
BD/CD/CV CalculationEngine
       ↓
CalculationRun (ACTUARIAL)
```

O fechamento atuarial deverá consumir apenas `CalculationRun` concluído e explicitamente selecionado, nunca recalcular valores por conta própria.
