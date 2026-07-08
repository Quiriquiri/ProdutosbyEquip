# Filtros & Óleos — Localizador de peças

App web simples (HTML/CSS/JS puro, sem instalação nem servidor) para procurar, por equipamento, todos os **filtros** e **óleos/lubrificantes** que utiliza — com referência interna (Ref1), designação (Design1) e localização nas racks do armazém (Corredor / Prateleira / Divisão / Caixa ou nível).

Os dados vêm do ficheiro `Lista_de_equipamento_por_referência_de_manutenção.xlsx` que enviou.

## ⚠️ Nota importante sobre as localizações

No ficheiro Excel original, as colunas **Corredor, Prateleira, Divisão da prateleira e Caixa ou nível** vinham praticamente todas vazias (só o cabeçalho tinha texto). Ou seja, ainda não há localização nenhuma associada às peças.

Por isso a app foi feita para funcionar já sem essa informação e para a poder ir preenchendo aos poucos:

- Cada linha de resultado tem um botão **Editar** para preencher a localização daquela referência.
- As edições ficam guardadas no navegador (localStorage), por isso não se perdem ao recarregar a página, mas ficam só nesse computador/navegador.
- Para partilhar as localizações com todos os que usam a app, use o botão **Exportar localizações (JSON)** no rodapé — isso descarrega um ficheiro `locations.json`. Substitua o ficheiro `locations.json` na raiz do repositório por esse ficheiro e faça commit/push. A app vai buscar sempre este ficheiro primeiro (dados "oficiais"), e cada pessoa pode depois continuar a fazer os seus próprios ajustes locais por cima.
- O botão **Importar localizações** serve para carregar um `locations.json` (por exemplo, feito por um colega) para dentro do seu navegador.

## Estrutura do projeto

```
index.html      página principal
style.css       estilos
app.js          lógica da app (pesquisa, tabela, edição de localizações)
data.json       dados extraídos do Excel (equipamentos, referências, filtros/óleos)
locations.json  localizações "oficiais" (começa vazio: {})
```

Não há build, não há dependências, não há backend. É só abrir `index.html` num browser, ou publicar os ficheiros em qualquer alojamento estático.

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (por exemplo `filtros-oleos`), público.
2. No seu computador, dentro da pasta com estes ficheiros, execute:

```bash
git init
git add .
git commit -m "App localizador de filtros e óleos"
git branch -M main
git remote add origin https://github.com/<o-seu-utilizador>/filtros-oleos.git
git push -u origin main
```

3. No GitHub, vá a **Settings → Pages**.
4. Em "Build and deployment", escolha **Source: Deploy from a branch**, branch **main**, pasta **/(root)**.
5. Guarde. Ao fim de 1-2 minutos a app fica disponível em:

```
https://<o-seu-utilizador>.github.io/filtros-oleos/
```

Não precisa de mais nenhuma configuração (não há Jekyll a evitar, os ficheiros são servidos tal como estão).

## Atualizar os dados no futuro

Se o Excel de manutenção for atualizado (novos equipamentos, novas referências), basta gerar de novo o `data.json` a partir do Excel e substituir o ficheiro no repositório — a estrutura de `parts`, `equipParts` e `equipmentList` tem de se manter igual para a app continuar a funcionar.
