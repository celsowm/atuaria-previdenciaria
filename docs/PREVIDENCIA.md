# Modelo previdenciário

O banco físico usa somente nomes em português:

```text
entidades_previdencia → planos → submassas → beneficios
```

Uma submassa é o snapshot regulatório temporal de um plano. Ela começa em `RASCUNHO` e, após aprovada, torna-se imutável. Para alterar regras, cadastre outra submassa com o mesmo código e vigência sem sobreposição.

Os benefícios guardam JSON declarativo em português:

- grupos de elegibilidade `TODOS` e `QUALQUER`;
- critérios `IDADE_MINIMA`, `IDADE_MAXIMA`, `TEMPO_PLANO_MINIMO`, `TEMPO_PATROCINADOR_MINIMO` e `APOSENTADO_INSS`;
- componentes `SALARIO_CONTRIBUICAO`, `BENEFICIO_INSS` e `UNIDADE_REFERENCIA`;
- operadores `SOMA`, `SUBTRACAO`, `MULTIPLICACAO`, `DIVISAO`, `MINIMO`, `MAXIMO` e `FAIXAS`.

Valores de unidades de referência possuem vigência própria em `valores_unidade_referencia` e não podem se sobrepor.

O endpoint `POST /api/beneficios/:id/avaliar` aplica elegibilidade e a fórmula declarativa a um participante na data informada. Ele suporta todos os tipos de benefício para apuração do valor; a projeção atuarial PVFB continua limitada à aposentadoria.

## Reinicialização local

O modelo é uma quebra incompatível com a base anterior. Para criar uma base local demonstrativa limpa, execute:

```bash
npm run banco:reiniciar -w @atuaria-previdenciaria/backend
```

O comando só remove o arquivo SQLite dentro do repositório e nunca é executado automaticamente pela aplicação.
