// Textes d'action en français pour chaque contrôle + constructeurs de prompts.
import { byId, catalog } from './engine.mjs';

// effort : 1 = quelques minutes, 2 = une heure, 3 = demi-journée ou plus
export const A = {
  'tech.https_redirect': ['Forcer le HTTPS', 'Une seule redirection permanente (301) de http:// vers https://.', 1],
  'tech.canonical_host': ['Choisir www ou sans www', 'Rediriger en 301 l\'autre version vers la version retenue (hébergeur ou DNS).', 1],
  'tech.robots_ok': ['Corriger robots.txt', 'Créer ou corriger /robots.txt : ne bloque rien d\'utile et indique l\'adresse du sitemap (Sitemap: https://…/sitemap.xml).', 1],
  'tech.sitemap_ok': ['Publier un sitemap valide', 'Générer /sitemap.xml avec uniquement les URL canoniques qui répondent 200, puis le déclarer dans Search Console et Bing.', 2],
  'tech.no_noindex': ['Retirer le noindex involontaire', 'Supprimer la balise meta robots noindex (ou l\'en-tête X-Robots-Tag) sur les pages à référencer.', 1],
  'tech.canonical_tag': ['Ajouter une balise canonical', 'Sur chaque page : <link rel="canonical"> absolue, qui pointe vers elle-même.', 1],
  'tech.no_redirect_chains': ['Supprimer les chaînes de redirections', 'Faire pointer directement les liens internes vers l\'URL finale.', 1],
  'tech.no_broken_links': ['Réparer les liens cassés', 'Corriger ou retirer les liens internes qui renvoient une erreur 404.', 1],
  'tech.content_in_html': ['Mettre le contenu dans le HTML initial', 'Le texte principal doit être présent sans JavaScript (rendu serveur ou pré-rendu) : les robots des IA n\'exécutent pas tous le JavaScript.', 3],
  'tech.indexed': ['Vérifier l\'indexation', 'À contrôler dans Search Console (Pages) : les pages importantes sont-elles indexées ?', 1],
  'content.lang_attr': ['Déclarer la langue', 'Ajouter lang="fr" (ou la bonne langue) sur la balise <html>.', 1],
  'content.title': ['Soigner les balises title', 'Un titre unique par page, 30 à 60 caractères, avec le sujet principal (et la ville pour un site local).', 1],
  'content.meta_description': ['Rédiger les meta descriptions', 'Une description unique par page, environ 70 à 160 caractères, qui donne envie de cliquer.', 1],
  'content.single_h1': ['Un seul titre H1 par page', 'Exactement un <h1> qui décrit la page.', 1],
  'content.heading_hierarchy': ['Ordonner les intertitres', 'Ne pas sauter de niveau (H1 → H2 → H3).', 1],
  'content.internal_links': ['Améliorer le maillage interne', 'Relier les pages entre elles avec des textes de lien explicites (pas « cliquez ici »).', 2],
  'content.img_alt': ['Renseigner les textes alternatifs', 'Un attribut alt descriptif sur chaque image porteuse de sens (alt="" pour les images décoratives).', 1],
  'content.useful_unique': ['Rendre les pages réellement différentes', 'Des pages quasi identiques se concurrencent : rédiger un contenu propre à chaque page.', 3],
  'content.open_graph': ['Ajouter les balises Open Graph', 'og:title, og:description, og:image pour de beaux aperçus de partage.', 1],
  'content.twitter_card': ['Ajouter la carte Twitter/X', 'twitter:card (et titre, image) pour l\'aperçu sur X.', 1],
  'content.trust_pages': ['Ajouter les pages de confiance', 'Contact, mentions légales, à propos / équipe : elles rassurent visiteurs, Google et les IA.', 2],
  'perf.lcp': ['Accélérer l\'affichage principal (LCP)', 'Viser moins de 2,5 s : alléger et préchargez l\'image principale, réduire le JavaScript bloquant.', 3],
  'perf.inp': ['Améliorer la réactivité (INP)', 'Viser moins de 200 ms : réduire le JavaScript lourd au clic.', 3],
  'perf.cls': ['Stabiliser la mise en page (CLS)', 'Viser moins de 0,1 : réserver la taille des images, vidéos et polices.', 2],
  'perf.image_weight': ['Alléger les images', 'Format WebP/AVIF, dimensions adaptées, chargement différé sous la ligne de flottaison.', 2],
  'perf.render_blocking': ['Réduire les ressources bloquantes', 'Ajouter defer/async aux scripts du <head>.', 1],
  'perf.compression_cache': ['Activer compression et cache', 'Compression gzip/brotli et en-têtes Cache-Control sur les fichiers statiques (souvent un réglage d\'hébergeur).', 1],
  'geo.answer_blocks': ['Écrire des réponses directes', 'Sous chaque intertitre, une réponse courte et autonome en 40 à 80 mots : c\'est ce que les IA reprennent.', 2],
  'geo.question_headings': ['Titrer avec les vraies questions', 'Des intertitres formulés comme les questions des clients (« Combien coûte… ? »).', 2],
  'geo.fact_density': ['Ajouter des faits vérifiables', 'Chiffres, tarifs, délais, zones d\'intervention, sources : du concret citable.', 2],
  'geo.entity_consistency': ['Uniformiser le nom et les coordonnées', 'Même nom d\'entreprise, adresse, téléphone partout (site, schéma, fiches).', 1],
  'geo.ai_crawlers_allowed': ['Autoriser les robots des moteurs IA', 'Ne pas bloquer OAI-SearchBot, PerplexityBot, Claude-SearchBot, Bingbot dans robots.txt (bloquer les robots d\'entraînement est un choix distinct).', 1],
  'geo.identifiable_author': ['Identifier l\'auteur ou l\'entreprise', 'Nom de l\'auteur / de l\'entreprise visible, avec une page de présentation.', 1],
  'geo.freshness': ['Montrer la fraîcheur du contenu', 'Dates de publication et de mise à jour visibles et réelles (jamais artificielles).', 1],
  'geo.question_coverage': ['Couvrir les questions associées', 'Répondre aux questions voisines que se posent les clients (pas de contenu en masse).', 3],
  'data.jsonld_present': ['Ajouter des données structurées', 'Du JSON-LD schema.org (Organization ou LocalBusiness, WebSite).', 2],
  'data.jsonld_valid': ['Corriger le JSON-LD', 'Le JSON-LD contient une erreur de syntaxe : le corriger et le tester avec l\'outil de test de résultats enrichis.', 1],
  'data.matches_content': ['Aligner schéma et contenu visible', 'Les données structurées doivent refléter exactement ce que la page affiche.', 2],
  'data.org_or_business': ['Déclarer l\'entreprise', 'Un nœud Organization ou LocalBusiness complet (nom, url, logo, coordonnées, réseaux).', 1],
  'data.breadcrumb_website': ['Ajouter BreadcrumbList / WebSite', 'Fil d\'Ariane et WebSite en JSON-LD.', 1],
  'local.nap_consistent': ['Uniformiser nom, adresse, téléphone', 'Strictement identiques sur le site, la fiche Google, Apple, Bing et les annuaires.', 1],
  'local.localbusiness_schema': ['Ajouter le schéma LocalBusiness', 'Type précis (Plumber, Restaurant…), adresse, horaires, zone desservie, coordonnées.', 1],
  'local.keywords_title_h1': ['Mettre métier + ville dans title et H1', 'Ex. « Plombier à Saint-Étienne » dans le title et le H1 de la page d\'accueil.', 1],
  'local.contact_map_hours': ['Afficher contact, plan et horaires', 'Adresse, téléphone cliquable, horaires et carte visibles sur le site.', 1],
  'local.gbp_aligned': ['Aligner la fiche Google', 'Informations de la fiche Google Business Profile identiques à celles du site.', 1],
  'local.genuine_reviews': ['Afficher de vrais avis', 'Uniquement des avis réels et vérifiables, jamais fabriqués.', 2],
  'local.gbp_complete': ['Compléter la fiche Google Business Profile', 'Catégorie principale exacte, horaires, services, photos, description, zone : c\'est la base de « trouve-moi un plombier à… ».', 2],
  'local.apple_business': ['Créer la fiche Apple Business Connect', 'Gratuit ; alimente Apple Plans (Siri).', 1],
  'local.bing_places': ['Créer la fiche Bing Places', 'Gratuit ; alimente Bing et Copilot.', 1],
  'local.reviews_managed': ['Collecter et répondre aux avis', 'Demander des avis à de vrais clients et répondre à chacun.', 2],
  'intl.hreflang_reciprocal': ['Rendre les hreflang réciproques', 'Chaque version de langue pointe vers toutes les autres et vers elle-même.', 2],
  'intl.hreflang_codes': ['Corriger les codes hreflang', 'Codes valides (fr, en, fr-FR…) et x-default si utile.', 1],
  'intl.canonical_per_lang': ['Un canonical par langue', 'Chaque version de langue a son propre canonical auto-référent.', 1],
  'intl.lang_per_version': ['Déclarer la langue de chaque version', 'L\'attribut lang de <html> correspond à la langue de la page.', 1],
  'intl.switcher_links': ['Sélecteur de langue en vrais liens', 'Des liens <a> explorables, pas seulement du JavaScript.', 1],
  'intl.sitemap_all_langs': ['Lister toutes les langues dans le sitemap', 'Chaque version de langue figure dans le sitemap.', 1],
  'ux.responsive': ['Rendre le site responsive', 'Ajouter <meta name="viewport" content="width=device-width, initial-scale=1"> et tester du mobile au desktop : aucun débordement horizontal, cibles tactiles d\'au moins 44 px.', 2],
  'ux.contrast_aa': ['Corriger les contrastes (AA)', 'Rapport de contraste d\'au moins 4,5:1 pour le texte courant (3:1 pour le grand texte), sur tous les fonds.', 2],
  'ux.keyboard_focus': ['Rendre le clavier utilisable', 'Liens, boutons et champs accessibles à la touche Tab, avec un contour de focus visible (jamais outline: none sans remplaçant).', 2],
  'ux.form_labels': ['Étiqueter les champs de formulaire', 'Un <label for> (ou aria-label) associé à chaque champ.', 1],
  'ux.form_quality': ['Fiabiliser les formulaires', 'Validation des champs, protection anti-spam, et page de remerciement après envoi.', 2],
  'ux.single_cta': ['Un seul appel à l\'action dominant', 'Un bouton principal par page ; les autres en second plan.', 1],
  'ux.cta_sticky_mobile': ['Barre d\'action mobile', 'Barre fixe « Appeler / Itinéraire » sur mobile, sans masquer le contenu.', 2],
  'ux.custom_404': ['Personnaliser la page 404', 'Une vraie page 404 (code HTTP 404) avec message clair et liens vers l\'accueil et le contact.', 1],
  'ux.favicon': ['Ajouter un favicon', 'Une icône (favicon.ico ou balise <link rel="icon">).', 1],
  'ux.no_tracking_embeds': ['Supprimer traceurs et embeds à cookies', 'Retirer YouTube/Maps interactifs et boutons sociaux ou ajouter une bannière de consentement. Pour la carte : image cliquable vers Google Maps.', 2],
  'ux.analytics': ['Installer une mesure d\'audience', 'Plausible ou Umami (sans cookie, pas de bannière) de préférence.', 1],
  'ux.social_links': ['Relier les réseaux sociaux', 'Liens vers Instagram / Facebook si le commerce en a.', 1],
  'content.no_meta_keywords': ['Retirer meta keywords', 'Supprimer la balise : les mots-clés vivent dans titres, H1, URL et texte.', 1],
  'content.real_photos': ['Mettre de vraies photos', 'Photos réelles du lieu et des produits (au minimum la devanture).', 2],
  'content.team_photo': ['Ajouter une photo de l\'équipe', 'Photo du gérant ou de l\'équipe : confiance et crédibilité (E-E-A-T).', 1],
  'content.case_studies': ['Présenter des réalisations', 'Études de cas, avant/après selon le métier.', 3],
  'data.rich_results_test': ['Valider les données structurées', 'Passer chaque page dans le test des résultats enrichis de Google : aucune erreur.', 1],
  'local.local_vocabulary': ['Ancrer le texte localement', 'Citer ville, quartiers, rues et repères dans les textes (« près de la place… »).', 1],
  'setup.search_console': ['Configurer Google Search Console', 'Ajouter le site, valider la propriété et soumettre le sitemap (action à faire par vous).', 1],
  'setup.backlinks_local': ['Obtenir des liens locaux', 'Presse locale, partenaires, fournisseurs, annuaires de qualité. Jamais achetés.', 3],
  'legal.cgv': ['Rédiger CGV / CGU', 'Obligatoires en cas de vente ou de prestation en ligne.', 2],
  'sec.no_exposed_files': ['Fermer l\'accès aux fichiers sensibles', 'Retirer .env / .git du serveur public, changer les clés exposées.', 1],
  'sec.repo_secrets': ['Nettoyer les secrets du dépôt', '.env ignoré par git ; seul .env.example est versionné ; changer toute clé déjà publiée.', 1],
  'sec.deps_audit': ['Mettre à jour les dépendances', 'Lancer npm audit et corriger les failles graves.', 2],
  'sec.server_validation': ['Valider côté serveur', 'Contrôler les entrées de formulaire côté serveur, garder clés et appels de services dans app/api/.', 2],
};
export const EFFORT = { 1: 'rapide', 2: 'moyen', 3: 'long' };
const IMPACT = { critique: 3, important: 2, bonus: 1 };

