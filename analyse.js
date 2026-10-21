/* ===== Mes Tâches Chantier — analyse d'une dictée en français =====
   Transforme une phrase dite à voix haute en une ou plusieurs tâches :
   « demain à 9h appeler Cotta c'est urgent, puis vendredi contrôle qualité
     Néolia Belfort » → 2 tâches avec date, heure, priorité, catégorie, chantier.
   Aucune donnée privée ici : la liste des chantiers (lexique) vient du dépôt
   privé au moment de la synchro. */

'use strict';

(function (racine) {

  /* ---------- Outils texte ---------- */

  const MOTS_VIDES = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'et', 'chez']);

  // Minuscules sans accents, MÊME longueur que le texte d'origine
  // (pour pouvoir retirer les morceaux reconnus du texte original).
  function plier(s) {
    let r = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '’' || c === '‘') { r += "'"; continue; }
      let b = c.normalize('NFD').charAt(0).toLowerCase();
      if (b.length !== 1) b = c;
      r += b;
    }
    return r;
  }

  // Même règle que outils/generer_lexique.py → normaliser()
  function normaliser(s) {
    return plier(String(s || '').normalize('NFC')).replace(/[^a-z0-9]+/g, ' ')
      .split(' ').filter(function (m) { return m && !MOTS_VIDES.has(m); }).join(' ');
  }

  const NOMBRES = {
    'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7,
    'huit': 8, 'neuf': 9, 'dix': 10, 'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14,
    'quinze': 15, 'seize': 16, 'vingt': 20, 'vingt et un': 21, 'trente': 30, 'premier': 1, '1er': 1
  };
  const NUM = '(\\d{1,2}|vingt et un|une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente)';
  function nombre(s) {
    if (s == null) return null;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return NOMBRES[s] != null ? NOMBRES[s] : null;
  }

  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const JOURS_RE = '(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)';
  const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout',
                'septembre', 'octobre', 'novembre', 'decembre'];
  const MOIS_RE = '(' + MOIS.join('|') + ')';
  const MOMENTS_RE = '(matin|midi|soir|apres[- ]midi|en fin de journee|en fin de matinee|dans la matinee|dans la journee|en debut d\'apres[- ]midi|en fin d\'apres[- ]midi)';

  /* ---------- Dates ---------- */

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function plus(ref, n) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }
  function joursDansMois(a, m) { return new Date(a, m + 1, 0).getDate(); }

  function prochainJour(ref, j, mode) {
    const auj = ref.getDay();
    if (mode === 'semaine-prochaine') {
      const lundi = plus(ref, ((8 - auj) % 7) || 7);
      return plus(lundi, (j + 6) % 7);
    }
    let diff = (j - auj + 7) % 7;
    if (diff === 0) diff = (mode === 'ce') ? 0 : 7;
    if (mode === 'en-huit') diff += 7;
    return plus(ref, diff);
  }

  function dateDuJour(ref, jour, mois, annee) {
    // mois : 0-11 ou null (= ce mois-ci ou le suivant)
    let a = annee || ref.getFullYear();
    let m = mois;
    if (m == null) {
      m = ref.getMonth();
      if (jour < ref.getDate()) { m += 1; if (m > 11) { m = 0; a += 1; } }
    }
    if (jour < 1 || jour > joursDansMois(a, m)) return null;
    let d = new Date(a, m, jour);
    if (!annee && d < plus(ref, 0)) d = new Date(a + 1, m, jour);
    return d;
  }

  /* ---------- Moteur : on cherche des motifs et on « consomme » le texte reconnu ---------- */

  function Segment(texte) {
    this.texte = texte;
    this.bas = plier(texte);
    this.pris = new Array(texte.length).fill(false);
  }
  Segment.prototype.chercher = function (motif, traiter) {
    const re = new RegExp(motif, 'g');
    let m;
    while ((m = re.exec(this.bas)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      let libre = true;
      for (let i = m.index; i < m.index + m[0].length; i++) if (this.pris[i]) { libre = false; break; }
      if (!libre) continue;
      const r = traiter(m);
      if (r !== false) {
        for (let i = m.index; i < m.index + m[0].length; i++) this.pris[i] = true;
        return true;
      }
    }
    return false;
  };
  Segment.prototype.reste = function () {
    let r = '';
    for (let i = 0; i < this.texte.length; i++) r += this.pris[i] ? ' ' : this.texte[i];
    return r.replace(/\s+/g, ' ').trim();
  };

  /* ---------- Titre : retirer les formules et mettre le verbe à l'infinitif ---------- */

  // Verbes sans ambiguïté : convertis aussi en tête de phrase (« Appelle Cotta » → « Appeler Cotta »)
  const INFINITIFS = {
    'appelle': 'appeler', 'appelles': 'appeler', 'rappelle': 'rappeler', 'rappelles': 'rappeler',
    'envoie': 'envoyer', 'envoies': 'envoyer', 'renvoie': 'renvoyer',
    'fasse': 'faire', 'fais': 'faire', 'voie': 'voir', 'vois': 'voir', 'aille': 'aller', 'va': 'aller',
    'prenne': 'prendre', 'prends': 'prendre', 'previenne': 'prévenir', 'previens': 'prévenir',
    'revienne': 'revenir', 'ecrive': 'écrire', 'ecris': 'écrire', 'reponde': 'répondre',
    'reponds': 'répondre', 'rende': 'rendre', 'rends': 'rendre', 'mette': 'mettre', 'mets': 'mettre',
    'remette': 'remettre', 'remets': 'remettre', 'finisse': 'finir', 'finis': 'finir',
    'sorte': 'sortir', 'sors': 'sortir', 'dise': 'dire', 'dis': 'dire', 'lise': 'lire', 'lis': 'lire',
    'nettoie': 'nettoyer', 'paie': 'payer', 'essaie': 'essayer', 'recupere': 'récupérer',
    'prepare': 'préparer', 'verifie': 'vérifier', 'relance': 'relancer', 'contacte': 'contacter',
    'imprime': 'imprimer', 'organise': 'organiser', 'renseigne': 'renseigner', 'valide': 'valider',
    'planifie': 'planifier', 'prevois': 'prévoir', 'prevoie': 'prévoir', 'installe': 'installer',
    'telephone': 'téléphoner', 'transmets': 'transmettre', 'transmette': 'transmettre',
    'informe': 'informer', 'previent': 'prévenir', 'depose': 'déposer', 'donne': 'donner'
  };
  // Mots qui sont aussi des noms (« Contrôle qualité », « Commande produits ») :
  // convertis seulement après « que je … »
  const INFINITIFS_APRES_QUE_JE = {
    'achete': 'acheter', 'complete': 'compléter', 'regle': 'régler', 'gere': 'gérer',
    'controle': 'contrôler', 'commande': 'commander', 'passe': 'passer', 'demande': 'demander',
    'montre': 'montrer', 'porte': 'porter', 'signe': 'signer', 'change': 'changer', 'livre': 'livrer',
    'cherche': 'chercher', 'trouve': 'trouver', 'termine': 'terminer', 'note': 'noter',
    'range': 'ranger', 'remplace': 'remplacer'
  };

  function enInfinitif(mot, apresQueJe) {
    const p = plier(mot);
    if (Object.prototype.hasOwnProperty.call(INFINITIFS, p)) return INFINITIFS[p];
    if (apresQueJe) {
      if (Object.prototype.hasOwnProperty.call(INFINITIFS_APRES_QUE_JE, p)) return INFINITIFS_APRES_QUE_JE[p];
      if (/[a-z]e$/.test(p)) return mot + 'r';
      if (/[a-z]es$/.test(p)) return mot.slice(0, -1) + 'r';
    }
    return null;
  }

  const DEBUTS = [
    /^(?:(?:ok|okay|bon|alors|euh|heu|donc|bref|hey|dis|claude|oui|voila|bonjour|salut|ecoute)\b[\s,!.]*)+/,
    /^(?:tu peux |peux[- ]tu |pourrais[- ]tu |est[- ]ce que tu peux |tu pourrais )?(?:m'|me )?(?:ajouter|ajoute|ajoutes|rajoute|rajouter|mets|mettre|met|note|noter|notes|cree|creer|enregistre|enregistrer|programme|programmer)(?:[- ]moi| le| la| les)?(?: (?:une|la|ma|les|des|deux|trois|quatre|cinq) )?(?:(?:nouvelle|petite|autre) )?(?:taches?|rappels?|choses?|trucs?)?(?: pour moi)?(?: qui (?:dit|consiste a))?[\s:,]*(?:de |d'|que )?/,
    /^(?:j'ai (?:une|deux|trois|quatre|cinq) (?:taches?|choses?)(?: a (?:noter|ajouter))?[\s:,]*)/,
    /^(?:je (?:voudrais|veux|souhaite|souhaiterais|aimerais) (?:que tu |qu'on |)(?:notes?|noter|ajoutes?|ajouter|mettes|mettre|rajoutes?|rajouter|enregistres?|enregistrer)(?: (?:une|la|cette) (?:taches?|rappel))?[\s:,]*(?:de |d'|que )?)/,
    /^(?:premierement|premiere tache|premiere chose|d'abord|tout d'abord)[\s:,]*/,
    /^(?:(?:il faut|faut|il faudrait|faudrait|il va falloir|va falloir) (?:penser a |pas oublier (?:de |d')|que (?:je |j')|)|(?:rappelle|rappelles|rappeler)[- ]moi (?:de |d'|que |qu')|(?:pense|penser|il faut penser|faut penser)[- ](?:moi )?a |n'oublie pas (?:de |d'|que )|ne pas oublier (?:de |d')|il ne faut pas que j'oublie (?:de |d')|(?:moi )?je dois |je devrai |je devrais |j'ai a |je vais |j'ai besoin de |je voudrais |je veux |tache[\s:,]+)/
  ];

  function nettoyerTitre(t) {
    let titre = t;
    let queJe = false;
    let encore = true;
    let tours = 0;
    while (encore && tours++ < 8) {
      encore = false;
      for (let i = 0; i < DEBUTS.length; i++) {
        const m = DEBUTS[i].exec(plier(titre));
        if (m && m[0].length) {
          if (/que (?:je |j')$/.test(m[0]) || /qu'$/.test(m[0])) queJe = true;
          titre = titre.slice(m[0].length);
          encore = true;
        }
      }
      // « que je … » / « que j'… » restant en tête
      const q = /^(?:que |qu')?(?:je |j')/.exec(plier(titre));
      if (q && (queJe || /^que /.test(q[0]))) { titre = titre.slice(q[0].length); queJe = true; encore = true; }
    }
    // formules de politesse / bruit
    titre = titre.replace(/\b(s'il te pla[iî]t|s'il vous pla[iî]t|stp|svp|merci( beaucoup)?)\b/gi, ' ');

    // Ménage des bords (prépositions orphelines, ponctuation)
    const bordG = /^(?:(?:et|puis|alors|donc|aussi|de|que|à|a|pour|le|la|les)(?:\s+|$)|(?:d'|qu')|[,:;\-–.]\s*)/i;
    const bordD = /\s*(?:\b(?:à|a|pour|le|la|les|de|du|d'|avant|vers|et|des|au|aux|dans|ce|cette|d'ici|jusqu'à|jusqu'a|c'est|c est|en|sur|par)|[,:;\-–.])$/i;
    titre = titre.replace(/\s+/g, ' ').trim();
    for (let n = 0; n < 6; n++) {
      const avant = titre;
      titre = titre.replace(bordD, '').trim();
      if (!queJe) titre = titre.replace(bordG, '').trim();
      if (titre === avant) break;
    }

    // Verbe en tête → infinitif (« que j'appelle Cotta » → « appeler Cotta »)
    const m = /^([A-Za-zÀ-ÿ'-]+)(.*)$/.exec(titre);
    if (m) {
      const inf = enInfinitif(m[1], queJe);
      if (inf) titre = inf + m[2];
    }
    titre = titre.replace(/\s+/g, ' ').trim();
    return titre.charAt(0).toUpperCase() + titre.slice(1);
  }

  /* ---------- Catégorie, chantier, agentes ---------- */

  const CATEGORIES_RE = [
    ['qualite',  /\b(controle|controler|controles|audit|verifier|verification|qualite|inspection|visite de (?:chantier|controle)|passage sur site|tournee)\b/],
    ['equipe',   /\b(conges?|cp|rtt|remplacement|remplacer|remplacante?|planning|absence|absente?|arret|maladie|avertissement|entretien (?:annuel|individuel|professionnel)|embauche|recrutement|recruter|contrat de travail|mise en place|formation|former|equipe|agente?s?|salariee?s?|paie|salaire|heures sup\w*|feuille de route|horaires?)\b/],
    ['materiel', /\b(produits?|materiel|autolaveuse|aspirateurs?|monobrosse|balayeuse|chariots?|sacs?|papier|essuie[- ]mains?|savon|commander|commande|livraison|livrer|stock|linge|vehicule|camion|camionnette|cles?|badges?|badgeuse|seaux?|balais?|lavettes?|microfibres?)\b/],
    ['client',   /\b(clients?|devis|rdv|rendez[- ]vous|reunion|reclamation|reclamations|proposition|offre|syndic|gerant|gestionnaire)\b/],
    ['admin',    /\b(factures?|facturer|mails?|e-?mails?|courriers?|courriel|dossiers?|renseigner|erp|urssaf|declarer|declaration|administratif|papiers|imprimer|scanner|signer|tableau|excel|banque|comptable|attestation)\b/]
  ];

  function categorie(bas, agents) {
    const explicite = /\bcategorie (chantier|equipe|qualite|materiel|client|administratif|admin)\b/.exec(bas);
    if (explicite) return explicite[1] === 'administratif' ? 'admin' : explicite[1];
    for (let i = 0; i < CATEGORIES_RE.length; i++) {
      if (CATEGORIES_RE[i][0] === 'equipe' && agents.length && !CATEGORIES_RE[0][1].test(bas)) return 'equipe';
      if (CATEGORIES_RE[i][1].test(bas)) return CATEGORIES_RE[i][0];
    }
    return 'chantier';
  }

  function contient(texteNorm, cle) {
    return (' ' + texteNorm + ' ').indexOf(' ' + cle + ' ') >= 0;
  }

  function trouverChantier(texte, lexique) {
    const vide = { site: '', adresse: '', candidats: [] };
    if (!lexique || !Array.isArray(lexique.chantiers)) return vide;
    const n = normaliser(texte);
    let meilleurs = [], longueur = 0;
    lexique.chantiers.forEach(function (c) {
      (c.cles || []).forEach(function (k) {
        if (!contient(n, k)) return;
        if (k.length > longueur) { longueur = k.length; meilleurs = [c]; }
        else if (k.length === longueur && meilleurs.indexOf(c) < 0) meilleurs.push(c);
      });
    });
    if (meilleurs.length === 1 ||
        (meilleurs.length > 1 && meilleurs.every(function (c) { return c.adresse && c.adresse === meilleurs[0].adresse; }))) {
      return { site: meilleurs[0].nom, adresse: meilleurs[0].adresse || '', candidats: [] };
    }
    if (meilleurs.length > 1) {
      return { site: '', adresse: '', candidats: meilleurs.map(function (c) { return c.nom; }) };
    }
    // Mot de « famille » (ex. « Néolia » seul) → proposer le choix
    let fam = null;
    (lexique.familles || []).forEach(function (f) {
      if (contient(n, f.cle) && (!fam || f.cle.length > fam.cle.length)) fam = f;
    });
    if (fam) return { site: '', adresse: '', candidats: fam.chantiers.slice() };
    return vide;
  }

  function trouverAgents(texte, lexique) {
    if (!lexique || !Array.isArray(lexique.agents)) return [];
    const n = normaliser(texte);
    return lexique.agents.filter(function (a) {
      return (a.cles || []).some(function (k) { return contient(n, k); });
    }).map(function (a) { return a.nom; });
  }

  function chantierParNom(nom, lexique) {
    if (!nom || !lexique || !Array.isArray(lexique.chantiers)) return null;
    const n = normaliser(nom);
    return lexique.chantiers.find(function (c) {
      return normaliser(c.nom) === n || (c.cles || []).indexOf(n) >= 0;
    }) || null;
  }

  /* ---------- Analyse d'un segment (une tâche) ---------- */

  function hhmm(h, m) {
    if (h == null || h > 23 || m > 59) return '';
    return String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0');
  }
  function minutesSuffixe(suf) {
    if (!suf) return 0;
    if (/demie?/.test(suf)) return 30;
    if (/quart/.test(suf) && /moins/.test(suf)) return -15;
    if (/quart/.test(suf)) return 15;
    return parseInt(suf, 10) || 0;
  }

  function analyserSegment(texte, ref, lexique) {
    const s = new Segment(texte);
    const r = { titre: '', date: '', heure: '', duree: '', priorite: 'normale', categorie: 'chantier',
                site: '', adresse: '', candidats: [], agents: [], notes: '', dictee: texte.trim(),
                dateDite: false, sansDate: false, moment: '' };

    /* Durée (avant l'heure, pour ne pas confondre « pendant 2 heures » et « à 2 heures ») */
    s.chercher('\\b(?:pendant|duree(?: de)?|ca (?:va )?prendre|ca prend|prevoir|compter)(?: environ| a peu pres)? ' + NUM +
      ' ?(?:h|heures?)(?: ?(\\d{2})| (et demie?|et quart))?\\b', function (m) {
      const h = nombre(m[1]);
      if (h == null) return false;
      r.duree = String(h * 60 + (m[2] ? parseInt(m[2], 10) : minutesSuffixe(m[3])));
    });
    s.chercher('\\b(?:pendant|duree(?: de)?|ca prend|prevoir|compter) (?:une )?demi[- ]heure\\b', function () { r.duree = '30'; });
    s.chercher('(?<!dans )(?<!il y a )\\b(?:(?:pendant|duree(?: de)?|pour|ca prend|prevoir|compter|de) )?(?:environ )?' + NUM + ' ?(?:minutes?|mn|min)\\b', function (m) {
      const n = nombre(m[1]);
      if (n == null) return false;
      r.duree = String(n);
    });

    /* Priorité (« pas urgent » avant « urgent ») */
    s.chercher("\\b(?:c'est |c est |ce n'est |ce n est )?(?:pas (?:tres |trop |du tout |si )?(?:urgent|presse|prioritaire|important)e?|quand j'(?:ai|aurai) (?:le |du )temps|a l'occasion|si possible|sans urgence|rien de presse|un de ces jours|un jour|priorite basse)\\b", function (m) {
      r.priorite = 'basse';
      if (/temps|un jour|un de ces jours|occasion/.test(m[0])) r.sansDate = true;
    });
    s.chercher("\\b(?:(?:et )?(?:c'est|c est|ca c'est|tres|hyper|super|vraiment|extremement|trop) )*(?:urgent(?:e|es|s)?|en urgence|d'urgence|urgence|prioritaire|priorite (?:haute|absolue|1|un)|important(?:e|es|s)?|asap|au plus vite|au plus tot|des que possible|le plus vite possible|le plus rapidement possible|imperatif|imperativement|sans faute|a ne pas oublier)\\b", function () {
      r.priorite = 'haute';
    });
    s.chercher('\\bpriorite (?:normale|moyenne)\\b', function () { r.priorite = 'normale'; });

    /* Date */
    function poserDate(d, moment) {
      if (!d) return false;
      r.date = iso(d); r.dateDite = true;
      if (moment) r.moment = moment;
    }
    const prefixe = "(?:(?:le|pour le|au|d'ici le|avant le|jusqu'au|a partir du|des le|pour) )?";
    const trouve =
      s.chercher('\\b' + prefixe + '(?:' + JOURS_RE + ' )?(1er|premier|' + NUM.slice(1, -1) + ') ' + MOIS_RE + '(?: (\\d{4}))?\\b', function (m) {
        const j = nombre(m[2]);
        return poserDate(dateDuJour(ref, j, MOIS.indexOf(m[3]), m[4] ? parseInt(m[4], 10) : null));
      }) ||
      s.chercher('\\b' + prefixe + '(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b', function (m) {
        let a = m[3] ? parseInt(m[3], 10) : null;
        if (a != null && a < 100) a += 2000;
        const mo = parseInt(m[2], 10) - 1;
        if (mo < 0 || mo > 11) return false;
        return poserDate(dateDuJour(ref, parseInt(m[1], 10), mo, a));
      }) ||
      s.chercher("\\b(?:(?:pour|d'ici|avant|des) )?(apres[- ]demain|demain|aujourd'hui|aujourd hui|ce soir|ce matin|ce midi|cet apres[- ]midi|tout a l'heure|dans la journee|tantot)(?: " + MOMENTS_RE + ')?\\b', function (m) {
        const mot = m[1];
        const n = /^apres/.test(mot) ? 2 : mot === 'demain' ? 1 : 0;
        const moment = m[2] || (/^(ce|cet) /.test(mot) ? mot.replace(/^(ce|cet) /, '') : '');
        return poserDate(plus(ref, n), moment);
      }) ||
      s.chercher("\\b(?:(ce|le|pour|d'ici|avant|jusqu'a|des) )?" + JOURS_RE + "( prochain| qui vient| de la semaine prochaine| en huit)?(?: " + MOMENTS_RE + ')?\\b', function (m) {
        const mode = m[3] && /semaine prochaine/.test(m[3]) ? 'semaine-prochaine' :
                     m[3] && /huit/.test(m[3]) ? 'en-huit' : (m[1] === 'ce' ? 'ce' : '');
        return poserDate(prochainJour(ref, JOURS.indexOf(m[2]), mode), m[4] || '');
      }) ||
      s.chercher('\\bdans ' + NUM + ' (jours?|semaines?|mois)\\b', function (m) {
        const n = nombre(m[1]);
        if (n == null) return false;
        if (/^mois/.test(m[2])) { const d = plus(ref, 0); d.setMonth(d.getMonth() + n); return poserDate(d); }
        return poserDate(plus(ref, /^sem/.test(m[2]) ? n * 7 : n));
      }) ||
      s.chercher("\\b(?:(?:pour|d'ici|avant) )?(?:la |en )?semaine prochaine\\b", function () {
        return poserDate(prochainJour(ref, 1, 'semaine-prochaine'));
      }) ||
      s.chercher("\\b(?:(?:pour|d'ici|avant) )?(?:la |en )?fin (?:de (?:la )?semaine)\\b|\\bcette semaine\\b", function () {
        const ven = ref.getDay() <= 5 ? plus(ref, (5 - ref.getDay() + 7) % 7) : prochainJour(ref, 5, '');
        return poserDate(ven);
      }) ||
      s.chercher("\\b(?:(?:pour|d'ici|avant) )?(?:la |en )?fin (?:du|de) mois\\b", function () {
        return poserDate(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
      }) ||
      s.chercher("\\b(?:le |au )?(?:debut du )?mois prochain\\b", function () {
        return poserDate(new Date(ref.getFullYear(), ref.getMonth() + 1, 1));
      }) ||
      s.chercher("\\b(?:le|pour le|d'ici le|avant le|jusqu'au) (1er|premier|" + NUM.slice(1, -1) +
        ")\\b(?! ?(?:h\\b|heures?|:|min|jours?|semaines?|mois|ans?|%|euros?|€|personnes?|agents?|\\d))", function (m) {
        return poserDate(dateDuJour(ref, nombre(m[1]), null, null));
      });

    /* Heure */
    function poserHeure(h, mn, qualif) {
      if (h == null) return false;
      if (qualif && /soir|apres|aprem/.test(qualif) && h < 12) h += 12;
      if (mn < 0) { h -= 1; mn += 60; }
      const v = hhmm(h, mn);
      if (!v) return false;
      r.heure = v;
    }
    s.chercher("\\b(?:(?:a|vers|pour|des|avant|apres|a partir de|aux alentours de|sur les|rendez-vous a|rdv a) )?(\\d{1,2}) ?(?:heures?|h(?![a-z])|:)(?: ?(\\d{2})(?: ?(?:minutes?|min))?| (et demie?|et quart|moins (?:le )?quart))?(?: (du matin|du soir|de l'apres[- ]midi|de l'aprem))?(?![0-9])", function (m) {
      return poserHeure(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : minutesSuffixe(m[3]), m[4]);
    }) ||
    s.chercher("\\b(?:a|vers|pour|des|avant|a partir de) " + NUM + ' heures?(?: (et demie?|et quart|moins (?:le )?quart))?(?: (du matin|du soir|de l\'apres[- ]midi))?\\b', function (m) {
      return poserHeure(nombre(m[1]), minutesSuffixe(m[2]), m[3]);
    }) ||
    s.chercher('\\b(?:(?:a|vers|pour|avant|des) )?(midi|minuit)(?: (et demie?|et quart|moins (?:le )?quart))?\\b', function (m) {
      return poserHeure(m[1] === 'midi' ? 12 : 0, minutesSuffixe(m[2]));
    });
    if (!r.heure && r.moment === 'midi') r.heure = '12:00';
    if (r.moment === 'midi') r.moment = '';
    if (!r.moment) {
      s.chercher('\\b(?:le |en |dans la |en fin de |en debut de )?' + '(matin|matinee|soir|soiree|apres[- ]midi|fin de journee)\\b', function (m) {
        r.moment = m[1];
      });
    }

    /* Chantier, agentes, catégorie : sur la phrase entière */
    const ch = trouverChantier(texte, lexique);
    r.site = ch.site; r.adresse = ch.adresse; r.candidats = ch.candidats;
    r.agents = trouverAgents(texte, lexique);
    r.categorie = categorie(s.bas, r.agents);
    s.chercher('\\bcategorie (?:chantier|equipe|qualite|materiel|client|administratif|admin)\\b', function () {});

    /* Titre */
    let titre = nettoyerTitre(s.reste());
    if (r.moment) {
      const mo = r.moment.replace('apres midi', 'après-midi').replace('apres-midi', 'après-midi')
        .replace('matinee', 'matinée').replace('soiree', 'soirée').replace('fin de journee', 'fin de journée');
      titre = titre ? titre + ' (' + mo.replace(/^(en |dans la |le )/, '') + ')' : '';
    }
    if (titre.length > 80) {
      r.notes = titre;
      let court = titre.slice(0, 70);
      court = court.slice(0, Math.max(court.lastIndexOf(' '), 40));
      titre = court.replace(/[\s,;:]+$/, '') + '…';
    }
    r.titre = titre;
    return r;
  }

  /* ---------- Découpage d'une dictée en plusieurs tâches ---------- */

  const SEPARATEURS = /\s*(?:[.;!?]+\s+|\b(?:et puis|et ensuite|et aussi|puis|ensuite|autre tache|tache suivante|nouvelle tache|deuxieme tache|troisieme tache|quatrieme tache|derniere tache|deuxiemement|troisiemement|apres ca|et apres|une autre chose|autre chose)\b[\s,:]*)/g;

  function decouper(texte) {
    const bas = plier(texte);
    const morceaux = [];
    let debut = 0, m;
    SEPARATEURS.lastIndex = 0;
    while ((m = SEPARATEURS.exec(bas)) !== null) {
      if (m[0].length === 0) { SEPARATEURS.lastIndex++; continue; }
      morceaux.push(texte.slice(debut, m.index));
      debut = m.index + m[0].length;
    }
    morceaux.push(texte.slice(debut));
    return morceaux.map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 1; });
  }

  function analyser(texte, options) {
    options = options || {};
    const ref = options.aujourdhui ? new Date(options.aujourdhui + 'T12:00:00') : new Date();
    const lexique = options.lexique || null;
    const propre = String(texte || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!propre) return [];
    const taches = [];
    let datePrecedente = '';
    decouper(propre).forEach(function (seg) {
      const t = analyserSegment(seg, ref, lexique);
      if (!t.titre || t.titre.length < 2) return;
      if (!t.date && !t.sansDate) {
        t.date = (datePrecedente && !t.dateDite) ? datePrecedente : iso(ref);
      }
      if (t.dateDite) datePrecedente = t.date;
      taches.push(t);
    });
    return taches;
  }

  /* ---------- Phrase de résumé (affichage et lecture à voix haute) ---------- */

  const NOMS_CATEGORIES = { chantier: 'chantier', equipe: 'équipe', qualite: 'contrôle qualité',
    materiel: 'produits et matériel', client: 'client', admin: 'administratif' };

  function dateParlee(isoDate, aujIso) {
    if (!isoDate) return 'sans date';
    const auj = aujIso ? new Date(aujIso + 'T12:00:00') : new Date();
    const d = new Date(isoDate + 'T12:00:00');
    const ecart = Math.round((d - new Date(auj.getFullYear(), auj.getMonth(), auj.getDate(), 12)) / 86400000);
    if (ecart === 0) return "aujourd'hui";
    if (ecart === 1) return 'demain';
    const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return (ecart > 0 && ecart < 7) ? JOURS[d.getDay()] + ' ' + d.getDate() : txt;
  }

  function heureParlee(h) {
    if (!h) return '';
    const p = h.split(':');
    const hh = parseInt(p[0], 10), mm = parseInt(p[1], 10);
    if (hh === 12 && !mm) return 'midi';
    return hh + ' heure' + (hh > 1 ? 's' : '') + (mm ? ' ' + mm : '');
  }

  function resumer(t, aujIso) {
    const morceaux = [t.titre];
    let quand = dateParlee(t.date, aujIso);
    if (t.heure) quand += ' à ' + heureParlee(t.heure);
    morceaux.push(quand);
    if (t.priorite === 'haute') morceaux.push('urgent');
    if (t.priorite === 'basse') morceaux.push('pas urgent');
    return morceaux.join(', ');
  }

  const API = {
    analyser: analyser,
    resumer: resumer,
    dateParlee: dateParlee,
    heureParlee: heureParlee,
    normaliser: normaliser,
    trouverChantier: trouverChantier,
    chantierParNom: chantierParNom,
    NOMS_CATEGORIES: NOMS_CATEGORIES
  };
  racine.AnalyseDictee = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : globalThis);
