# Motor de Cálculo

O módulo de cálculo transforma snapshots aprovados e uma fotografia explícita das massas canônicas em uma execução imutável e reproduzível.

```text
Evaluation
   │
   ├── ActuarialParameterization APPROVED/SUPERSEDED
   │
   ├── PlanRulesVersion APPROVED/SUPERSEDED   # engines atuariais
   │
   └── latest COMPLETED import por população
                    │
                    ▼
              CalculationRun
                    │
       ┌────────────┼──────────────────┐
       ▼            ▼                  ▼
CalculationInput  Aggregate metrics  Participant results
```

`SUPERSEDED` significa que o snapshot já foi aprovado e depois substituído por uma versão mais nova. Ele continua imutável e válido para reprodução histórica; portanto o cálculo aceita `APPROVED` e `SUPERSEDED`.

## Invariantes

Toda execução exige:

- avaliação existente;
- nenhuma ocorrência bloqueante na avaliação;
- parametrização pertencente à avaliação;
- parametrização `APPROVED` ou `SUPERSEDED`;
- ao menos um import `COMPLETED` vinculado à avaliação;
- engine registrado no `CalculationEngine` registry.

Um engine com `requiresPlanRules = true` exige adicionalmente:

- `Evaluation.planId` real, sem inferência por nome;
- `planRulesVersionId` explícito;
- regras pertencentes ao mesmo plano;
- modalidade compatível com `supportedModalities` do engine;
- versão de regras `APPROVED` ou `SUPERSEDED`;
- `rulesFingerprint` persistido;
- vigência da versão cobrindo a data-base da avaliação.

Antes da execução, o backend recalcula o fingerprint do conteúdo atual da `PlanRulesVersion` e o compara ao fingerprint aprovado. Divergência é tratada como falha de integridade e o cálculo é recusado.

A execução nunca busca "a regra atual" ou "o parâmetro atual" depois de criada.

## Registry de engines

O domínio não usa um `switch` central por modalidade.

```text
CalculationEngine
  ├── code
  ├── version
  ├── label
  ├── resultKind
  ├── requiresPlanRules
  ├── supportedModalities[]
  └── execute(context)
          ↓
     CalculationEngineOutput
       ├── metrics[]
       └── participantResults[]
```

`resultKind` distingue:

- `PRECALCULATION`: consolidação e cálculos técnicos sem resultado atuarial de benefício/provisão;
- `ACTUARIAL`: cálculo que consome explicitamente regras versionadas do plano e hipóteses atuariais.

Um engine `ACTUARIAL` não pode ser registrado com `requiresPlanRules = false`.

Resultados individuais só podem referenciar linhas pertencentes aos imports efetivamente congelados na execução. O orquestrador valida `importJobId + sourceRowNumber` antes de persistir a saída do engine.

## CORE_PRECALCULATION

```text
code:    CORE_PRECALCULATION
version: core-precalculation-v1
kind:    PRECALCULATION
modalidades: BD / CD / CV
```

Calcula:

- imports e populações congeladas;
- linhas válidas/inválidas;
- composição por sexo;
- idade média;
- quantidade de parâmetros e hipóteses;
- taxa real de juros;
- fatores de desconto de 1, 10 e 30 anos.

Não produz reservas, provisões, custos normais, déficits ou superávits e não gera resultados individuais atuariais.

## BD_PVFB

O primeiro engine `ACTUARIAL` é:

```text
code:    BD_PVFB
version: bd-pvfb-v1
kind:    ACTUARIAL
modalidade: BD
```

Ele calcula o **Valor Presente dos Benefícios Futuros (PVFB)** da renda de aposentadoria da população `Ativos`.

O resultado **não é reserva matemática nem provisão técnica**. O engine ainda não distribui o PVFB entre serviço passado/futuro por método de financiamento e não calcula contribuições futuras, déficit ou superávit.

### Regras obrigatórias do plano

```text
ELIGIBILITY.NORMAL_RETIREMENT_AGE
BENEFIT.CALCULATION_BASIS = FINAL_SALARY
BENEFIT.REPLACEMENT_RATE
BENEFIT.PAYMENTS_PER_YEAR
```