export function adviceFor(id) {
  const a = A[id]; const c = byId.get(id);
  if (!a) return { title: c?.label || id, how: '', effort: 2 };
  return { title: a[0], how: a[1], effort: a[2] };
}

// Liste d'actions priorisées à partir des contrôles en échec
export function actionList(checks, decisions = {}) {
  return checks.filter((c) => c.status === 'fail').map((c) => {
    const a = adviceFor(c.id);
    return { id: c.id, domainLabel: c.domainLabel, weight: c.weight, label: c.label, evidence: c.evidence, title: a.title, how: a.how, effort: a.effort, effortLabel: EFFORT[a.effort], impact: IMPACT[c.weight], decision: decisions[c.id] || null };
  }).sort((x, y) => (y.impact * 10 / y.effort) - (x.impact * 10 / x.effort) || x.id.localeCompare(y.id));
}

// Prompt à coller dans la session Claude Code qui construit le site : uniquement les actions validées
export function fixPrompt(snap, actions, lang = 'fr') {
  if (lang === 'en') return fixPromptEn(snap, actions);
  const L = [];
  L.push(`Tu travailles sur le site ${snap.url}. Un audit SEO/GEO du ${snap.date} a relevé les points ci-dessous. Applique UNIQUEMENT ces corrections, sans rien changer d'autre, puis montre-moi un résumé des fichiers modifiés avant tout déploiement.\n`);
  actions.forEach((a, i) => {
    L.push(`${i + 1}. [${a.id}] ${a.title}`);
    L.push(`   Constat : ${a.evidence || a.label}`);
    L.push(`   À faire : ${a.how}`);
  });
  L.push('\nSi tu as une checklist de mise en ligne, suis-la aussi, et signale tout point que tu ne peux pas vérifier.');
  L.push('Règles : ne fabrique ni avis, ni chiffres, ni adresses ; les données structurées doivent refléter le contenu visible ; garde les URL existantes (si une URL change, ajoute une redirection 301).');
  L.push('Quand c\'est fini, dis-moi comment relancer un audit pour vérifier.');
  return L.join('\n');
}

