/* ===== Mes Tâches Chantier — dictée vocale et lecture de la journée =====
   🎤 « Pilote auto » (par défaut) : on parle, l'appli comprend et ENREGISTRE SEULE
      dès qu'on se tait. Elle ne demande une validation qu'en cas de vrai doute
      (ex. « Néolia » sans autre indice) : UNE question, à l'oral, réponse à l'oral.
      Dire « annule » à la fin pour tout oublier, « enregistre » / « c'est tout »
      pour enregistrer sans attendre. Bouton « Annuler » quelques secondes après.
   ✋ « Relecture » : on relit et on valide soi-même.
   🔊 Ma journée : lecture à voix haute des tâches du jour (pratique en voiture). */

'use strict';

(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ANDROID = /Android/i.test(navigator.userAgent);
  const CLE_PAROLE = 'taches-chantier-parole';
  const CLE_AUTO = 'taches-chantier-auto';
  const SILENCE_MS = 2000;      // fin de dictée après ce silence (ordinateur)
  const ATTENTE_AUTO_S = 2;     // secondes avant l'enregistrement automatique

  const dlg = document.getElementById('dlg-voix');
  const zoneTexte = document.getElementById('v-texte');
  const apercu = document.getElementById('v-apercu');
  const btnMicro = document.getElementById('v-micro');
  const etat = document.getElementById('v-etat');
  const aide = document.getElementById('v-aide');
  const btnValider = document.getElementById('v-valider');
  const btnParole = document.getElementById('v-parole');
  const btnMode = document.getElementById('v-mode');

  function lire(cle, defaut) { try { const v = localStorage.getItem(cle); return v == null ? defaut : v; } catch (e) { return defaut; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (e) {} }

  let parole = lire(CLE_PAROLE, 'oui') !== 'non';
  let auto = lire(CLE_AUTO, 'oui') !== 'non';

  let rec = null;
  let ecoute = false;
  let mode = 'dictee';       // 'dictee' ou 'reponse' (réponse à une question)
  let base = '';             // texte déjà présent quand on relance le micro
  let brouillons = [];       // tâches comprises
  let modifs = {};           // corrections à la main, par numéro de carte
  let minuterie = null;      // analyse pendant la frappe
  let silence = null;        // détection de fin de dictée
  let compte = null;         // compte à rebours de l'enregistrement auto
  let action = '';           // commande vocale entendue : 'enregistrer' | 'annuler'
  let pilote = true;         // l'appli décide seule pour cette dictée (coupé si on touche)
  let question = null;       // { i: numéro de carte } quand on attend une réponse

  function lexiqueActuel() {
    return (typeof lexique !== 'undefined') ? lexique : null; // défini dans app.js
  }

  // Chantiers des tâches récentes (pour trancher « Cotta » ou « Néolia » tout seuls)
  function historique() {
    const limite = new Date(Date.now() - 14 * 86400000).toISOString(); // 14 derniers jours
    return taches.filter(function (t) { return t.site && (t.modif || t.cree || '') >= limite; })
      .sort(function (a, b) { return (b.modif || b.cree || '') < (a.modif || a.cree || '') ? -1 : 1; })
      .map(function (t) { return t.site; });
  }

  /* ---------- Petits outils ---------- */

  function toast(texte, bouton, surClic) {
    const el = document.getElementById('toast');
    el.innerHTML = '';
    el.appendChild(document.createTextNode(texte));
    if (bouton) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-bouton';
      b.textContent = bouton;
      b.addEventListener('click', function () { el.classList.remove('visible'); surClic(); });
      el.appendChild(b);
    }
    el.classList.toggle('avec-bouton', !!bouton);
    el.classList.add('visible');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('visible'); }, bouton ? 8000 : 3500);
  }

  function voixFrancaise() {
    if (!('speechSynthesis' in window)) return null;
    const voix = speechSynthesis.getVoices().filter(function (v) { return /^fr/i.test(v.lang); });
    return voix.find(function (v) { return /fr[-_]FR/i.test(v.lang); }) || voix[0] || null;
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = function () {};

  // Lit plusieurs phrases à la suite ; « ensuite » est appelé à la fin de la lecture
  function dire(phrases, ensuite) {
    const liste = [].concat(phrases).filter(Boolean);
    if (!('speechSynthesis' in window) || !liste.length) { if (ensuite) ensuite(); return; }
    speechSynthesis.cancel();
    const v = voixFrancaise();
    let fini = false;
    function fin() { if (!fini) { fini = true; if (ensuite) ensuite(); } }
    liste.forEach(function (p, i) {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = 'fr-FR';
      if (v) u.voice = v;
      u.rate = 1.05;
      if (i === liste.length - 1) { u.onend = fin; u.onerror = fin; }
      speechSynthesis.speak(u);
    });
    // Filet de sécurité si le navigateur ne signale pas la fin de lecture
    if (ensuite) setTimeout(fin, 1500 + liste.join(' ').length * 75);
  }

  function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }

  /* ---------- Fiches de relecture ---------- */

  const OPTIONS_PRIO = [['haute', '🔴 Haute'], ['normale', '🟡 Normale'], ['basse', '🟢 Basse']];
  const OPTIONS_CAT = Object.keys(CATEGORIES).map(function (k) { return [k, CATEGORIES[k]]; });

  function options(liste, valeur) {
    return liste.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === valeur ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
  }

  function effective(i) {
    return Object.assign({}, brouillons[i], modifs[i] || {});
  }

  function doute(t) {
    return !t.retire && !t.site && !t.siteChoisi && t.candidats && t.candidats.length > 0;
  }

  function infoChantier(t) {
    const ch = AnalyseDictee.chantierParNom(t.site, lexiqueActuel());
    if (!ch) return '';
    const morceaux = [];
    if (ch.adresse) morceaux.push('📍 ' + echapper(ch.adresse));
    (ch.titulaires || []).slice(0, 3).forEach(function (a) {
      morceaux.push('👤 ' + echapper(a.nom) + (a.horaires ? ' · ' + echapper(a.horaires) : ''));
    });
    return morceaux.length ? '<p class="v-info">' + morceaux.join('<br>') + '</p>' : '';
  }

  const RAISONS = {
    'indices': 'chantier déduit de la phrase',
    'historique': 'chantier de vos dernières tâches',
    'demain-heure-passee': 'heure passée → demain',
    'heure-apres-midi': 'heure de l\'après-midi'
  };

  function carteVoix(i) {
    const t = effective(i);
    if (t.retire) return '';
    let choix = '';
    if (doute(t)) {
      choix = '<div class="v-choix"><span>' + (question && question.i === i ? '❓ ' : '') + 'Quel chantier ?</span>' +
        t.candidats.slice(0, 12).map(function (n) {
          return '<button type="button" class="v-puce" data-site="' + echapper(n) + '">' + echapper(n) + '</button>';
        }).join('') +
        '<button type="button" class="v-puce v-puce-aucun" data-site="">Aucun</button></div>';
    }
    const decisions = [];
    if (t.site && t.siteDeduit && !(modifs[i] && modifs[i].site)) decisions.push(RAISONS[t.siteDeduit]);
    (t.logique || []).forEach(function (l) { if (RAISONS[l]) decisions.push(RAISONS[l]); });
    const agents = (t.agents && t.agents.length)
      ? '<p class="v-info">👥 ' + t.agents.map(echapper).join(', ') + '</p>' : '';
    return '<div class="v-carte prio-' + t.priorite + (question && question.i === i ? ' v-question' : '') + '" data-i="' + i + '">' +
      '<div class="v-ligne">' +
        '<input class="v-titre" data-champ="titre" value="' + echapper(t.titre) + '" aria-label="Titre">' +
        '<button type="button" class="v-retirer" title="Retirer cette tâche">✕</button>' +
      '</div>' +
      '<div class="v-champs">' +
        '<input type="date" data-champ="date" value="' + echapper(t.date) + '" aria-label="Date">' +
        '<input type="time" data-champ="heure" value="' + echapper(t.heure) + '" aria-label="Heure">' +
        '<select data-champ="priorite" aria-label="Priorité">' + options(OPTIONS_PRIO, t.priorite) + '</select>' +
        '<select data-champ="categorie" aria-label="Catégorie">' + options(OPTIONS_CAT, t.categorie) + '</select>' +
      '</div>' +
      '<input class="v-site" data-champ="site" list="liste-chantiers" autocomplete="off" placeholder="📍 Chantier (facultatif)" value="' + echapper(t.site) + '">' +
      choix + '<div class="v-infos">' + infoChantier(t) + agents + '</div>' +
      (decisions.length ? '<p class="v-info v-decision">🧠 ' + decisions.map(echapper).join(' · ') + '</p>' : '') +
      (t.duree ? '<p class="v-info">⏱ ' + echapper(t.duree) + ' min</p>' : '') +
      (t.notes ? '<p class="v-info">📝 ' + echapper(t.notes) + '</p>' : '') +
    '</div>';
  }

  function aValider() {
    return brouillons.map(function (_, i) { return effective(i); })
      .filter(function (t) { return !t.retire && t.titre && t.titre.trim(); });
  }

  function majBoutonValider(secondes) {
    const n = aValider().length;
    btnValider.disabled = n === 0;
    btnValider.textContent = n === 0 ? 'Ajouter' :
      (secondes != null ? 'Enregistrer maintenant (' + secondes + ')' : 'Ajouter ' + pluriel(n, 'tâche'));
  }

  function afficherApercu() {
    aide.hidden = !!zoneTexte.value.trim() && !!SR;
    if (!brouillons.length) {
      apercu.innerHTML = zoneTexte.value.trim()
        ? '<p class="aide">Je n\'ai pas encore compris de tâche… continuez !</p>' : '';
    } else {
      apercu.innerHTML = '<p class="v-compris">✨ J\'ai compris ' + pluriel(aValider().length, 'tâche') + ' :</p>' +
        brouillons.map(function (_, i) { return carteVoix(i); }).join('');
    }
    majBoutonValider();
  }

  function analyserTexte() {
    const cmd = AnalyseDictee.commandeFinale(zoneTexte.value);
    brouillons = AnalyseDictee.analyser(cmd.texte, {
      lexique: lexiqueActuel(), historique: historique(), maintenant: Date.now()
    });
    afficherApercu();
    return cmd.action;
  }

  /* ---------- Reprise en main : dès qu'on touche une fiche, l'appli n'enregistre plus seule ---------- */

  function reprendreLaMain() {
    if (!pilote && !compte) return;
    pilote = false;
    annulerCompte();
    majMicro();
  }

  function surSaisie(e) {
    const champ = e.target.dataset ? e.target.dataset.champ : null;
    const carte = e.target.closest ? e.target.closest('.v-carte') : null;
    if (!champ || !carte) return;
    reprendreLaMain();
    const i = Number(carte.dataset.i);
    modifs[i] = modifs[i] || {};
    modifs[i][champ] = e.target.value;
    if (champ === 'site') modifs[i].siteChoisi = true;
    if (champ === 'priorite') carte.className = 'v-carte prio-' + e.target.value;
    if (champ === 'site') {
      const infos = carte.querySelector('.v-infos');
      if (infos) infos.innerHTML = infoChantier(effective(i));
    }
    majBoutonValider();
  }
  apercu.addEventListener('input', surSaisie);
  apercu.addEventListener('change', surSaisie);
  apercu.addEventListener('focusin', function (e) {
    if (e.target.matches('input, select')) reprendreLaMain();
  });

  apercu.addEventListener('click', function (e) {
    const carte = e.target.closest('.v-carte');
    if (!carte) return;
    const i = Number(carte.dataset.i);
    if (e.target.closest('.v-retirer')) {
      reprendreLaMain();
      modifs[i] = Object.assign(modifs[i] || {}, { retire: true });
      afficherApercu();
    } else if (e.target.closest('.v-puce')) {
      // Répondre à la question en touchant : le pilote auto continue
      choisirChantier(i, e.target.dataset.site);
    }
  });

  zoneTexte.addEventListener('input', function () {
    reprendreLaMain();
    clearTimeout(minuterie);
    minuterie = setTimeout(analyserTexte, 400);
  });

  /* ---------- Micro ---------- */

  function majMicro(texte) {
    btnMicro.classList.toggle('actif', ecoute);
    if (texte) { etat.textContent = texte; return; }
    if (ecoute) {
      etat.textContent = mode === 'reponse' ? 'Je vous écoute… (dites le chantier)' :
        (auto && pilote ? 'Je vous écoute… je note dès que vous vous taisez' : 'Je vous écoute… (appuyez pour arrêter)');
    } else {
      etat.textContent = zoneTexte.value.trim() ? '🎤 Appuyez pour continuer à parler' : '🎤 Appuyez pour parler';
    }
  }

  function arreter() {
    clearTimeout(silence);
    if (rec && ecoute) { try { rec.stop(); } catch (e) {} }
    ecoute = false;
    majMicro();
  }

  function ecouter(pour) {
    if (!SR) { zoneTexte.focus(); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    annulerCompte();
    mode = pour || 'dictee';
    rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = !ANDROID && mode === 'dictee'; // Android : une phrase à la fois
    rec.maxAlternatives = 1;
    base = zoneTexte.value.trim();
    let entendu = '';

    rec.onresult = function (e) {
      let tout = '', final = true;
      for (let i = 0; i < e.results.length; i++) {
        tout += ' ' + e.results[i][0].transcript.trim();
        if (!e.results[i].isFinal) final = false;
      }
      entendu = tout.trim();
      if (mode === 'dictee') {
        zoneTexte.value = ((base ? base + ' ' : '') + entendu).replace(/\s+/g, ' ');
        action = analyserTexte();
        if (action && final) { arreter(); finDeDictee(); return; }
      } else {
        majMicro('« ' + entendu + ' »');
      }
      // Fin de dictée quand on se tait (pilote auto)
      clearTimeout(silence);
      if (auto && pilote) silence = setTimeout(function () { if (ecoute) { try { rec.stop(); } catch (er) {} } }, SILENCE_MS);
    };
    rec.onerror = function (e) {
      ecoute = false;
      clearTimeout(silence);
      const messages = {
        'not-allowed': '🔒 Micro refusé : autorisez le micro pour ce site, puis réessayez.',
        'service-not-allowed': '🔒 Micro refusé : autorisez le micro pour ce site, puis réessayez.',
        'no-speech': mode === 'reponse' ? 'Je n\'ai rien entendu — touchez le chantier voulu.' : "Je n'ai rien entendu — appuyez et parlez.",
        'audio-capture': 'Aucun micro trouvé sur cet appareil.',
        'network': 'La dictée a besoin d\'internet — vous pouvez écrire ci-dessous.'
      };
      majMicro(messages[e.error] || '🎤 Appuyez pour parler');
      if (mode === 'reponse' && e.error === 'no-speech') pasDeReponse();
    };
    rec.onend = function () {
      clearTimeout(silence);
      if (!ecoute) return; // arrêt déjà traité
      ecoute = false;
      majMicro();
      if (mode === 'reponse') surReponse(entendu); else finDeDictee();
    };
    try {
      rec.start();
      ecoute = true;
      majMicro();
    } catch (err) {
      ecoute = false;
      majMicro('🎤 Appuyez pour parler');
    }
  }

  btnMicro.addEventListener('click', function () {
    if (ecoute) { arreter(); if (mode === 'dictee') finDeDictee(); return; }
    question = null;
    ecouter('dictee');
  });

  /* ---------- Le pilote auto : décider seul, ne demander qu'en cas de vrai doute ---------- */

  function annulerCompte() {
    if (compte) { clearInterval(compte); compte = null; majBoutonValider(); }
  }

  function finDeDictee() {
    if (action === 'annuler') {
      dlg.close();
      toast('🗑️ Dictée annulée');
      if (parole) dire('Dictée annulée.');
      return;
    }
    if (!auto || !pilote) return; // mode relecture : on attend le bouton
    const liste = aValider();
    if (!liste.length) {
      if (zoneTexte.value.trim()) {
        majMicro("🤔 Je n'ai pas compris de tâche — appuyez pour répéter");
        if (parole) dire("Je n'ai pas compris. Pouvez-vous répéter ?");
      }
      return;
    }
    // Un vrai doute ? → une seule question, précise
    for (let i = 0; i < brouillons.length; i++) {
      if (doute(effective(i))) { poserQuestion(i); return; }
    }
    // Tout est clair → on enregistre (tout de suite si « enregistre » a été dit)
    lancerCompte(action === 'enregistrer' ? 0 : ATTENTE_AUTO_S);
  }

  function nomCourt(nom, famille) {
    let n = nom.replace(/\s*\(.*\)/, '');
    if (famille) n = n.replace(new RegExp('^' + famille + '\\s*-?\\s*', 'i'), '');
    return n;
  }

  // Pas de réponse (en voiture…) : on ne perd pas la tâche, elle part sans chantier précis
  function pasDeReponse() {
    if (!question || !auto || !pilote) return;
    const i = question.i;
    majMicro('⏭️ Pas de réponse : j\'enregistre sans chantier précis');
    if (parole) dire('Pas de réponse, je la note sans chantier précis.', function () {
      if (question && question.i === i) choisirChantier(i, '');
    });
    else choisirChantier(i, '');
  }

  function poserQuestion(i, relance) {
    question = { i: i, essais: relance ? 1 : 0 };
    afficherApercu();
    const t = effective(i);
    const carte = apercu.querySelector('.v-carte[data-i="' + i + '"]');
    if (carte) carte.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Mot commun (ex. « NEOLIA ») retiré pour une question courte
    const premiers = t.candidats.map(function (n) { return n.split(/[\s-]+/)[0]; });
    const famille = premiers.every(function (p) { return p.toLowerCase() === premiers[0].toLowerCase(); }) ? premiers[0] : '';
    const q = 'Pour « ' + t.titre + ' », quel chantier ' + (famille ? famille.charAt(0) + famille.slice(1).toLowerCase() + ' ' : '') + '?';
    majMicro('❓ ' + q);
    const phrases = relance ? ["Je n'ai pas compris. Quel chantier ?"] : [q];
    if (relance) {
      // question courte
    } else if (t.candidats.length <= 4) {
      phrases.push(t.candidats.map(function (n) { return nomCourt(n, famille); }).join(', ou ') + ' ?');
    } else {
      phrases.push('Dites le nom, ou touchez-le à l\'écran.');
    }
    if (parole) dire(phrases, function () { if (dlg.open && question) ecouter('reponse'); });
    else if (SR) ecouter('reponse');
  }

  function surReponse(texte) {
    if (!question) return;
    const i = question.i;
    const t = effective(i);
    const cmd = AnalyseDictee.commandeFinale(texte);
    if (cmd.action === 'annuler') { action = 'annuler'; question = null; finDeDictee(); return; }
    const choix = AnalyseDictee.choisirParmi(cmd.texte, t.candidats, lexiqueActuel());
    if (choix === null) {
      if (!question.essais && cmd.texte) { poserQuestion(i, true); return; } // on redemande une fois
      pasDeReponse();
      return;
    }
    choisirChantier(i, choix);
  }

  function choisirChantier(i, site) {
    modifs[i] = Object.assign(modifs[i] || {}, { site: site, siteChoisi: true });
    question = null;
    afficherApercu();
    if (auto && pilote) finDeDictee(); // question suivante, ou enregistrement
  }

  function lancerCompte(secondes) {
    annulerCompte();
    if (secondes <= 0) { enregistrer(); return; }
    let reste = secondes;
    majMicro('✅ Compris — j\'enregistre… (touchez une fiche pour corriger)');
    majBoutonValider(reste);
    compte = setInterval(function () {
      reste -= 1;
      if (reste <= 0) { annulerCompte(); enregistrer(); }
      else majBoutonValider(reste);
    }, 1000);
  }

  /* ---------- Enregistrement ---------- */

  function enregistrer() {
    arreter();
    annulerCompte();
    const liste = aValider().map(function (t) {
      return {
        titre: t.titre.trim(), date: t.date, heure: t.heure, duree: t.duree,
        priorite: t.priorite, categorie: t.categorie, site: (t.site || '').trim(),
        notes: t.notes || '',
        siteDeduit: (t.siteChoisi && t.site) ? 'choisi' : (t.siteDeduit || '') // pour le redire à l'oral
      };
    });
    if (!liste.length) return;
    const ids = ajouterTaches(liste);
    dlg.close();
    toast('✅ ' + pluriel(liste.length, 'tâche') + ' enregistrée' + (liste.length > 1 ? 's' : ''), 'Annuler', function () {
      retirerTaches(ids);
      toast('↩️ Annulé');
      if (parole) dire('Annulé.');
    });
    if (parole) {
      const auj = aujourdhui();
      dire([liste.length === 1 ? "C'est noté." : "C'est noté, " + liste.length + ' tâches.']
        .concat(liste.map(function (t) { return AnalyseDictee.resumer(t, auj) + '.'; })));
    }
  }

  btnValider.addEventListener('click', enregistrer);

  /* ---------- Ouverture ---------- */

  function majBoutonsEntete() {
    btnParole.textContent = parole ? '🔊' : '🔇';
    btnMode.textContent = auto ? '⚡ Auto' : '✋ Relecture';
    btnMode.classList.toggle('actif', auto);
    btnMode.title = auto ? 'Pilote auto : j\'enregistre seule, je ne demande qu\'en cas de doute'
                         : 'Relecture : vous validez chaque dictée';
  }

  function ouvrir(lancerMicro) {
    zoneTexte.value = '';
    brouillons = [];
    modifs = {};
    action = '';
    question = null;
    pilote = true;
    afficherApercu();
    majBoutonsEntete();
    if (!SR) {
      btnMicro.hidden = true;
      pilote = false; // dictée au clavier : on ne sait pas quand elle finit → validation au bouton
      aide.innerHTML = 'Sur ce téléphone, appuyez sur le <strong>micro 🎙️ du clavier</strong> ' +
        'et dictez dans la zone ci-dessous. Je synthétise au fur et à mesure. ' +
        'Dites <strong>puis</strong> entre deux tâches.';
    }
    dlg.showModal();
    if (SR && lancerMicro) ecouter('dictee'); else if (!SR) zoneTexte.focus();
    majMicro();
  }

  dlg.addEventListener('close', function () {
    question = null;
    arreter();
    annulerCompte();
    clearTimeout(minuterie);
  });

  document.getElementById('btn-dicter').addEventListener('click', function () { ouvrir(true); });
  document.getElementById('v-annuler').addEventListener('click', function () { dlg.close(); });

  btnParole.addEventListener('click', function () {
    parole = !parole;
    ecrire(CLE_PAROLE, parole ? 'oui' : 'non');
    majBoutonsEntete();
    toast(parole ? '🔊 Je vous réponds à voix haute' : '🔇 Réponses à voix haute coupées');
  });

  btnMode.addEventListener('click', function () {
    auto = !auto;
    ecrire(CLE_AUTO, auto ? 'oui' : 'non');
    majBoutonsEntete();
    if (!auto) reprendreLaMain();
    toast(auto ? '⚡ Pilote auto : j\'enregistre seule, je ne demande qu\'en cas de doute'
               : '✋ Relecture : vous validez chaque dictée');
  });

  /* ---------- 🔊 Ma journée ---------- */

  function parHeure(a, b) {
    return (a.heure || '99:99') < (b.heure || '99:99') ? -1 : 1;
  }

  function phrasesJournee() {
    const auj = aujourdhui();
    const dem = dansNJours(1);
    const actives = taches.filter(function (t) { return !t.fait && !t.archive; });
    const duJour = actives.filter(function (t) { return t.date === auj; }).sort(parHeure);
    const retard = actives.filter(function (t) { return t.date && t.date < auj; });
    const demain = actives.filter(function (t) { return t.date === dem; }).sort(parHeure);
    const h = new Date().getHours();
    const p = [(h >= 18 ? 'Bonsoir' : 'Bonjour') + ' Joce. Nous sommes ' +
      new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + '.'];

    if (!duJour.length) {
      p.push("Rien de prévu aujourd'hui.");
    } else {
      const urg = duJour.filter(function (t) { return t.priorite === 'haute'; }).length;
      p.push('Vous avez ' + pluriel(duJour.length, 'tâche') + " aujourd'hui" +
        (urg ? ', dont ' + urg + ' urgente' + (urg > 1 ? 's' : '') : '') + '.');
      duJour.slice(0, 8).forEach(function (t, i) {
        p.push((i === 0 ? "D'abord : " : 'Puis : ') + t.titre +
          (t.heure ? ', à ' + AnalyseDictee.heureParlee(t.heure) : '') +
          (t.priorite === 'haute' ? ', urgent' : '') + '.');
      });
      if (duJour.length > 8) p.push('Et ' + pluriel(duJour.length - 8, 'autre tâche') + '.');
    }
    if (retard.length) {
      p.push((retard.length > 1 ? retard.length + ' tâches sont en retard : ' : 'Une tâche est en retard : ') +
        retard.slice(0, 5).map(function (t) { return t.titre; }).join(', ') +
        (retard.length > 5 ? ', et ' + (retard.length - 5) + ' autres' : '') + '.');
    }
    if (demain.length) {
      p.push('Demain : ' + demain.slice(0, 3).map(function (t) {
        return t.titre + (t.heure ? ' à ' + AnalyseDictee.heureParlee(t.heure) : '');
      }).join(', ') + (demain.length > 3 ? ', et ' + (demain.length - 3) + ' autres' : '') + '.');
    }
    p.push('Bonne journée !');
    return p;
  }

  document.getElementById('btn-journee').addEventListener('click', function () {
    if (!('speechSynthesis' in window)) { toast('La lecture à voix haute n\'est pas disponible ici.'); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); toast('🔇 Lecture arrêtée'); return; }
    dire(phrasesJournee());
    toast('🔊 Lecture de votre journée — touchez à nouveau pour arrêter');
  });

  /* ---------- Raccourci « Dicter une tâche » (appui long sur l'icône) ---------- */

  if (new URLSearchParams(location.search).has('dicter')) {
    history.replaceState(null, '', location.pathname);
    setTimeout(function () { ouvrir(true); }, 300);
  }

  // Pour les tests
  window.__dictee = { phrasesJournee: phrasesJournee, analyserTexte: analyserTexte };
})();