Regras opcionais que alteram a data de elegibilidade:

```text
ELIGIBILITY.MINIMUM_PLAN_MEMBERSHIP_YEARS
ELIGIBILITY.MINIMUM_SPONSOR_SERVICE_YEARS
```

Quando essas carências existem, os campos canônicos `participant.planJoinDate` e/ou `participant.admissionDate` tornam-se obrigatórios para o engine.

`FINANCIAL.CURRENCY_CODE` é opcional e serve apenas como unidade de apresentação das métricas monetárias; não altera a matemática.

### Parâmetros obrigatórios da rodada

```text
ECONOMIC.REAL_INTEREST_RATE
ECONOMIC.SALARY_GROWTH_RATE
ECONOMIC.BENEFIT_GROWTH_RATE
```

Nenhum deles recebe zero implicitamente. Se o valor correto for zero, zero precisa estar explicitamente gravado na parametrização aprovada.

### Hipótese biométrica

O v1 exige exatamente uma hipótese biométrica ativa na parametrização e usa os pontos `qx` da `BiometricTableVersion` selecionada.

Os próprios pontos `age / sex / qx` entram no `parameterFingerprint`. Assim o fingerprint reflete os dados biométricos efetivamente consumidos, e não apenas o UUID da versão.

Para cada sexo utilizado, a série precisa:

- possuir `qx` em todas as idades necessárias;
- ter `0 <= qx <= 1`;
- encerrar com `qx = 1` (tolerância numérica `0.999999`).

Uma tabela `UNISEX` pode servir como fallback para `MALE` e `FEMALE`.

### Dados canônicos obrigatórios

Para `Ativos`:

```text
participant.birthDate
participant.sex
participant.contributionSalary
```

Salário pode estar persistido como número ou como representação textual canônica reconhecível. O backend compartilha o contrato de parsing numérico do Data Studio e reconhece, entre outros, `9.321,74`, `9,321.74` e `9321.74` sem deixar o engine interpretar o mesmo valor com outra regra.

### Fórmula

Para cada participante, o engine determina uma idade inteira de início de benefício respeitando idade normal e carências configuradas.

Salário mensal projetado:

```text
S_R = S_0 × (1 + g_s)^n
```

Benefício mensal projetado:

```text
B_R = S_R × r
```

Benefício anual no primeiro ano de aposentadoria:

```text
A_0 = B_R × m
```

onde:

- `S_0`: salário de contribuição mensal na data-base;
- `g_s`: crescimento real salarial;
- `n`: anos inteiros até início do benefício;
- `r`: taxa de reposição;
- `m`: pagamentos por ano.

A sobrevivência até cada idade é construída pelo produto dos `px = 1 - qx` da hipótese selecionada.

O PVFB individual usa passos anuais e pagamentos no início de cada ano de aposentadoria:

```text
PVFB = Σ [ A_0 × (1 + g_b)^t × survival(t) / (1 + i)^(n+t) ]
```

até a idade terminal da tábua, em que `qx = 1`.

- `g_b`: crescimento real dos benefícios;
- `i`: taxa real de juros;
- `survival(t)`: probabilidade acumulada de sobrevivência desde a idade atual até o pagamento do ano `t`.

A convenção anual é deliberadamente explícita para que versões futuras possam mudar para fracionamento mensal ou outra hipótese sem alterar silenciosamente o significado de `bd-pvfb-v1`.

### Métricas agregadas

Entre as métricas persistidas:

```text
BD.PVFB.ACTIVE_PARTICIPANTS
BD.PVFB.CURRENT_MONTHLY_SALARY_TOTAL
BD.PVFB.PROJECTED_MONTHLY_BENEFIT_TOTAL
BD.PVFB.TOTAL
BD.PVFB.AVERAGE
BD.PVFB.AVERAGE_YEARS_TO_RETIREMENT
BD.PVFB.AVERAGE_SURVIVAL_TO_RETIREMENT
```

Além disso, a execução registra as taxas e regras centrais usadas para facilitar conferência humana.