// Prompt pour demander à Claude (dans le dossier de SEO GEO Test) de compléter ce que l'application ne peut pas mesurer
export function completePrompt(slug, snap, auditId, lang = 'fr') {
  if (lang === 'en') return completePromptEn(slug, snap, auditId);
  const todo = catalog.checks.filter((c) => (c.applies !== 'local' || snap.profile?.local) && (c.applies !== 'multilingue' || snap.profile?.multilingual)
    && (snap.checks?.[c.id]?.status ?? 'unverified') === 'unverified').map((c) => `- ${c.id} : ${c.label}`);
  return [
    `Dans le dossier de SEO GEO Test, complète l'audit « ${slug} » du ${snap.date} (reports/${slug}/${auditId}/snapshot.json).`,
    'L\'application a rempli tout ce qu\'elle pouvait vérifier seule. Il reste à traiter, avec mon accord pour chaque accès :',
    ...todo.slice(0, 30),
    '',
    'Pour chaque point : vérifie réellement (navigateur Claude in Chrome, Search Console, Bing, fiches), mets à jour UNIQUEMENT le snapshot.json (statut pass/fail/na + preuve), ne devine rien : si tu ne peux pas vérifier, laisse « unverified ».',
    'Si je te donne des positions ou des mesures IA, ajoute-les dans serp.runs / ai.runs avec les mêmes requêtes figées (queries.json / prompts.json). Ne modifie rien d\'autre, puis dis-moi ce qui a changé.',
  ].join('\n');
}

