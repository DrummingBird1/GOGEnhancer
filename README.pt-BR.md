<p align="center">
  <img src="docs/assets/hero-icon.png" width="96" height="96" alt="GOG Enhancer logo" />
</p>

<h1 align="center">GOG Enhancer</h1>

<p align="center">
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/extension/manifest.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FDrummingBird1%2FGOGEnhancer%2Fmain%2Fextension%2Fmanifest.json&query=%24.version&label=version&color=c64fff" alt="version" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-00f0ff" alt="Manifest V3" />
  <a href="https://github.com/DrummingBird1/GOGEnhancer/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/DrummingBird1/GOGEnhancer/test.yml?branch=main&label=tests&color=7fffa6" alt="tests" /></a>
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ff6b9d" alt="MIT license" /></a>
</p>

<p align="center">Chromium-based browsers (Chrome, Edge, Brave, Opera)</p>

<p align="center"><a href="README.md">English</a> · <a href="README.he.md">עברית</a> · <a href="README.ru.md">Русский</a> · <a href="README.pl.md">Polski</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.pt-BR.md">Português (Brasil)</a></p>

Uma extensão de terceiros não oficial para o GOG.com: conversão de moedas em tempo real, histórico de preços, comparação com outras lojas, tags pessoais, uma melhoria visual completa, hebraico + RTL — sem Google Fonts e sem análises.

> **Aviso legal:** esta é uma extensão de terceiros não oficial. Ela não tem ligação com a GOG sp. z o.o. nem com a CD Projekt S.A., e não é endossada nem patrocinada por elas. O nome "GOG" é usado apenas para designar a loja com a qual a extensão funciona.

---

## 📂 Conteúdo do repositório

| Arquivo / pasta | Finalidade |
|---|---|
| **`extension/`** | **A extensão distribuída** — `manifest.json` mais `background/`, `content/`, `lib/`, `popup/`, `options/`, `onboarding/`, `tags/`, `tour/`, `icons/`. É a pasta que você carrega com "Carregar sem compactação" e a que vai para o zip. |
| **`store/`** | Material da loja que **não faz parte** da extensão: `STORE_LISTING.md` (textos do painel), `listings/` (descrição da loja, um arquivo por idioma), `screenshots/` (dez por idioma, geradas por `e2e/store-screenshots.mjs`), `brand/` (logo e imagens promocionais), `release-images/` (banners de versão, veja `CLAUDE.md`). Enviado separadamente, nunca incluído no zip. |
| **`docs/`** | O site da extensão no GitHub Pages — página inicial, guia, política de privacidade, registro de alterações. |
| `PRIVACY.md` | Política de privacidade (também disponível em um endereço público: `docs/privacy.html`) |
| `README.he.md`, `README.ru.md`, `README.pl.md`, `README.de.md`, `README.fr.md`, `README.es.md`, `README.zh-CN.md`, `README.pt-BR.md` | Traduções completas deste arquivo, uma por idioma de interface |
| `LICENSE` | Licença MIT |
| `build.ps1` | Script de build — compacta `extension/` em `dist/gog-enhancer-webstore.zip` (`node scripts/build-firefox.mjs` gera o zip experimental para Firefox) |
| `scripts/`, `e2e/` | Script de publicação (`release.mjs`), o build para Firefox e as ferramentas de ponta a ponta: a suíte do Playwright (fixtures, site real, com login), um orçamento de desempenho, um gravador de estrutura, regressão de capturas, um coletor de textos para as traduções e o gerador de capturas da loja. Apenas local; nada disso é distribuído. |
| `dist/` | Resultados do build (ignorados pelo git). Regenerados por `build.ps1` |
| `tests/`, `package.json`, `vitest.config.js`, `eslint.config.js` | Vitest e ESLint para os módulos utilitários puros. Não incluídos no zip da extensão. |
| `.github/workflows/` | GitHub Actions: `test.yml` executa lint e testes em push/PR, `release.yml` gera o zip e publica uma versão ao enviar uma tag `v*.*.*`, `canary.yml` é uma verificação agendada do site real |
| `CLAUDE.md` | Notas do projeto para assistentes de IA |
| `README.md` | Versão em inglês deste arquivo |

---

## ✨ Visão geral dos recursos

