# Swim2Garmin — site

Landing page do Swim2Garmin. Site estático, sem build e sem dependências:
é HTML, CSS e um arquivo de JavaScript.

## Rodar localmente

Qualquer servidor estático serve. Sem instalar nada:

```bash
cd website
python3 -m http.server 8000
# abra http://localhost:8000
```

Ou, se preferir Node:

```bash
npx serve website
```

Abrir o `index.html` direto pelo `file://` também funciona, mas as fontes
locais podem não carregar por causa das regras de CORS do navegador.

## Deploy

Publique o conteúdo da pasta `website/` como está — não há etapa de build.
Funciona em GitHub Pages, Netlify, Vercel, Cloudflare Pages ou EAS Hosting.

## Estrutura

```
website/
├── index.html              # a página inteira
├── scripts/
│   └── app-demo.js         # demo interativa do app no hero
├── styles/
│   ├── site.css            # estilos da página
│   └── ds/                 # design system (ver abaixo)
│       ├── colors_and_type.css
│       ├── shared.css
│       └── fonts/          # Inter + JetBrains Mono (variáveis)
└── assets/
    ├── swim2garmin-logo.png
    └── favicon.png
```

## Design system

`styles/ds/colors_and_type.css` e `styles/ds/shared.css` são **cópias
inalteradas** do Expo Design System, vindas do projeto do Claude Design
(`expo-design-system-196039f7-0d8b-4442-b1c8-806fcd5691a1`). Não edite esses
dois arquivos: mantê-los idênticos à origem faz com que uma atualização do
design system continue sendo um diff limpo. Qualquer ajuste de estilo vai em
`site.css`.

As fontes são servidas localmente (`styles/ds/fonts/`). O
`colors_and_type.css` referencia `fonts/Inter-Variable.woff2` relativo a ele
mesmo, e o `site.css` redeclara a família JetBrains Mono apontando para o
arquivo local — assim a página não faz nenhuma requisição a terceiros.

A página foi especificada apenas em modo claro (o hero usa `#F3F9FC` e o
header um branco translúcido), então o modo escuro do design system não está
habilitado.

## Origem

Implementa `Swim2Garmin Landing.dc.html` do projeto do Claude Design.

A demo no hero reproduz a tela real do app. Os valores dentro de `.app`
(espaçamentos, cores, tamanhos de fonte) são pontos de iOS copiados de
`mobile/src/app/(home)/index.tsx` e `mobile/src/app/(home)/_layout.tsx`;
o `.app` inteiro é escalado para a largura interna da moldura por
`--app-scale`, então dá para comparar os dois lado a lado. O logo é o
mesmo `mobile/assets/images/rounded-logo.png`.

O `app-demo.js` espelha o estado que a tela real mantém (`text`,
`tpWorkouts`, `scheduling`, `scheduleDate`, `message`) e as transições
entre eles: buscar mostra a lista, escolher um treino preenche o texto,
esconde a lista e liga o agendamento, e o botão de enviar fica
desabilitado enquanto não há treino.

Os treinos de exemplo ficam nos atributos `data-*` dos botões `.tp-item`
em `index.html`, que são a única fonte da verdade.