// Prompt pour mesurer, avec Claude dans le Chrome de l'utilisateur, ce que les API ne couvrent pas.
export function measurePrompt(slug, snap, auditId, queries, prompts, lang = 'fr') {
  if (lang === 'en') return measurePromptEn(slug, snap, auditId, queries, prompts);
  const host = (() => { try { return new URL(snap.url).host; } catch { return snap.url; } })();
  return [
    `Dans le dossier de SEO GEO Test, mesure la visibilité du site ${host} pour l'audit « ${slug} » du ${snap.date} (reports/${slug}/${auditId}/snapshot.json), avec mon navigateur Chrome (Claude in Chrome).`,
    '',
    'Requêtes (moteurs classiques : Brave, Bing, et Google Maps / Apple Plans pour les requêtes vocales ou locales) :',
    ...(queries.length ? queries.map((q) => `- ${q.id} : ${q.text}${q.kind === 'voice' ? ' (vocale)' : ''}`) : ['- (aucune : demande-moi lesquelles ajouter)']),
    '',
    'Questions pour les IA (ChatGPT, Perplexity, Gemini, Copilot, selon les comptes où je suis connecté) :',
    ...(prompts.length ? prompts.map((q) => `- ${q.id} : ${q.text}`) : ['- (aucune : demande-moi lesquelles ajouter)']),
    '',
    'Règles : lentement, petit volume, une IA après l\'autre, deux passages par question. Arrête-toi immédiatement au premier captcha ou avertissement et dis-le-moi. Aucun contournement, aucun identifiant saisi à ma place. Pas de requêtes automatisées sur Google : pour Google, je t\'importe l\'export Search Console dans l\'application.',
    'Pour chaque moteur : note ma place dans les 30 premiers résultats (ou « hors liste »). Pour chaque IA : mon site est-il mentionné ? cité en source ? quels concurrents ? Jamais de « rang » inventé pour une IA.',
    'Écris UNIQUEMENT dans snapshot.json (serp.runs et ai.runs, même format que les entrées déjà présentes dans le fichier, method « browser »), puis résume-moi ce que tu as trouvé.',
  ].join('\n');
}

