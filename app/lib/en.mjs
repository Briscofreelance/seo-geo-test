// Display-time French → English translation of everything the server sends (labels, help, advice, findings, errors).
// Stored snapshots stay as recorded (French); nothing is rewritten on disk.
import { CHK } from './en-checks.mjs';

export const DOMAINS = {
  'Indexabilité et technique': 'Indexability and technical',
  'On-page et contenu': 'On-page and content',
  'Performance (Core Web Vitals)': 'Performance (Core Web Vitals)',
  'GEO / citabilité IA': 'GEO / AI citability',
  'Données structurées': 'Structured data',
  'Local et international': 'Local and international',
  'Webdesign et mise en ligne': 'Web design and go-live',
};

const STEPS = {
  'Démarrage': 'Starting', 'Lecture de la page d\'accueil': 'Reading the homepage', 'robots.txt et sitemap': 'robots.txt and sitemap',
  'Contrôles techniques': 'Technical checks', 'Vérification des liens internes': 'Checking internal links', 'Contenu et balises': 'Content and tags',
  'Poids des images et cache': 'Image weight and cache', 'Vitesse réelle (PageSpeed Insights)': 'Real speed (PageSpeed Insights)',
  'Lisibilité pour les IA': 'AI readability', 'Données structurées': 'Structured data', 'Contrôles locaux': 'Local checks',
  'Contrôles multilingues': 'Multilingual checks', 'Checklist webdesign et mise en ligne': 'Web design and go-live checklist',
  'Terminé': 'Done', 'Préparation des mesures': 'Preparing the measurements',
  'rapide': 'quick', 'moyen': 'medium', 'long': 'long',
};

// Exact French string → English, built from the catalog texts (filled by init()).
const EXACT = new Map(Object.entries({ ...DOMAINS, ...STEPS }));
export function init(catalog, HELP, A) {
  for (const c of catalog.checks) {
    const e = CHK[c.id]; if (!e) continue;
    EXACT.set(c.label, e[0]);
    const h = HELP[c.id]; if (h) { EXACT.set(h[0], e[1]); EXACT.set(h[1], e[2]); }
    const a = A[c.id]; if (a) { EXACT.set(a[0], e[3]); EXACT.set(a[1], e[4]); }
  }
}

