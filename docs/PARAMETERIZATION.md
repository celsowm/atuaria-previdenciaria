# Parametrização Atuarial

A Parametrização Atuarial é a fronteira entre os estudos/hipóteses da avaliação e o futuro motor de cálculo.

O princípio central é simples:

```text
hipóteses + parâmetros
        ↓
rascunho versionado
        ↓
aprovação
        ↓
snapshot imutável
        ↓
CalculationRun
```

## Por que versionar

Uma rodada de cálculo não pode depender de valores que mudam depois. Por isso cada avaliação possui versões independentes de parametrização:

```text
Avaliação #42
  ├─ Parametrização v1  SUPERSEDED
  ├─ Parametrização v2  APPROVED
  └─ Parametrização v3  DRAFT
```

Somente `DRAFT` pode ser alterada. Ao aprovar uma versão:

- ela passa para `APPROVED`;
- a aprovação recebe timestamp;
- uma versão anteriormente aprovada da mesma avaliação passa para `SUPERSEDED`;
- parâmetros e hipóteses da versão aprovada deixam de ser editáveis;
- alterações posteriores exigem uma nova versão, que pode copiar a anterior.

O futuro `CalculationRun` deverá referenciar explicitamente o `parameterizationId` aprovado utilizado na execução.

## Entidades

```text
ActuarialParameterization
  ├─ ActuarialParameterValue 1:N
  └─ ActuarialHypothesisSelection 1:N
```

### ActuarialParameterValue

Os parâmetros são tipados e extensíveis. Cada valor registra:

- código canônico;
- categoria;
- rótulo;
- tipo (`NUMBER`, `INTEGER`, `TEXT`, `BOOLEAN`);
- valor JSON canônico;
- unidade;
- origem;
- última alteração.

A primeira UI oferece parâmetros econômicos/demográficos básicos e método de financiamento, mas o modelo não fica limitado a esses campos. Parâmetros específicos de modalidade ou regulamento podem ser adicionados sem transformar a tabela em uma estrutura monolítica.

### ActuarialHypothesisSelection

Um resultado do Estudo de Aderência pode ser promovido explicitamente para a parametrização. O snapshot guarda:

- tipo de hipótese;
- estudo de aderência;
- resultado candidato;
- versão biométrica imutável;
- código e nome da tábua;
- rótulo da versão;
- posição do candidato no ranking no momento da seleção.

A promoção não significa que o candidato `#1` é automaticamente aprovado. A decisão continua sendo humana e explícita.

## URLs amigáveis

```text
/avaliacoes/:evaluationId/parametrizacao
/avaliacoes/:evaluationId/parametrizacao/:parameterizationId
```

A primeira URL resolve a lista de versões; a segunda abre uma versão específica e pode ser copiada/reaberta diretamente.

## API

```text
GET   /api/evaluations/:evaluationId/parameterizations
POST  /api/evaluations/:evaluationId/parameterizations
GET   /api/parameterizations/:id
PATCH /api/parameterizations/:id
PATCH /api/parameterizations/:id/parameters
POST  /api/parameterizations/:id/adherence-candidate
POST  /api/parameterizations/:id/approve
```

Todas as rotas exigem autenticação.

## Contrato para o próximo módulo

O motor de cálculo não deverá ler parâmetros soltos da configuração global nem consultar a "última hipótese" por conta própria.

Ele deverá receber um snapshot aprovado:

```text
CalculationRun
  ├─ evaluationId
  ├─ parameterizationId  -> APPROVED
  ├─ engineVersion
  ├─ input fingerprints
  └─ resultados
```

Assim uma execução histórica continua reproduzível mesmo quando a avaliação já estiver na v3, v4 ou v5 da parametrização.