// ---- English prompts (the app texts are translated at display time; prompts are written directly) ----
import { CHK } from './en-checks.mjs';
function fixPromptEn(snap, actions) {
  const L = [`You are working on the website ${snap.url}. An SEO/GEO audit dated ${snap.date} found the points below. Apply ONLY these fixes, change nothing else, then show me a summary of the modified files before any deployment.\n`];
  actions.forEach((a, i) => {
    const e = CHK[a.id];
    L.push(`${i + 1}. [${a.id}] ${e ? e[3] : a.title}`);
    L.push(`   Finding: ${a.evidence || (e ? e[0] : a.label)}`);
    L.push(`   To do: ${e ? e[4] : a.how}`);
  });
  L.push('\nAlso follow your go-live checklist if you have one, and flag anything you cannot verify.');
  L.push('Rules: never invent reviews, figures or addresses; structured data must reflect the visible content; keep existing URLs (if a URL changes, add a 301 redirect).');
  L.push('When done, tell me how to re-run an audit to check.');
  return L.join('\n');
}
function completePromptEn(slug, snap, auditId) {
  const todo = catalog.checks.filter((c) => (c.applies !== 'local' || snap.profile?.local) && (c.applies !== 'multilingue' || snap.profile?.multilingual)
    && (snap.checks?.[c.id]?.status ?? 'unverified') === 'unverified').map((c) => `- ${c.id}: ${CHK[c.id]?.[0] || c.label}`);
  return [
    `In the SEO GEO Test folder, complete the audit "${slug}" dated ${snap.date} (reports/${slug}/${auditId}/snapshot.json).`,
    'The app filled in everything it could verify on its own. What remains, to be handled with my approval for each access:',
    ...todo.slice(0, 30), '',
    'For each point: really verify it (Claude in Chrome, Search Console, Bing, listings), update ONLY snapshot.json (status pass/fail/na + evidence), never guess: if you cannot verify, leave "unverified".',
    'If I give you rankings or AI measurements, add them to serp.runs / ai.runs with the same frozen queries (queries.json / prompts.json). Change nothing else, then tell me what changed.',
  ].join('\n');
}
function measurePromptEn(slug, snap, auditId, queries, prompts) {
  const host = (() => { try { return new URL(snap.url).host; } catch { return snap.url; } })();
  return [
    `In the SEO GEO Test folder, measure the visibility of ${host} for the audit "${slug}" dated ${snap.date} (reports/${slug}/${auditId}/snapshot.json), using my Chrome browser (Claude in Chrome).`, '',
    'Queries (classic engines: Brave, Bing, and Google Maps / Apple Maps for voice or local queries):',
    ...(queries.length ? queries.map((q) => `- ${q.id}: ${q.text}${q.kind === 'voice' ? ' (voice)' : ''}`) : ['- (none: ask me which to add)']), '',
    'Questions for the AIs (ChatGPT, Perplexity, Gemini, Copilot, depending on the accounts I am signed in to):',
    ...(prompts.length ? prompts.map((q) => `- ${q.id}: ${q.text}`) : ['- (none: ask me which to add)']), '',
    'Rules: slowly, small volume, one AI after another, two passes per question. Stop immediately at the first captcha or warning and tell me. No bypass, never type credentials for me. No automated queries on Google: for Google, I import the Search Console export into the app.',
    'For each engine: note my place in the top 30 results (or "not listed"). For each AI: is my site mentioned? cited as a source? which competitors? Never an invented "rank" for an AI.',
    'Write ONLY to snapshot.json (serp.runs and ai.runs, same format as the entries already in the file, method "browser"), then summarize what you found.',
  ].join('\n');
}
