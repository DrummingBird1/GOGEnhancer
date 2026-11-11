/**
 * Português (Brasil) — for the Brazilian store (BRL) and everyone who prefers it.
 * Covers the popup, the first-run wizard, the tour's buttons and the shared words
 * of the settings and dashboard pages; text with no row here stays English (see
 * lib/i18n-pages.js, `addPack`). The in-page text is in lib/i18n-lang-pt-content.js.
 */
// @ts-check

(() => {
  "use strict";
  window.GOGPlusI18n?.addLanguage("pt", "Português (Brasil)", {
    "popup.subtitle": "Aprimorado",
    "popup.rate.bundled": "Usando taxas incluídas · clique em ↻ para atualizar",
    "popup.section.currency": "Moeda e preços",
    "popup.section.onpage": "Melhorias na página",
    "popup.section.visual": "Visual",
    "popup.section.library": "Biblioteca e conta",
    "popup.section.localization": "Idioma",
    "popup.row.targetCurrency": "Mostrar ao lado do USD",
    "popup.row.vatToggle": "Estimar impostos",
    "popup.row.vatToggle.sub": "Mostra o preço com imposto ao lado do USD.",
    "popup.row.vatPercent": "Imposto %",
    "popup.row.refresh": "↻ taxas",
    "popup.row.refundBadge": "Selo de “reembolso de 30 dias”",
    "popup.row.refundBadge.sub": "Lembrete em cada cartão de jogo.",
    "popup.row.drmBanner": "Faixa DRM-free no rodapé",
    "popup.row.drmBanner.sub": "Destaca a promessa central da GOG.",
    "popup.row.modIndicator": "Indicador de mods nos cartões",
    "popup.row.modIndicator.sub": "Selo ★ MOD para jogos com suporte a mods.",
    "popup.row.hideExpired": "Ocultar promoções expiradas",
    "popup.row.hideExpired.sub": "Esmaece promoções com datas antigas.",
    "popup.row.cleanLayout": "Página inicial mais limpa",
    "popup.row.cleanLayout.sub": "Recolhe faixas de promoção repetidas.",
    "popup.row.skeleton": "Animação de carregamento",
    "popup.row.skeleton.sub": "Troca espaços vazios por um brilho animado.",
    "popup.row.design": "Injeção de design",
    "popup.row.design.sub": "Preços monoespaçados, cartões por época, profundidade, selo dourado “Good Old Game”.",
    "popup.row.richTooltips": "Dicas detalhadas",
    "popup.row.richTooltips.sub": "Dicas personalizadas ao passar o mouse, com detalhes.",
    "popup.row.tags": "Tags e notas personalizadas",
    "popup.row.tags.sub": "Com autocompletar e painel.",
    "popup.row.wlFilters": "Filtros rápidos da lista de desejos",
    "popup.row.wlFilters.sub": "Por promoção, preço e avaliação.",
    "popup.row.wlAlerts": "Alertas de promoção da lista de desejos",
    "popup.row.wlAlerts.sub": "O ícone da barra conta as ofertas da lista de desejos.",
    "popup.whatsnew.title": "Novidades",
    "popup.whatsnew.dismiss": "Entendi",
    "popup.deals.title": "Ofertas da lista de desejos",
    "popup.digest.title": "Esta semana",
    "popup.row.priceHistory": "Histórico de preços",
    "popup.row.priceHistory.sub": "Registra os preços a cada visita.",
    "popup.row.lowestBadge": "Selo de menor preço",
    "popup.row.lowestBadge.sub": "💎 marca cartões no menor preço já registrado.",
    "popup.row.refundTimer": "Contagem do prazo de reembolso",
    "popup.row.refundTimer.sub": "Contagem regressiva pela data de compra informada na página do jogo.",
    "popup.row.itad": "Comparar no IsThereAnyDeal",
    "popup.row.itad.sub": "Comparação de preços entre lojas com um clique.",
    "popup.row.priceCompare": "Tabela de comparação de preços",
    "popup.row.priceCompare.sub": "Preços de Steam/Epic/Humble/Fanatical na página do jogo, via CheapShark.",
    "popup.row.hebrew": "Tradução para hebraico",
    "popup.row.hebrew.sub": "Traduz textos estáveis de navegação e interface.",
    "popup.row.rtl": "Layout da direita para a esquerda",
    "popup.row.rtl.sub": "Espelha o layout para idiomas da direita para a esquerda.",
    "popup.btn.tags": "Painel de tags",
    "popup.btn.advanced": "Avançado",
    "popup.btn.reload": "Recarregar aba",
    "popup.shortcuts": "Atalhos:",
    "popup.shortcuts.open": "abrir",
    "popup.shortcuts.toggle": "alternar",
    "options.hero.title": "Configurações avançadas",
    "options.hero.sub": "Ajuste o comportamento, gerencie seus dados e personalize o que o GOG Enhancer injeta.",
    "options.section.language": "Idioma",
    "options.section.language.sub": "Troca o idioma da interface da extensão. Não afeta o GOG.com em si (isso é controlado pela opção de tradução para hebraico no popup).",
    "language.label": "Idioma da interface",
  });

  window.GOGPlusPageI18n?.addPack("pt", [
    // shared words
    ["Israel", "Israel"], ["EU", "UE"], ["European Union", "União Europeia"], ["UK", "Reino Unido"], ["United Kingdom", "Reino Unido"], ["Poland", "Polônia"], ["USA", "EUA"], ["Germany", "Alemanha"], ["France", "França"], ["Spain", "Espanha"], ["Italy", "Itália"], ["Netherlands", "Países Baixos"], ["Russia", "Rússia"], ["Custom", "Personalizado"],
    ["{} · {n}% VAT", "{1} · imposto {2}%"], ["{n}% VAT · {}", "imposto {1}% · {2}"], ["{n}% VAT (varies) · {}", "imposto {1}% (varia) · {2}"], ["{n}% (state-dependent)", "{1}% (depende do estado)"], ["manual", "manual"],
    ["Neon", "Neon"], ["magenta + cyan", "magenta + ciano"], ["magenta + cyan (default)", "magenta + ciano (padrão)"], ["Classic GOG", "GOG clássico"], ["deep purple", "roxo escuro"], ["CRT Green", "Verde CRT"], ["phosphor", "fósforo"], ["phosphor screen", "tela de fósforo"], ["Sunset", "Pôr do sol"], ["orange + pink", "laranja + rosa"], ["Light", "Claro"], ["inverted palette", "paleta invertida"], ["Auto", "Automático"], ["matches your system", "segue o sistema"], ["High contrast", "Alto contraste"], ["max readability", "máxima legibilidade"], ["pick your own colors", "escolha suas cores"], ["Native", "Nativo"], ["matches gog.com's own look", "combina com o visual do gog.com"],
    ["Copy report", "Copiar relatório"], ["Sync now", "Sincronizar agora"], ["Never", "Nunca"], ["Delete everything…", "Apagar tudo…"], ["Skip", "Pular"], ["Plain look", "Visual simples"], ["Calm mode", "Modo calmo"], ["Catalog tools", "Ferramentas do catálogo"], ["Smart wishlist", "Lista de desejos inteligente"], ["Custom tags & notes", "Tags e notas personalizadas"], ["Wishlist sale alerts", "Alertas de promoção da lista de desejos"], ["Visual upgrade", "Melhoria visual"], ["RTL layout", "Layout RTL"], ["Price history", "Histórico de preços"], ["Close window", "Fechar janela"],
    // popup
    ["Enable GOG Enhancer", "Ativar o GOG Enhancer"], ["Something on gog.com isn't working", "Algo no gog.com não está funcionando"], ["{} stopped working on a gog.com page. The rest of the extension still works.", "{1} parou de funcionar em uma página do gog.com. O resto da extensão continua funcionando."], ["Report on GitHub", "Reportar no GitHub"], ["Dismiss", "Dispensar"],
    ["The report has no web addresses or personal data. \"Report on GitHub\" only opens a page with it filled in — you choose whether to send it.", "O relatório não contém endereços da web nem dados pessoais. “Reportar no GitHub” apenas abre uma página já preenchida — você decide se envia."],
    ["Using bundled rates · click ↻ to refresh", "Usando taxas incluídas · clique em ↻ para atualizar"], ["just updated", "atualizado agora"], ["⚠ refresh failed", "⚠ falha ao atualizar"], ["{n}h ago", "há {1} h"], ["{n}d ago", "há {1} d"], ["Off (USD only)", "Desligado (só USD)"], ["VAT estimator", "Estimativa de imposto"], ["Refresh exchange rates now", "Atualizar as taxas de câmbio agora"],
    ["Show gog.com without GOG Enhancer's styling — features keep working.", "Mostra o gog.com sem o estilo do GOG Enhancer — os recursos continuam funcionando."], ["No glow, blur or animation.", "Sem brilho, desfoque ou animação."], ["Sort, near-my-low filter, totals, export.", "Ordenação, filtro “perto do meu mínimo”, totais, exportação."], ["Sort a page, hide owned games, compare, save searches.", "Ordenar a página, ocultar jogos que você tem, comparar, salvar buscas."],
    ["Save this week's digest as a web page you can keep or send", "Salvar o resumo da semana como uma página para guardar ou enviar"], ["Save as page", "Salvar como página"], ["⏰ refund closes in {n}d", "⏰ reembolso encerra em {1} d"], ["🔔 {} — alert hit", "🔔 {1} — alerta disparado"], ["📉 -{n}% off peak", "📉 -{1}% abaixo do pico"], ["⏳ offer ends in under a day", "⏳ oferta termina em menos de um dia"], ["⏳ offer ends in {n}d", "⏳ oferta termina em {1} d"],
    ["Copied ✓", "Copiado ✓"], ["Couldn't copy", "Não foi possível copiar"], ["Buy Me a Coffee", "Me pague um café"], ["🧡 Coffee", "🧡 Café"],
    // first-run wizard
    ["Welcome.", "Boas-vindas."], ["GOG Enhancer adds the bits the store doesn't: live currency conversion, price history, custom tags, Hebrew, and a bunch of small visual upgrades. Two minutes to set up.", "O GOG Enhancer acrescenta o que a loja não tem: conversão de moeda em tempo real, histórico de preços, tags personalizadas, hebraico e várias pequenas melhorias visuais. Leva dois minutos para configurar."],
    ["First, your currency", "Primeiro, sua moeda"], ["We'll show every price in this currency next to the original USD.", "Mostraremos cada preço nesta moeda ao lado do USD original."], ["None", "Nenhuma"], ["Tax estimator", "Estimativa de impostos"], ["USD only", "Só USD"], ["Continue →", "Continuar →"],
    ["GOG shows USD without sales tax. We can show you the post-tax price too, based on a region preset. Pick what fits, or skip.", "A GOG mostra o USD sem impostos. Podemos mostrar também o preço com imposto, com base em uma região predefinida. Escolha a que serve, ou pule."], ["No tax estimation", "Sem estimativa de impostos"], ["← Back", "← Voltar"],
    ["Choose your toggles", "Escolha suas opções"], ["Everything is on by default. Untick anything you don't want — you can change all of these later from the popup.", "Tudo vem ligado por padrão. Desmarque o que não quiser — você pode mudar tudo isso depois pelo popup."],
    ["DRM-free banner", "Faixa DRM-free"], ["Bottom-of-page reminder of GOG's \"you own it\" promise.", "Lembrete no rodapé da promessa da GOG: “o jogo é seu”."], ["30-day refund badges", "Selos de reembolso de 30 dias"], ["Adds a refund chip to every game card.", "Adiciona uma etiqueta de reembolso a cada cartão de jogo."], ["Mod indicator", "Indicador de mods"], ["★ MOD badge on cards for moddable titles.", "Selo ★ MOD nos cartões de jogos com suporte a mods."],
    ["Records prices on visit. Mini-stats panel on game pages.", "Registra preços a cada visita. Mini painel de estatísticas nas páginas de jogos."], ["Compare via IsThereAnyDeal", "Comparar via IsThereAnyDeal"], ["One-click button to check Steam/Epic/Humble/Fanatical.", "Botão de um clique para consultar Steam/Epic/Humble/Fanatical."], ["Toolbar badge counts wishlist items currently on sale.", "O ícone da barra conta os itens da lista de desejos em promoção."], ["Tag any game with autocomplete + dashboard.", "Marque qualquer jogo com tags, com autocompletar e painel."],
    ["Hebrew translations", "Traduções para hebraico"], ["Translates stable nav & UI strings to Hebrew. Off by default.", "Traduz textos estáveis de navegação e interface para hebraico. Desligado por padrão."], ["Right-to-left mirroring. Off by default.", "Espelhamento da direita para a esquerda. Desligado por padrão."], ["Pick a look", "Escolha um visual"], ["Sets the accent colors across badges, the game-page panel, and the era-aware card effects. Change anytime in Advanced Options.", "Define as cores de destaque nos selos, no painel da página do jogo e nos efeitos dos cartões por época. Mude quando quiser nas Opções avançadas."],
    ["Finish setup", "Concluir configuração"], ["You're set.", "Tudo pronto."], ["GOG Enhancer is active. Visit <1>gog.com</1> to see it in action.", "O GOG Enhancer está ativo. Visite <1>gog.com</1> para vê-lo em ação."], ["<1>Alt</1>+<2>G</2> — open settings popup", "<1>Alt</1>+<2>G</2> — abrir o popup de configurações"], ["<1>Alt</1>+<2>Shift</2>+<3>G</3> — toggle on/off", "<1>Alt</1>+<2>Shift</2>+<3>G</3> — ligar/desligar"], ["<1>Alt</1>+<2>Shift</2>+<3>H</3> — toggle Hebrew", "<1>Alt</1>+<2>Shift</2>+<3>H</3> — alternar hebraico"],
    ["You can revisit any of these settings from the toolbar icon.", "Você pode rever qualquer uma destas configurações pelo ícone da barra de ferramentas."], ["Another currency…", "Outra moeda…"], ["Another currency", "Outra moeda"],
    // tour buttons
    ["Skip the tour", "Pular o tour"], ["Back", "Voltar"], ["Next", "Avançar"], ["Done", "Concluir"], ["Tour progress", "Progresso do tour"], ["Slide {n}", "Slide {1}"], ["Open the settings", "Abrir as configurações"], ["Check my gog.com tab", "Verificar minha aba do gog.com"], ["{n} thing to look at — see below.", "{1} item para ver — veja abaixo."], ["{n} things to look at — see below.", "{1} itens para ver — veja abaixo."], ["Everything the extension looks for was found on that page.", "Tudo o que a extensão procura foi encontrado nessa página."],
  ]);
})();
