# 📚 Campaign Codex

[![CI](https://img.shields.io/github/actions/workflow/status/flippelt/campaign-codex/ci.yml?label=CI)](https://github.com/flippelt/campaign-codex/actions) [![Last commit](https://img.shields.io/github/last-commit/flippelt/campaign-codex)](https://github.com/flippelt/campaign-codex/commits) [![License](https://img.shields.io/github/license/flippelt/campaign-codex)](https://github.com/flippelt/campaign-codex/blob/main/LICENSE) ![Top language](https://img.shields.io/github/languages/top/flippelt/campaign-codex) ![Repo size](https://img.shields.io/github/repo-size/flippelt/campaign-codex) ![Issues](https://img.shields.io/github/issues/flippelt/campaign-codex)

Um **wiki de campanhas de RPG**: história, mapas, acontecimentos, NPCs e
personagens — multi-campanha, com temas por gênero (sci-fi, fantasia, cyberpunk,
fallout, warhammer), bom suporte a emoji, menu responsivo e manutenção simples
(é só escrever Markdown).

**Stack:** [Astro](https://astro.build) + content collections. 100% estático,
sem backend.

---

## Rodando localmente

Requer **Node 22+**.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # site completo → dist/
```

---

## Criando conteúdo

Tudo é Markdown. Duas coisas: **campanhas** e **entradas**.

### 1. Campanha

Um arquivo por campanha em `src/content/campaigns/<id>.md`:

```markdown
---
name: As Crônicas de Valdoran
theme: fantasy # sci-fi | fantasy | cyberpunk | fallout | warhammer
emoji: ⚔️
summary: Um reino dividido pela Grande Fenda.
order: 2
demo: true # aparece na demo pública (Pages)? padrão: false
---

Texto de abertura da campanha (Markdown).
```

### 2. Entradas

Cada página de conteúdo é um arquivo em:

```
src/content/entries/<campanha>/<tipo>/<slug>.md
```

A **campanha** e o **tipo** vêm da pasta — é só soltar o arquivo no lugar certo.
Tipos disponíveis (nome da pasta):

| Pasta        | Tipo               |
| ------------ | ------------------ |
| `lore`       | 📜 Lore & História |
| `npcs`       | 🧠 NPCs            |
| `characters` | 🎭 Personagens     |
| `events`     | ⚡ Acontecimentos  |
| `maps`       | 🗺️ Mapas & Locais  |

Exemplo `src/content/entries/valdoran/npcs/mestre-corvo.md`:

```markdown
---
title: Mestre Corvo
emoji: 🐦‍⬛
summary: Conselheiro arcano da corte de Pedravale.
status: vivo
role: Conselheiro Arcano
faction: Casa Pedravale
location: Pedravale
date: Inverno do 12º ano # eventos; aceita texto ou data
image: /maps/valdoran.svg # opcional (em public/ ou URL)
tags: [mago, misterioso]
draft: false # rascunho some do build de produção
order: 1
---

Conteúdo em Markdown. Emojis funcionam normalmente. 🪶
```

Os campos opcionais (`status`, `role`, `faction`, `location`, `date`, `image`,
`tags`) viram a "ficha" lateral e os chips dos cards. Nenhum é obrigatório além
de `title`.

### Temas

Cada campanha escolhe um `theme`; as paletas/fontes ficam em
[`src/styles/themes.css`](src/styles/themes.css), por `data-theme`. Para criar um
tema novo, adicione um bloco `[data-theme="meu-tema"]` lá e inclua o id em
`THEME_IDS` ([src/content.config.ts](src/content.config.ts)).

---

## Demo & deploy

- **Site completo** → Netlify (raiz do domínio), via [`netlify.toml`](netlify.toml).
- **Demo pública** → GitHub Pages, via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
  A demo roda `npm run build:demo` e publica **apenas as campanhas com `demo: true`**;
  suas campanhas privadas ficam de fora.

```bash
npm run build:demo      # base padrão "/"
BASE=/campaign-codex/ npm run build:demo   # como no Pages
```

---

## Licença

MIT © 2026 Felipe Lippelt.