### Arquitetura
- **Uma camada de armazenamento unificada** — preferências em `storage.sync` (leve, sincronizado entre dispositivos), dados mais pesados (tags, histórico, caches) em `storage.local`. Nenhuma cota é ultrapassada.
- **Versionamento e migração de configurações** — ao atualizar da v1, tags e notas passam automaticamente de sync para local.
- **Apenas fontes do sistema** — nenhuma dependência do Google Fonts, nenhum código remoto, nenhuma análise.
- **Uma única camada de rede** (`lib/net.js`) — toda requisição da extensão passa por ela: uma lista de cinco hosts permitidos, sem cookies, sem referer, com tempo limite e um registro local de "host + caminho" (nunca a consulta) que a página de configurações avançadas mostra. Um teste quebra o build se uma permissão ou host mudar sem que os documentos de privacidade digam isso.
- **Um único adaptador do site** (`content/gog-dom.js`) — cada busca na marcação do gog.com (cards, preços, título, posição do painel) tenta várias estratégias, de modo que um redesign degrada os recursos com elegância em vez de quebrá-los em silêncio. "Verificar esta página" nas configurações avançadas mostra quais buscas ainda funcionam.
- **`MutationObserver` focado** no conteúdo da página, com debounce; o ruído do cabeçalho é filtrado e a troca de `<main>` é detectada.
- **Cada recurso roda isolado** — se uma busca quebrar após uma mudança no site, apenas esse recurso é desligado e o resto continua; "Verificar esta página" lista o que falhou.
- **Aprende apenas com as páginas que você abre** — posse de jogos, avaliações, idiomas e fatos de preço são lidos de páginas que você mesmo visita e guardados localmente. A extensão não busca nada extra.

### Recursos
- 💱 **Taxas em tempo real para 24 moedas** — o xéquel, o euro, a libra, o zloty, o rublo, o real, o iene, o yuan e outras, buscadas automaticamente em `api.frankfurter.dev` a cada 12 horas. Editáveis manualmente.
- 📈 **Acompanhamento de preços** — cada visita à página de um jogo registra uma amostra. Um painel de estatísticas na página do jogo mostra o preço atual, a mínima histórica e a média, além de um veredicto "Vale a pena esperar?".
- 🔍 **Comparar no IsThereAnyDeal** — um botão na página do jogo busca o mesmo título na Steam / Epic / Humble / Fanatical.
- 🏷️ **Painel de tags completo** — uma página separada com busca, filtros, contagem por tag e exportação em CSV. Autocompletar para tags existentes.
- 🔔 **Alertas e ofertas da lista de desejos** — um selo no ícone da barra conta os itens em promoção da lista; o popup mostra as três maiores quedas de preço que você acompanha.
- 🛡️ **Banner DRM-free** — um banner sólido com ícone de escudo e uma pílula "GOG+" em degradê.
- 🎨 **Melhoria visual dos cards** — conforme o jogo: "Good Old Game" ganha um sutil efeito CRT e um halo dourado; títulos de Cyberpunk/Witcher ganham um brilho neon ciano/magenta.
- 🪟 **Dicas estilizadas** — substituem as dicas padrão do navegador, com títulos, conteúdo rico e posicionamento automático.
- 📋 **Lista de mods dinâmica** — obtida automaticamente de `gog.com/en/mods` a cada 24 horas.
- 🌍 **Detecção automática da moeda da página** — se a GOG já mostra EUR (usuários da UE), a extensão não converte de novo.
- 🎯 **RTL correto** — `inline-start`/`end` em vez de `left`/`right` e `unicode-bidi: isolate` para os preços.
- ⌨️ **Atalhos de teclado** — `Alt+G` abre o popup, `Alt+Shift+G` liga/desliga a extensão, `Alt+Shift+H` alterna o hebraico; `Ctrl/Cmd+K` abre uma paleta de comandos para todo o resto.
- 🧙 **Assistente de primeiro uso** — 4 etapas (moeda, região, recursos, tema), abre sozinho na primeira instalação.
- ☁️ **Sincronização entre dispositivos por uma pasta que você escolhe** (Dropbox, OneDrive, Google Drive, Syncthing…) — mescla tags, notas, status, compras, alertas e histórico de preços por registro, com criptografia opcional. Nada nosso no meio. Chrome / Edge / Brave.
- 🔎 **Busca na biblioteca pela barra de endereço** — digite `gog` + Tab e depois o nome de um jogo, `tag:rpg` ou `status:backlog`.
- 🎨 **Tema "Native"** — usa as cores e a fonte do próprio gog.com, para que a interface adicionada se misture com a aparência que o site tiver.
- ⌨️ **Navegação por teclado** (opcional) — `J`/`K` movem entre os jogos de uma lista, `T` marca o jogo em foco com uma tag.
- 📅 **Arquivos de calendário (`.ics`)** para prazos de reembolso e datas de lançamento de jogos da lista de desejos, e 📝 **exportações para Markdown / Obsidian / CSV** a partir do painel de tags — tudo gerado no seu dispositivo.
- 🌍 **Nove idiomas de interface** — painel de tags, configurações avançadas, popup, assistente de primeiro uso e os textos próprios da extensão no gog.com em inglês, hebraico (da direita para a esquerda), russo, polonês, alemão, francês, espanhol, chinês simplificado e português do Brasil. O que você escreve (nomes de tags, notas) nunca é traduzido.
- 🔒 **Painel de privacidade** nas configurações avançadas — cada endereço que a extensão contatou, o que ela guarda no seu dispositivo e quanto, o acesso extra a sites que o Chrome concedeu a ela e a limpeza com um clique.
- 🩺 **Relatório de falha** — quando um recurso para de funcionar após uma mudança no site, o popup oferece um relatório com um clique, sem endereços da web nem dados pessoais ("Relatar no GitHub" apenas abre uma página já preenchida).
- 🖥️ **Verificação do sistema** nas páginas de jogos — compara o requisito de RAM do jogo com o que o seu navegador informa (navegadores não enxergam CPU nem GPU). Descreva o seu computador nas configurações avançadas e os requisitos de RAM e de espaço livre em disco são comparados com ele; sistema operacional, processador e placa de vídeo aparecem ao lado do requisito, mas não são avaliados — é uma estimativa.

