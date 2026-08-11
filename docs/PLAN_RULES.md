# Regras Atuariais Versionadas do Plano

O cadastro mestre `Plan` identifica o plano. Regras de benefício, contribuição e elegibilidade não ficam misturadas nesse cadastro porque mudam por regulamento, nota técnica e vigência.

```text
Plan
  └─ PlanRulesVersion 1:N
        └─ PlanRuleValue 1:N
```

## Princípio

Uma avaliação atuarial histórica precisa conseguir demonstrar quais regras do plano foram usadas. Por isso as regras seguem:

```text
DRAFT
  ↓ aprovação
APPROVED
  ↓ nova versão aprovada
SUPERSEDED
```

Somente `DRAFT` pode ser alterada. Uma versão aprovada mantém seus valores e fingerprint para referência futura.

Cada versão guarda também a modalidade (`BD`, `CD` ou `CV`) como snapshot. Depois que um plano possui qualquer versão de regras, sua modalidade não pode ser alterada no cadastro mestre.

## Vigência

`effectiveFrom` é obrigatório para aprovação. `effectiveTo` é opcional, mas, quando informado, não pode ser anterior ao início.

Ao copiar uma versão anterior, os valores e notas podem ser reaproveitados, mas a nova versão **não herda automaticamente a vigência**. O usuário precisa confirmar a data do novo regulamento antes de aprovar.

## Valores tipados

`PlanRuleValue` usa o mesmo padrão extensível de valores tipados adotado na Parametrização:

- `code` canônico;
- categoria;
- rótulo;
- tipo (`NUMBER`, `INTEGER`, `TEXT`, `BOOLEAN`);
- `valueJson` canônico;
- unidade;
- origem/referência;
- estado ativo interno.

A atualização do rascunho trata a lista enviada como o conjunto ativo. Regras retiradas são desativadas em vez de apagadas fisicamente.

## Catálogo inicial da UI

A UI oferece um catálogo operacional inicial, sempre sem valores default.

Comum às modalidades:

```text
ELIGIBILITY.NORMAL_RETIREMENT_AGE
ELIGIBILITY.MINIMUM_PLAN_MEMBERSHIP_YEARS
ELIGIBILITY.MINIMUM_SPONSOR_SERVICE_YEARS
CONTRIBUTION.PARTICIPANT_RATE
CONTRIBUTION.SPONSOR_RATE
BENEFIT.PAYMENTS_PER_YEAR
```

BD adiciona campos de base de cálculo, taxa de reposição e período de média salarial.

CD adiciona base em saldo de conta, limite de matching e indicação de conversão atuarial do saldo em renda.

CV adiciona contrato inicial para componente híbrido, contribuição variável e componentes definido/saldo de conta.

Esses campos não são valores regulatórios inventados pelo sistema. O usuário deve transcrevê-los do regulamento ou da nota técnica. A API permite regras adicionais sem exigir alteração do modelo relacional.

Regras adicionais que ainda não possuem componente visual aparecem como **Regras adicionais** na tela e são preservadas integralmente quando o formulário é salvo. A UI não pode apagar ou desativar extensões apenas por não conhecê-las.

## Fingerprint

Na aprovação é calculado SHA-256 sobre o contrato canônico:

```text
planId
+ versão
+ modalidade
+ vigência
+ regras ativas ordenadas
+ tipo/unidade/origem
```

O fingerprint serve para auditoria e para compor futuramente o `inputFingerprint` de um `CalculationRun` atuarial.

## Relação Avaliação → Plano

`Evaluation` agora possui `planId` opcional com FK para `plans`. `planName` continua sendo o snapshot textual exibível.

Bases existentes recebem um backfill somente quando existe **exatamente um** plano cujo nome seja igual ao `planName` histórico. Situações sem correspondência ou ambíguas permanecem com `planId = null`; o sistema não adivinha vínculos.

## API

```text
GET   /api/plans/:planId/rules
POST  /api/plans/:planId/rules
GET   /api/plan-rules/:id
PATCH /api/plan-rules/:id
PATCH /api/plan-rules/:id/values
POST  /api/plan-rules/:id/approve
```

## URLs

```text
/planos/:planId/regras
/planos/:planId/regras/:rulesVersionId
```

## Self-test

O smoke test do domínio cria um SQLite temporário e valida versionamento, fingerprint, vigência, cópia, desativação de regras, supersessão e bloqueio de mudança de modalidade:

```bash
npm run plan-rules:self-test
```

O arquivo temporário é removido ao final e não utiliza a base operacional da aplicação.

## Contrato para o engine atuarial

O engine oficial não deve inferir regras a partir do cadastro atual do plano. Uma futura execução `ACTUARIAL` deverá receber explicitamente:

```text
Evaluation.planId
+ PlanRulesVersion APPROVED
+ ActuarialParameterization APPROVED
+ frozen canonical imports
+ engine code/version
```

O `CalculationRun` deverá persistir o `planRulesVersionId` e o fingerprint aprovado das regras. Assim uma alteração regulatória posterior não modifica o significado de uma execução histórica.
