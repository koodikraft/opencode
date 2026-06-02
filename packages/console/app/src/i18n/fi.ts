import type { Dict } from "./en"
import { dict as en } from "./en"

export const dict = {
  ...en,
  "nav.docs": "Dokumentaatio",
  "nav.free": "Lataa",
  "nav.home": "Etusivu",
  "nav.openMenu": "Avaa valikko",
  "nav.getStartedFree": "Aloita ilmaiseksi",

  "nav.context.copyLogo": "Kopioi logo SVG:nä",
  "nav.context.copyWordmark": "Kopioi sanamerkki SVG:nä",
  "nav.context.brandAssets": "Brändiaineistot",

  "footer.docs": "Dokumentaatio",

  "legal.privacy": "Tietosuoja",
  "legal.terms": "Käyttöehdot",

  "email.title": "Kuule ensimmäisenä, kun julkaisemme uusia tuotteita",
  "email.subtitle": "Liity jonoon saadaksesi varhaisen pääsyn.",
  "email.placeholder": "Sähköpostiosoite",
  "email.subscribe": "Tilaa",
  "email.success": "Melkein valmista. Tarkista sähköpostisi ja vahvista osoitteesi",

  "notFound.title": "Ei löytynyt | opencode",
  "notFound.heading": "404 - Sivua ei löytynyt",
  "notFound.home": "Etusivu",
  "notFound.docs": "Dokumentaatio",

  "user.logout": "Kirjaudu ulos",

  "auth.callback.error.codeMissing": "Valtuutuskoodia ei löytynyt.",

  "workspace.select": "Valitse työtila",
  "workspace.createNew": "+ Luo uusi työtila",
  "workspace.modal.title": "Luo uusi työtila",
  "workspace.modal.placeholder": "Anna työtilan nimi",

  "common.cancel": "Peruuta",
  "common.creating": "Luodaan...",
  "common.create": "Luo",
  "common.contactUs": "Ota yhteyttä",
  "common.videoUnsupported": "Selaimesi ei tue videota.",
  "common.learnMore": "Lue lisää",

  "error.invalidPlan": "Virheellinen paketti",
  "error.workspaceRequired": "Työtilan ID on pakollinen",
  "error.alreadySubscribed": "Tällä työtilalla on jo tilaus",
  "error.limitRequired": "Raja on pakollinen.",
  "error.monthlyLimitInvalid": "Aseta kelvollinen kuukausiraja.",
  "error.workspaceNameRequired": "Työtilan nimi on pakollinen.",
  "error.nameTooLong": "Nimi saa olla enintään 255 merkkiä.",
  "error.emailRequired": "Sähköposti on pakollinen",
  "error.roleRequired": "Rooli on pakollinen",
  "error.idRequired": "ID on pakollinen",
  "error.nameRequired": "Nimi on pakollinen",
  "error.providerRequired": "Palveluntarjoaja on pakollinen",
  "error.apiKeyRequired": "API-avain on pakollinen",
  "error.modelRequired": "Malli on pakollinen",
  "error.reloadAmountMin": "Lataussumman on oltava vähintään ${{amount}}",
  "error.reloadTriggerMin": "Saldohälytyksen on oltava vähintään ${{amount}}",

  "app.meta.description": "OpenCode - avoimen lähdekoodin koodausagentti.",

  "home.title": "OpenCode | Avoimen lähdekoodin AI-koodausagentti",
  "home.banner.badge": "Uusi",
  "home.banner.text": "Työpöytäsovellus on saatavilla beetana",
  "home.banner.platforms": "macOS:lle, Windowsille ja Linuxille",
  "home.banner.downloadNow": "Lataa nyt",
  "home.banner.downloadBetaNow": "Lataa työpöytäbeeta nyt",
  "home.hero.title": "Avoimen lähdekoodin AI-koodausagentti",
  "home.hero.subtitle.a": "Mukana ilmaisia malleja tai yhdistä mikä tahansa malli miltä tahansa palveluntarjoajalta,",
  "home.hero.subtitle.b": "mukaan lukien Claude, GPT, Gemini ja muut.",
  "home.install.ariaLabel": "Asennusvaihtoehdot",

  "home.what.title": "Mikä OpenCode on?",
  "home.what.body": "OpenCode on avoimen lähdekoodin agentti, joka auttaa sinua kirjoittamaan koodia terminaalissa, IDE:ssä tai työpöydällä.",
  "home.what.lsp.title": "LSP käytössä",
  "home.what.lsp.body": "Lataa oikeat LSP:t automaattisesti LLM:lle",
  "home.what.multiSession.title": "Useita istuntoja",
  "home.what.multiSession.body": "Käynnistä useita agentteja rinnakkain samassa projektissa",
  "home.what.shareLinks.title": "Jaettavat linkit",
  "home.what.shareLinks.body": "Jaa linkki mihin tahansa istuntoon viitteeksi tai debuggausta varten",
  "home.what.copilot.body": "Kirjaudu GitHubilla käyttääksesi Copilot-tiliäsi",
  "home.what.chatgptPlus.body": "Kirjaudu OpenAI:lla käyttääksesi ChatGPT Plus- tai Pro-tiliäsi",
  "home.what.anyModel.title": "Mikä tahansa malli",
  "home.what.anyModel.body": "Yli 75 LLM-palveluntarjoajaa Models.dev:n kautta, myös paikalliset mallit",
  "home.what.anyEditor.title": "Mikä tahansa editori",
  "home.what.anyEditor.body": "Saatavilla terminaaliliittymänä, työpöytäsovelluksena ja IDE-laajennuksena",
  "home.what.readDocs": "Lue dokumentaatio",

  "home.privacy.title": "Rakennettu tietosuoja edellä",
  "home.privacy.body": "OpenCode ei tallenna koodiasi tai kontekstidataasi, joten sitä voi käyttää tietosuoja-herkissä ympäristöissä.",
  "home.privacy.learnMore": "Lue lisää aiheesta",
  "home.privacy.link": "tietosuoja",
} satisfies Dict