#### Ofertas e preços (v4)
- 💸 **"O desconto é real?"** — compara o preço base com o menor preço dos últimos 30 dias da própria GOG e com o seu histórico acompanhado; ⏳ **contagem regressiva da oferta** na página do jogo, nos cards e no resumo.
- **Preço por hora de jogo**, **preço em várias moedas** ao mesmo tempo, um **ritmo de promoções** por jogo, um **gráfico comparativo** para 2–3 jogos, totais de **"quanto economizei"** e **predefinições de imposto** nacionais (DE, FR, ES, IT, NL, RU).

#### Lista de desejos e catálogo (v4)
- 💖 **Lista de desejos inteligente** — ordenação por desconto / distância da mínima / preço convertido / data de adição, filtros "perto da mínima" e "terminando em breve", um total em tempo real, agrupamento por tag ou status, exportação em CSV / Markdown / `.ics`.
- 🗂️ **Ferramentas de catálogo** — uma barra acima da grade: esmaecer ou ocultar jogos que você já tem, **sem interesse** (reversível), ordenação local da página, densidade compacta / lista, filtros salvos, tags e acompanhamento em lote, comparação lado a lado.
- ♾️ **Rolagem infinita** (opcional, desativada por padrão) — ao chegar ao fim de uma página do catálogo, a próxima é adicionada abaixo, a partir da API de catálogo da própria GOG (`catalog.gog.com`, a mesma chamada que o site faz).

#### Página do jogo e biblioteca (v4)
- 🎮 **Verificação de idiomas**, **o que mudou desde a sua última visita**, filtro de avaliações, **jogos semelhantes que você já tem**, **o que um pacote realmente contém** (lido da página do próprio pacote ou da API de produtos da GOG uma vez por página de jogo — só um id numérico é enviado) com um aviso quando ele se sobrepõe ao que você possui, links "abrir em" para Steam / IsThereAnyDeal / PCGamingWiki / HowLongToBeat / SteamDB e os atalhos `W` / `N` / `A`.
- 📚 **Aprende a sua biblioteca enquanto você navega** (pelo rótulo "IN LIBRARY" do próprio site), o que permite ocultar jogos que você já tem, estatísticas reais da biblioteca, uma roleta ponderada de pendentes, uma meta mensal de "jogos para zerar" e **cartões Wrapped / de colecionador** que podem ser salvos como PNG.
- 📝 **Histórico de versões das notas**, exportação para um **cofre do Obsidian** (`.zip`) e exportações em CSV / por linhas para **Notion, Planilhas Google e Trello**.
- 🏆 **36 conquistas** em três níveis (algumas ocultas), uma **sequência** de dias navegando e três **desafios mensais** — tudo local.
- ♿ **Um painel que dá para usar pelo teclado** — um link para pular ao conteúdo, tags reordenadas com `Alt`+`↑`/`↓`, menus e diálogos que mantêm o foco e avisos falados das mudanças para leitores de tela.