### Reconciliação por participante

O `BD_PVFB` também persiste um resultado por participante, separado das métricas agregadas. Cada linha guarda a proveniência:

```text
CalculationParticipantResult
  ├── calculationRunId
  ├── importJobId
  ├── population
  ├── sourceRowNumber
  ├── participantRegistration
  ├── resultJson
  └── ordinal
```

O `resultJson` do `bd-pvfb-v1` contém:

```text
currentAge
retirementAge
yearsToRetirement
currentMonthlySalary
projectedMonthlySalary
projectedMonthlyBenefit
survivalToRetirement
pvfb
```

Isso permite reconciliar a nova implementação contra o sistema legado participante a participante, sem depender apenas da igualdade do total agregado.

O detalhe normal do `CalculationRun` continua leve. Resultados individuais são recuperados por endpoint paginado, com máximo de 200 registros por página.

## Fingerprints

```text
planRulesFingerprint
  = fingerprint da PlanRulesVersion aprovada

parameterFingerprint
  = parametrização + parâmetros + hipóteses + pontos qx efetivamente usados

dataFingerprint
  = imports + arquivo original + schema + conteúdo CANONICAL

inputFingerprint
  = avaliação + planId + data-base
    + snapshot completo de regras
    + parameterFingerprint
    + dataFingerprint
    + engine code/version

resultFingerprint
  = métricas agregadas + resultados individuais ordenados produzidos pelo engine
```

Se uma solicitação possui o mesmo `inputFingerprint`, engine e versão de engine, um `CalculationRun COMPLETED` anterior é reutilizado.

## Persistência

```text
CalculationRun
  ├── evaluationId
  ├── parameterizationId
  ├── planRulesVersionId?       # obrigatório para engine atuarial
  ├── planRulesFingerprint?
  ├── engineCode / engineVersion
  ├── status
  ├── parameterFingerprint
  ├── dataFingerprint
  ├── inputFingerprint
  ├── resultFingerprint
  ├── participantResultCount
  └── timestamps / contagens

CalculationInput
  └── snapshot de cada import utilizado

CalculationResultMetric
  └── resultado agregado tipado e ordenado

CalculationParticipantResult
  └── resultado individual + ligação à linha de origem congelada
```

As colunas de regras do plano e `participantResultCount` são aditivas/nullable no schema para manter leitura de execuções criadas antes da introdução desses contratos; a API normaliza contagem ausente para zero.

## API

```text
GET  /api/calculation-engines
GET  /api/evaluations/:evaluationId/calculations
POST /api/evaluations/:evaluationId/calculations
GET  /api/calculations/:id
GET  /api/calculations/:id/participants?page=1&pageSize=50
```

Exemplo de solicitação atuarial:

```json
{
  "parameterizationId": "<uuid>",
  "planRulesVersionId": "<uuid>",
  "engineCode": "BD_PVFB"
}
```

## URLs

```text
/avaliacoes/:evaluationId/calculos
/avaliacoes/:evaluationId/calculos/:calculationId
```

A URL individual recupera a execução persistida. Ela nunca dispara recálculo. A própria tela carrega a reconciliação individual paginadamente quando a execução possui esses resultados.

## Self-tests

```bash
npm run calculation:self-test
npm run bd-pvfb:self-test
npm run plan-rules:self-test
```

O self-test BD inclui um caso fechado cuja resposta analítica é `PVFB = 9.000`, usa salário canônico `1.000,00` e verifica o mesmo `9.000` no resultado individual persistível.

A CI executa esses self-tests depois de `typecheck` e `build`.

## Próxima evolução

A infraestrutura para reconciliar o cálculo com o legado já existe em nível agregado e participante.

O próximo passo atuarial não é renomear PVFB como reserva. É implementar a apropriação do passivo conforme método de financiamento e regras efetivamente suportadas, por exemplo um engine BD específico para `PROJECTED_UNIT_CREDIT` ou outro método validado.

Somente depois disso o **Fechamento Atuarial** deve selecionar explicitamente um `CalculationRun COMPLETED`, reconciliar valores e congelar a rodada final.
