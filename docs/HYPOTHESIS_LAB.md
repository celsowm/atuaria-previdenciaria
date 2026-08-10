# Hypothesis Lab

O Hypothesis Lab executa estudos de aderência de hipóteses biométricas de forma determinística, versionada e auditável.

## Fluxo

```text
base histórica
  ↓
ano + idade + sexo + exposição + eventos observados
  ↓
seleção de versões imutáveis da Biblioteca Biométrica
  ↓
observado × esperado por idade/sexo
  ↓
χ² + KS + Z + Fisher + DQM
  ↓
ranking
  ↓
resultado persistido
```

O estudo guarda a base histórica granular por ano. O motor consolida os anos do período por idade e sexo apenas no momento da execução. Dessa forma, a informação histórica não é reduzida prematuramente.

## Entidades

```text
AdherenceStudy
  ├─ AdherenceObservation 1:N
  └─ AdherenceCandidateResult 1:N
       └─ AdherenceCandidatePoint 1:N
```

`AdherenceCandidatePoint` preserva, para cada idade/sexo:

- exposição;
- eventos observados;
- qx da versão biométrica selecionada;
- eventos esperados;
- resíduo observado - esperado.

A versão biométrica é referenciada pelo ID imutável usado no cálculo. Alterações futuras na biblioteca não mudam um estudo encerrado.

## Engine version

A primeira implementação é identificada por:

```text
adherence-engine-v1
```

Todo estudo persiste essa versão. Mudanças futuras de metodologia devem incrementar o identificador em vez de alterar silenciosamente resultados históricos.

## Qui-Quadrado

Por célula com esperado positivo:

```text
χ² = Σ (O - E)² / E
```

Os graus de liberdade iniciais são `n - 1`, onde `n` é a quantidade de células utilizáveis. O p-value usa a distribuição χ² através da função gamma regularizada.

Se uma célula possuir esperado zero e observado maior que zero, a discrepância é tratada como incompatibilidade extrema em vez de a célula ser silenciosamente descartada.

O resultado persiste:

- χ² calculado;
- graus de liberdade;
- χ² crítico no alpha do estudo;
- p-value;
- rejeição/não rejeição.

## Kolmogorov-Smirnov

O KS compara as distribuições cumulativas dos eventos observados e esperados, ordenadas por idade e sexo.

```text
D = max |F_obs(x) - F_esp(x)|
```

O p-value usa a aproximação assintótica de duas amostras e o tamanho efetivo:

```text
n_eff = n_obs * n_esp / (n_obs + n_esp)
```

O valor crítico é obtido numericamente pela mesma função utilizada para o p-value, evitando usar uma fórmula de corte diferente da implementação do teste.

## Teste Z

O teste compara a quantidade total observada com a esperada. A variância é derivada das probabilidades biométricas por célula:

```text
Var = Σ exposição * qx * (1 - qx)
Z = (O - E) / sqrt(Var)
```

O teste é bicaudal. O resultado persiste Z calculado, Z crítico, p-value e conclusão.

## Exato de Fisher

A primeira versão reproduz a ideia operacional existente nas planilhas legadas de dividir a experiência em duas faixas etárias.

O corte é configurável no estudo (`fisherSplitAge`). São calculados os eventos observados e esperados abaixo/acima do corte e aplicado Fisher exato bicaudal sobre as contagens discretizadas.

Como Fisher exige contagens inteiras, os eventos esperados são arredondados apenas para este teste. Os demais testes continuam usando os valores esperados contínuos originais.

Esse comportamento é explícito e versionado para permitir posterior calibração contra os golden masters Excel.

## DQM

O Desvio Quadrático Médio usa a diferença entre taxa observada e qx, ponderada pela exposição:

```text
DQM = Σ exposição * (taxa_observada - qx)² / Σ exposição
```

Menor DQM indica maior proximidade entre experiência e hipótese.

## Ranking

A ordenação inicial é:

1. menor quantidade de testes rejeitados;
2. menor DQM;
3. maior p-value do χ².

O ranking é um auxílio operacional. Ele não transforma automaticamente a primeira colocada em hipótese aprovada.

## Golden master

As planilhas históricas de aderência permanecem a referência para regressão. O objetivo dos próximos ciclos é alimentar o mesmo conjunto de exposições/eventos e comparar:

```text
motor atual vs Excel legado
```

para cada valor calculado, crítico, p-value, esperado e ranking. Diferenças metodológicas deverão ser documentadas e nunca mascaradas com ajustes ad hoc.