#### Sincronização, notificações e aparência (v4)
- 🔄 **Sincronização automática da pasta** (a cada 30 minutos e ao abrir o painel, quando o navegador ainda lembra a permissão da pasta e o arquivo não está criptografado com senha), uma lista de conflitos e backups datados mantidos na pasta (no máximo uma vez por dia, ao abrir o painel).
- 🔔 **Horários e dias da semana silenciosos**, um modo de **um resumo por dia**, limites, **alertas por tag**, um **radar de temporadas** opcional, um resumo semanal mais completo que você pode salvar como página da web, um cartão da lista de desejos que pode salvar como PNG — e um **webhook opcional para um endereço seu** (veja a tabela de permissões).
- 🎨 **Recolher / acoplar / reordenar** o painel do jogo, **modo calmo**, uma **aparência simples** com um clique, paletas para daltonismo, escala do texto, perfis de configurações e um breve **tour** após a atualização.

### Módulo de melhoria visual
Ativado pela chave "Design injection" no popup. Quando está ligada:
- Os preços usam em todo lugar uma fonte monoespaçada (`ui-monospace` / Cascadia / JetBrains) com algarismos tabulares.
- Cards conforme a época: linhas de varredura para clássicos, brilho neon para títulos da era cyberpunk.
- Profundidade e sombras sutis, um fundo em degradê, microinterações ao passar o mouse.
- A pílula "Good Old Game" ganha um degradê dourado metálico em vez de um roxo chapado.
- Carregadores esqueleto com animação de brilho em vez de marcadores `{{ product.title }}` expostos.
- Layout limpo: oculta promoções expiradas de anos anteriores.
- Onze temas (Neon, Classic GOG, CRT Green, Sunset, Light, AMOLED, Amber, High contrast, Custom, Auto, Native) — o Auto segue a preferência claro/escuro do sistema; o Native segue a aparência do gog.com.

### Privacidade sem rodeios
- **Apenas cinco domínios** (mais o único endereço de webhook que você mesmo pode digitar, só se ativar isso) recebem requisições de rede — e cada requisição aparece nas configurações avançadas (Privacidade e transparência):
  1. `www.gog.com` — para ler o conteúdo das páginas e inserir a interface, e a lista pública de mods uma vez por dia.
  2. `api.frankfurter.dev` — para as taxas de câmbio (sem chave de API, sem rastreamento).
  3. `www.cheapshark.com` — a tabela opcional de comparação de preços nas páginas de jogos (gratuita, sem chave; desative no popup).
  4. `api.gog.com` — a API de produtos da própria GOG, consultada uma vez por página de jogo para saber quais jogos um pacote contém (só o id numérico é enviado; ativada por padrão, desative em *Catálogo, lista de desejos e biblioteca*).
  5. `catalog.gog.com` — a API de catálogo da própria GOG, usada apenas se você ativar a rolagem infinita (desativada por padrão).

  As duas últimas não aparecem na tabela de permissões porque são chamadas a partir da página sob as próprias regras cross-origin da GOG — as mesmas chamadas que o site faz —, então o Chrome não mostra nenhum aviso extra na instalação.
- **A sincronização de pasta não faz nenhuma requisição de rede por conta própria** — ela lê e grava um arquivo em uma pasta que você escolhe; quem faz o envio é o seu próprio cliente de nuvem.
- **O webhook é opcional e é seu** — nada é solicitado na instalação. Se você digitar o seu próprio endereço `https://` nas configurações avançadas, o navegador pergunta uma vez se permite aquela única origem; só o texto da notificação é enviado, e o endereço nunca sai do seu dispositivo por exportação ou sincronização.
- **Zero análises, zero gtag, zero Google Fonts.**
- **Tags, notas e histórico ficam no seu dispositivo** em `chrome.storage.local`. Nada sai dali.
- **Código aberto** — cada linha de código está neste repositório.

---

## 🚀 Instalação