// Fragment rules for findings (evidence). Applied in order, globally, on the text.
const R = [
  [/site local \(http normal\)/g, 'local site (plain http is fine)'],
  [/la page d'accueil reste en http/g, 'the homepage stays on http'],
  [/http:\/\/ non joignable/g, 'http:// unreachable'],
  [/http:\/\/ répond (\d+) sans redirection/g, 'http:// answers $1 without redirecting'],
  [/redirection http→https temporaire \((\d+)\), il faut un 301/g, 'temporary http→https redirect ($1), a 301 is needed'],
  [/http:\/\/ ne mène pas à https/g, 'http:// does not lead to https'],
  [/(\d+) redirection\(s\) jusqu'à /g, '$1 redirect(s) to '],
  [/hôte local ou IP/g, 'local host or IP'],
  [/ n'est pas servi : pas de doublon/g, ' is not served: no duplicate'],
  [/ redirige vers /g, ' redirects to '],
  [/ sert aussi le site sans redirection \(doublon\)/g, ' also serves the site without redirecting (duplicate)'],
  [/^(\S+) répond (\d+)$/g, '$1 answers $2'],
  [/robots\.txt absent/g, 'robots.txt missing'],
  [/Disallow: \/ pour tous les robots : le site est bloqué/g, 'Disallow: / for all robots: the site is blocked'],
  [/robots\.txt sans ligne « Sitemap: »/g, 'robots.txt has no "Sitemap:" line'],
  [/sitemap introuvable à /g, 'sitemap not found at '],
  [/^sitemap introuvable$/g, 'sitemap not found'],
  [/sitemap vide/g, 'empty sitemap'],
  [/URLs du sitemap à corriger : /g, 'sitemap URLs to fix: '],
  [/(\d+) URL\(s\), échantillon valide/g, '$1 URL(s), sample is valid'],
  [/\(redirigée\)/g, '(redirected)'],
  [/noindex sur : /g, 'noindex on: '],
  [/canonical manquant ou différent : /g, 'canonical missing or different: '],
  [/\(absent\)/g, '(missing)'],
  [/\((\d+) redirections\)/g, '($1 redirects)'],
  [/liens cassés : /g, 'broken links: '],
  [/→ injoignable/g, '→ unreachable'],
  [/(\d+) lien\(s\) interne\(s\) testé\(s\)/g, '$1 internal link(s) tested'],
  [/(\d+) mots dans le HTML initial/g, '$1 words in the initial HTML'],
  [/\(coquille vide : le contenu dépend de JavaScript\)/g, '(empty shell: the content depends on JavaScript)'],
  [/attribut lang absent ou invalide : /g, 'lang attribute missing or invalid: '],
  [/ : title absent/g, ' : title missing'],
  [/trop court \((\d+)\)/g, 'too short ($1)'],
  [/trop long \((\d+)\)/g, 'too long ($1)'],
  [/trop courte \((\d+)\)/g, 'too short ($1)'],
  [/trop longue \((\d+)\)/g, 'too long ($1)'],
  [/ : absente/g, ' : missing'],
  [/doublons : /g, 'duplicates: '],
  [/niveaux de titres sautés sur : /g, 'skipped heading levels on: '],
  [/(\S+) liens internes par page en moyenne/g, '$1 internal links per page on average'],
  [/(\S+) liens internes par page, (\d+) % d'ancres génériques \(« en savoir plus »\)/g, '$1 internal links per page, $2% generic anchors ("read more")'],
  [/^aucune image$/g, 'no images'],
  [/(\d+) image\(s\) sur (\d+) sans attribut alt : /g, '$1 image(s) out of $2 without an alt attribute: '],
  [/(\d+) image\(s\), toutes avec alt/g, '$1 image(s), all with alt'],
  [/balises manquantes : /g, 'missing tags: '],
  [/twitter:card absent/g, 'twitter:card missing'],
  [/manquant sur l'accueil : /g, 'missing on the homepage: '],
  [/mentions légales/g, 'legal notice'],
  [/confidentialité/g, 'privacy'],
  [/pages au contenu très proche : /g, 'pages with very similar content: '],
  [/aucune image sur l'accueil/g, 'no images on the homepage'],
  [/images lourdes ou en format ancien : /g, 'heavy images or old formats: '],
  [/\((\d+) Ko\)/g, '($1 KB)'],
  [/(\d+)\/(\d+) images sans width\/height \(risque de saut de mise en page\)/g, '$1/$2 images without width/height (layout shift risk)'],
  [/tailles d'images non lisibles/g, 'image sizes unreadable'],
  [/(\d+) script\(s\) bloquant\(s\) dans <head>, (\d+) feuille\(s\) de style/g, '$1 blocking script(s) in <head>, $2 stylesheet(s)'],
  [/HTML compressé : oui/g, 'HTML compressed: yes'],
  [/HTML compressé : non/g, 'HTML compressed: no'],
  [/fichiers statiques à cache long : /g, 'static files with long cache: '],
  [/PageSpeed Insights indisponible : /g, 'PageSpeed Insights unavailable: '],
  [/Vitesse mesurée par PageSpeed Insights/g, 'Speed measured by PageSpeed Insights'],
  [/pas de robots\.txt : aucun robot bloqué/g, 'no robots.txt: no robot blocked'],
  [/robots de recherche bloqués : /g, 'search robots blocked: '],
  [/robots de recherche autorisés ; robots d'entraînement bloqués \(choix possible\) : /g, 'search robots allowed; training robots blocked (a possible choice): '],
  [/robots de recherche et d'entraînement autorisés/g, 'search and training robots allowed'],
  [/heuristique : (\d+) paragraphe\(s\) autonome\(s\) de 40 à 150 mots/g, 'heuristic: $1 standalone paragraph(s) of 40 to 150 words'],
  [/heuristique : (\d+) titre\(s\) H2\/H3, dont (\d+) formulé\(s\) en question/g, 'heuristic: $1 H2/H3 heading(s), $2 phrased as a question'],
  [/« (.+?) » cohérent entre schema, titre et texte/g, '"$1" consistent across schema, title and text'],
  [/le nom du schema \(« (.+?) »\) n'apparaît pas dans le texte/g, 'the schema name ("$1") does not appear in the text'],
  [/le nom du schema \(« (.+?) »\) n'apparaît pas dans le titre ni les H1\/H2/g, 'the schema name ("$1") does not appear in the title or the H1/H2'],
  [/pas de page « à propos \/ équipe » ni de schema Organization identifiable, ou contact absent/g, 'no "about / team" page or identifiable Organization schema, or contact missing'],
  [/pas de contenu daté \(page vitrine\)/g, 'no dated content (showcase site)'],
  [/aucun JSON-LD détecté/g, 'no JSON-LD detected'],
  [/pas de JSON-LD/g, 'no JSON-LD'],
  [/(\d+) bloc\(s\), types : /g, '$1 block(s), types: '],
  [/JSON invalide/g, 'invalid JSON'],
  [/propriété\(s\) manquante\(s\) /g, 'missing property(ies) '],
  [/le balisage annonce des informations absentes de la page : /g, 'the markup announces information missing from the page: '],
  [/\bnom, téléphone, adresse\b/g, 'name, phone, address'],
  [/pas de schéma entreprise/g, 'no business schema'],
  [/^type : /g, 'type: '],
  [/ni Organization ni LocalBusiness/g, 'neither Organization nor LocalBusiness'],
  [/aucun numéro de téléphone détecté sur l'accueil/g, 'no phone number detected on the homepage'],
  [/téléphone du balisage \((.+?)\) absent du texte et des liens tel:/g, 'phone in the markup ($1) missing from the text and tel: links'],
  [/plusieurs numéros différents sur l'accueil : /g, 'several different numbers on the homepage: '],
  [/numéro cohérent : (.+?) \(le contrôle avec la fiche Google reste à faire\)/g, 'consistent number: $1 (the check against the Google profile is still to be done)'],
  [/propriétés manquantes : /g, 'missing properties: '],
  [/streetAddress \(facultatif si zone de service\)/g, 'streetAddress (optional for a service area)'],
  [/\bhoraires\b/g, 'hours'],
  [/geo ou areaServed/g, 'geo or areaServed'],
  [/pas de LocalBusiness \(ou sous-type précis\) dans le JSON-LD/g, 'no LocalBusiness (or precise subtype) in the JSON-LD'],
  [/« (.+?) » présent dans le title et le H1/g, '"$1" present in the title and the H1'],
  [/« (.+?) » absent (.*)$/g, (m, c, rest) => `"${c}" missing from ${rest.replace(/du title/, 'the title').replace(/ et /, ' and ').replace(/du H1/, 'the H1')}`],
  [/manquant : lien téléphone cliquable \(tel:\)/g, 'missing: clickable phone link (tel:)'],
  [/plan ou lien Maps/g, 'map or Maps link'],
  [/aucun balisage d'avis/g, 'no review markup'],
  [/avis visibles sur la page/g, 'reviews visible on the page'],
  [/balisage d'avis sans avis visibles sur la page \(non conforme\)/g, 'review markup with no reviews visible on the page (non-compliant)'],
  [/aucune balise hreflang sur l'accueil/g, 'no hreflang tag on the homepage'],
  [/codes invalides : /g, 'invalid codes: '],
  [/x-default manquant/g, 'x-default missing'],
  [/ne référence pas toutes les versions/g, 'does not reference all versions'],
  [/canonical non auto-référent : /g, 'canonical not self-referencing: '],
  [/lang="absent"/g, 'lang="missing"'],
  [/balise viewport « width=device-width » absente : la page ne s'adapte pas au mobile/g, 'viewport tag "width=device-width" missing: the page does not adapt to mobile'],
  [/viewport présent ; absence de débordement et taille des cibles tactiles à vérifier sur un vrai mobile/g, 'viewport present; no horizontal overflow and touch target size to verify on a real phone'],
  [/aucun formulaire détecté dans les pages analysées/g, 'no form detected in the analysed pages'],
  [/(\d+)\/(\d+) champ\(s\) sans étiquette : /g, '$1/$2 field(s) without a label: '],
  [/(\d+) champ\(s\) étiqueté\(s\)/g, '$1 labelled field(s)'],
  [/une adresse inexistante renvoie 200 \(fausse page 404 : mauvais pour Google\)/g, 'a non-existent address returns 200 (fake 404 page: bad for Google)'],
  [/page 404 par défaut du serveur \(sans message ni lien de retour\)/g, 'default server 404 page (no message or link back)'],
  [/réponse inattendue sur une adresse inexistante : /g, 'unexpected response on a non-existent address: '],
  [/ni balise icon ni \/favicon\.ico/g, 'neither an icon tag nor /favicon.ico'],
  [/traceurs : /g, 'trackers: '],
  [/embeds externes : /g, 'external embeds: '],
  [/le serveur dépose un cookie dès la première visite/g, 'the server sets a cookie on the first visit'],
  [/ → bannière de consentement nécessaire, ou retirer \(carte = image cliquable\)/g, ' → a consent banner is needed, or remove them (map = clickable image)'],
  [/aucun traceur ni embed détecté \(les scripts chargés dynamiquement ne sont pas vus\)/g, 'no tracker or embed detected (dynamically loaded scripts are not seen)'],
  [/mesure d'audience sans cookie : /g, 'cookieless audience measurement: '],
  [/mesure d'audience avec traceurs : (.+?) \(bannière cookies requise\)/g, 'audience measurement with trackers: $1 (cookie banner required)'],
  [/aucune mesure d'audience détectée dans le HTML \(Plausible ou Umami recommandés\)/g, 'no audience measurement detected in the HTML (Plausible or Umami recommended)'],
  [/liens vers : /g, 'links to: '],
  [/aucun lien vers un réseau social \(normal si le commerce n'en a pas\)/g, 'no link to a social network (fine if the business has none)'],
  [/balise meta keywords présente \(inutile, à retirer\)/g, 'meta keywords tag present (useless, remove it)'],
  [/accessible publiquement : /g, 'publicly accessible: '],
  [/ \(à retirer immédiatement et changer les clés concernées\)/g, ' (remove immediately and rotate the keys concerned)'],
  [/ville non renseignée : relancer l'audit en l'indiquant/g, 'city not provided: run the audit again and enter it'],
  [/« (.+?) » cité (\d+) fois sur (\d+) page\(s\)/g, '"$1" mentioned $2 time(s) across $3 page(s)'],
  [/ : ajouter quartiers, rues, repères/g, ': add districts, streets, landmarks'],
  [/à valider à la main \(ou avec Claude dans le dossier du site\)/g, 'to be validated by hand (or with Claude in the site folder)'],
  [/saisi à la main/g, 'entered by hand'],
  // diff caveats and notes
  [/Seulement (\d+) jour\(s\) entre les deux audits : c'est court pour l'indexation et la visibilité dans les IA\./g, 'Only $1 day(s) between the two audits: that is short for indexing and AI visibility.'],
  [/Seulement (\d+) contrôles comparables : l'écart de score est peu fiable\./g, 'Only $1 comparable checks: the score gap is unreliable.'],
  [/L'audit précédent a été reconstitué depuis un ancien rapport : comparaison limitée aux contrôles communs\./g, 'The previous audit was rebuilt from an old report: comparison limited to common checks.'],
  // steps, errors
  [/^Analyse de (\d+) pages$/g, 'Analysing $1 pages'],
  [/^Site injoignable : /g, 'Site unreachable: '],
  [/Adresse invalide\./g, 'Invalid address.'],
  [/Colle l'adresse du site\./g, 'Paste the site address.'],
  [/Audit introuvable/g, 'Audit not found'],
  [/Tâche inconnue/g, 'Unknown task'],
  [/Requête refusée/g, 'Request refused'],
  [/Choisis au moins un moteur\./g, 'Choose at least one engine.'],
  [/Rien à mesurer : ajoute des requêtes et des questions \(rubrique 1\)\./g, 'Nothing to measure: add queries and questions (section 1).'],
  [/Trop de mesures d'un coup \((\d+), maximum (\d+)\)\./g, 'Too many measurements at once ($1, maximum $2).'],
  [/Texte trop court\./g, 'Text too short.'],
  [/Contrôle ou statut invalide\./g, 'Invalid check or status.'],
  [/Moteur ou requête manquant\./g, 'Engine or query missing.'],
  [/IA ou prompt manquant\./g, 'AI or prompt missing.'],
  [/Type de mesure inconnu\./g, 'Unknown measurement type.'],
  [/Identifiant de contrôle invalide/g, 'Invalid check identifier'],
  [/Statut invalide/g, 'Invalid status'],
  [/Audit introuvable|Site introuvable/g, (m) => (m === 'Site introuvable' ? 'Site not found' : 'Audit not found')],
  [/Chrome introuvable : installe Google Chrome \(ou Edge\)\./g, 'Chrome not found: install Google Chrome (or Edge).'],
  [/Le navigateur dédié est déjà ouvert : connecte-toi dedans, puis ferme-le\./g, 'The dedicated browser is already open: sign in there, then close it.'],
  [/Le navigateur dédié ne démarre pas\./g, 'The dedicated browser does not start.'],
  [/Composant manquant : relance Lancer-SEO-GEO-Test\.bat \(il installe playwright-core au premier lancement\)\./g, 'Component missing: run the launcher again (it installs playwright-core on first launch).'],
  [/Connexion au navigateur dédié impossible : /g, 'Cannot connect to the dedicated browser: '],
  [/CAPTCHA détecté : mesure arrêtée pour ce moteur \(aucun contournement\)\./g, 'CAPTCHA detected: measurement stopped for this engine (no bypass).'],
  [/Aucun résultat lu : la page a peut-être changé de structure\./g, 'No result read: the page structure may have changed.'],
  [/ : zone de saisie introuvable \(connexion requise \? clique sur « Préparer les connexions »\)\./g, ' : input box not found (sign-in required? click "Prepare sign-ins").'],
  [/ChatGPT : pas de réponse \(limite atteinte ou connexion expirée\)\./g, 'ChatGPT: no answer (limit reached or sign-in expired).'],
  [/Gemini : pas de réponse \(connexion expirée \?\)\./g, 'Gemini: no answer (sign-in expired?).'],
  [/Copilot : pas de réponse lue \(structure de page changée \?\)\./g, 'Copilot: no answer read (page structure changed?).'],
  [/mesure navigateur/g, 'browser measurement'],
  [/ : « /g, ' : "'], [/ »$/g, '"'],
];

export function trText(s) {
  if (typeof s !== 'string' || !s) return s;
  const hit = EXACT.get(s); if (hit) return hit;
  let out = s;
  for (const [re, rep] of R) out = out.replace(re, rep);
  return out;
}
const EV_KEYS = new Set(['evidence', 'prevEvidence', 'step', 'error', 'errors', 'notes', 'caveats', 'message']);
// Walk a JSON-able structure; exact-match everywhere (safe), fragment rules only on finding-like keys.
export function trDeep(x, key = '') {
  if (typeof x === 'string') {
    if (EXACT.has(x)) return EXACT.get(x);
    return EV_KEYS.has(key) ? trText(x) : x;
  }
  if (Array.isArray(x)) return x.map((v) => trDeep(v, key));
  if (x && typeof x === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(x)) o[k] = trDeep(v, k === 'errors' || k === 'notes' || k === 'caveats' ? k : k);
    return o;
  }
  return x;
}
