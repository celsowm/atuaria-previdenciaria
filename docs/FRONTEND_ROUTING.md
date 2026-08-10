# Rotas amigáveis do ATUAS

O frontend usa a URL do navegador como fonte de verdade da navegação. Não existe mais um estado paralelo `page` que desaparece ao atualizar a página.

## Rotas

| Área | URL |
| --- | --- |
| Login | `/login` |
| Avaliações | `/avaliacoes` |
| Avaliação | `/avaliacoes/:id` |
| Planos | `/planos` |
| Plano | `/planos/:id` |
| Data Studio | `/data-studio` |
| Crítica de importação | `/data-studio/criticas/:id` |
| Hipóteses e Tábuas | `/hipoteses-e-tabuas` |
| Estudos de Aderência | `/estudos-de-aderencia` |
| Documentos | `/documentos` |
| Biblioteca | `/biblioteca` |
| Inteligência Artificial | `/inteligencia-artificial` |
| Administração de usuários | `/administracao/usuarios` |

A navegação usa a History API. `popstate` mantém voltar/avançar do navegador sincronizados com a aplicação e os identificadores ficam na própria URL, permitindo copiar e reabrir links diretamente.

## Autenticação e deep links

Quando um usuário sem sessão abre diretamente uma rota protegida, o ATUAS exibe `/login` e preserva internamente o destino solicitado. Após autenticar, o usuário volta para a rota original.

Uma sessão expirada também redireciona para login preservando a rota em que o usuário estava.

## Requisito do servidor web

Em desenvolvimento o Vite já atende a aplicação como SPA. Em produção, o servidor que hospedar o frontend deve encaminhar rotas que não sejam arquivos estáticos nem `/api/*` para `index.html`.

Exemplo conceitual:

```text
/api/*             -> backend ATUAS
/assets/*          -> arquivos estáticos
qualquer outra URL -> index.html
```

Sem esse fallback, navegar dentro da SPA funciona, mas abrir diretamente `/planos/<id>` no servidor pode resultar em 404 antes do React ser carregado.