1. Baixe `gog-enhancer-webstore.zip` na página de [Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) e extraia em qualquer lugar (ou, se você clonou o repositório, use diretamente a pasta `extension/`).
2. Abra o Chrome e vá para `chrome://extensions/`.
3. Ative o **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e escolha a pasta extraída (ou `extension/`).
5. O assistente de primeiro uso abre sozinho em uma nova aba. Siga as etapas.
6. Acesse o [gog.com](https://www.gog.com) — a extensão está ativa.

---

## 🌐 Suporte a navegadores

| Navegador | Situação |
|---|---|
| **Chrome** | ✅ Totalmente compatível — é o alvo principal. |
| **Edge, Brave, Opera** (baseados em Chromium) | ✅ Funciona como o Chrome — mesmo motor, mesmas etapas de "Carregar sem compactação". |
| **Firefox** | ⚠️ Experimental / não verificado. `node scripts/build-firefox.mjs` gera uma variante para Firefox (uma página em segundo plano no lugar do service worker, um id de complemento, uma declaração de "não coleta nada") limpa no `web-ext lint`, e o zip é anexado a cada versão do GitHub — mas **ela nunca foi executada em um Firefox de verdade**, e a sincronização de pasta precisa de uma API que o Firefox não tem. O caminho de instalação suportado é a página da Chrome Web Store; usuários do Edge podem instalar a mesma extensão de lá ou usar "Carregar sem compactação" (o Edge Add-ons ainda não tem página). |

---

## ⌨️ Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Alt+G` | Abrir o popup |
| `Alt+Shift+G` | Ligar/desligar o GOG Enhancer |
| `Alt+Shift+H` | Ligar/desligar as traduções para hebraico |
| `Ctrl/Cmd+K` (no gog.com) | Abrir a paleta de comandos |
| `J` / `K` / `T` (em listas de jogos, opcional) | Jogo anterior/próximo, marcar o jogo em foco com uma tag |
| `W` / `N` / `A` (na página de um jogo, opcional) | `W` aperta o botão de lista de desejos do site (alterna), `N` vai para a caixa de notas, `A` para a de alerta de preço; `?` lista as teclas |
| `gog` + `Tab` (barra de endereço) | Buscar na sua própria biblioteca |

Os atalhos podem ser alterados em `chrome://extensions/shortcuts`.

---

## ⚙️ Permissões explicadas

| Permissão | Para quê |
|---|---|
| `storage` | Salvar preferências, tags e histórico |
| `alarms` | Agendar as atualizações em segundo plano de taxas, mods e lista de desejos |
| `notifications` | Somente se você ativar — avisos na área de trabalho sobre prazos de reembolso e ofertas da lista de desejos |
| Host: `www.gog.com` | Inserir a interface nas páginas da GOG |
| Host: `api.frankfurter.dev` | Buscar as taxas de câmbio |
| Sem permissão: `www.cheapshark.com` | Comparação opcional de preços entre lojas nas páginas de jogos — o CheapShark permite leitura cross-origin, então nenhuma permissão de host é declarada |
| Host opcional: qualquer origem `https://` | **Nunca concedida na instalação.** Solicitada em tempo de execução, para uma única origem, se você digitar o seu próprio endereço de webhook nas configurações avançadas; só o texto da notificação é enviado a ele |

Nenhuma permissão é necessária para a sincronização de pasta (você concede uma pasta por vez, com um clique) nem para a palavra-chave da barra de endereço.

---

## 🛠️ Limitações conhecidas

- **A adaptação ao redesign foi conferida no site real, mas o gog.com continua mudando** — a página inicial, o catálogo e a página do jogo foram inspecionados e exercitados de ponta a ponta (sem login) em 2026-10-02; as páginas da conta (lista de desejos, biblioteca, carrinho) exigem login e só foram inspecionadas estruturalmente. O site hoje mistura duas gerações de marcação, então espere mais mudanças. Se algo parar de funcionar após uma atualização do gog.com, use *Configurações avançadas → Verificar esta página*.
- **A sincronização de pasta resolve conflitos pelo relógio de cada dispositivo** — vence a última edição de cada registro (os registros sobrescritos são listados na página de configurações), então relógios muito desajustados podem escolher o vencedor errado. Ela precisa da File System Access API (Chrome, Edge, Brave; não o Firefox), e o acesso à pasta precisa ser concedido de novo, de vez em quando, na página de configurações. A tarefa em segundo plano não consegue pedir permissão nem senha, então, se faltar uma delas, pula a sincronização em silêncio até você abrir o painel. Foi testada com uma pasta local, não com um cliente real de sincronização em nuvem.
- **Nem tudo na v4 pôde ser verificado no site real** — os recursos que dependem de estar logado (linhas da lista de desejos, posse da biblioteca, quais jogos um pacote sobrepõe) foram construídos a partir da *estrutura* gravada das páginas e de testes unitários e de ponta a ponta, não exercitados com uma conta real. O webhook não foi testado contra um endpoint real, e o Firefox não foi testado.
- **A rolagem infinita precisa que a API de catálogo da GOG continue como está** — ela só continua uma lista que consiga associar à da tela, usando a consulta que o próprio site passou à página. Se a GOG restringir essa API, o recurso simplesmente para de acrescentar jogos; nada mais é afetado. As entradas do calendário de lançamentos só existem para jogos cuja página você abriu (a própria lista de desejos mostra apenas o ano).
- **As traduções não foram revisadas** — os oito idiomas de interface além do inglês foram escritos sem revisão de falantes nativos; um projeto que começou pelo hebraico, então o hebraico recebeu mais atenção. Textos que aparecem só depois de uma ação (alguns diálogos e mensagens de erro) estão cobertos, mas qualquer novidade sem tradução simplesmente fica em inglês.
- **Não construído:** um detector de carrinho e brindes, um painel lateral e menus de contexto (cada um exigiria uma nova permissão).
- **Coleta da lista de mods** — depende de `gog.com/en/mods` manter uma estrutura parecida. Se ela regredir, force a atualização nas configurações avançadas.
- **Contador do selo da lista de desejos** — baseia-se numa contagem ao vivo no DOM ao visitar `/account/wishlist` (validade de 24 h). Se você não visitou recentemente, o selo fica vazio até a próxima visita — a dica do ícone sugerirá visitar.
- **O cronômetro de reembolso depende de uma data digitada à mão** — a GOG não expõe a data da compra em nenhum DOM público, então a contagem de 30 dias depende de uma data que você digita no painel. Sem data, sem contagem.
- **A detecção de gêneros é parcialmente automática (desde a v2.6.0)** — Horror/Role-playing/Strategy são lidos do campo real "Genre:" da página do jogo e guardados em cache por slug (`gameGenres`) na primeira visita. Sci-fi e Indie ainda dependem de casar títulos conhecidos por expressão regular — na GOG eles parecem ficar na nuvem mais ampla de "Tags" e não em "Genre:", e essa estrutura não foi totalmente verificada. Até que um jogo específico seja visitado, os cinco grupos de gênero recorrem à expressão regular.
- **A conversão entre moedas sempre passa pelo USD** — se faltar em `rates` a taxa de qualquer um dos dois pares, a conversão não acontece. Todas as taxas são buscadas automaticamente a cada 12 horas em frankfurter.dev.
- **Alertas de preço de toda a lista de desejos, ofertas da lista e valor da lista só cobrem jogos que você visitou** — os três dependem de `priceHistory`, que só é construído visitando a página do próprio jogo. Um jogo da lista que você nunca visitou não tem dados para comparar, então não aparecerá nos alertas, nas "Ofertas da lista de desejos" do popup nem na estatística "Valor da lista de desejos", mesmo que o preço tenha caído.

---

## 📜 Registro de alterações

O histórico completo de versões está na [página de Releases do GitHub](https://github.com/DrummingBird1/GOGEnhancer/releases) — cada versão tem a sua própria página, com o seu próprio banner — e na [página de registro de alterações](https://drummingbird1.github.io/GOGEnhancer/changelog.html) do site da extensão.

---

## 🧑‍💻 Feita primeiro para o mercado israelense

Originalmente feita sob medida para usuários israelenses (ILS, IVA de 18%, hebraico) — mas funciona igualmente bem com qualquer uma das 24 moedas suportadas. Todos os campos são editáveis.

---

## ☕ Apoio

O GOG Enhancer é gratuito, de código aberto, sem anúncios e não coleta dados. Se ele economiza seu dinheiro ou tempo e você quer apoiar o desenvolvimento, pode se tornar apoiador em qualquer uma destas plataformas:

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/solvaris)**
- **[Patreon](https://www.patreon.com/c/Solvaris)**

Totalmente opcional — todos os recursos continuam gratuitos para todos de qualquer forma.
