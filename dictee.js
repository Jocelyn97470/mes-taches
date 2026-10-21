/* ===== Mes Tâches Chantier — dictée vocale et lecture de la journée =====
   🎤 : on parle, l'appli écrit et SYNTHÉTISE en direct (titre, date, heure,
        priorité, catégorie, chantier), on relit, on valide.
   🔊 Ma journée : l'appli lit à voix haute les tâches du jour (pratique en voiture). */

'use strict';

(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ANDROID = /Android/i.test(navigator.userAgent);
  const CLE_PAROLE = 'taches-chantier-parole';

  const dlg = document.getElementById('dlg-voix');
  const zoneTexte = document.getElementById('v-texte');
  const apercu = document.getElementById('v-apercu');
  const btnMicro = document.getElementById('v-micro');
  const etat = document.getElementById('v-etat');
  const aide = document.getElementById('v-aide');
  const btnValider = document.getElementById('v-valider');
  const btnParole = document.getElementById('v-parole');

  let parole = true;
  try { parole = localStorage.getItem(CLE_PAROLE) !== 'non'; } catch (e) {}

  let rec = null;
  let ecoute = false;
  let base = '';          // texte déjà présent quand on relance le micro
  let brouillons = [];    // tâches comprises
  let modifs = {};        // corrections faites à la main, par numéro de carte
  let minuterie = null;

  function lexiqueActuel() {
    return (typeof lexique !== 'undefined') ? lexique : null; // défini dans app.js
  }

  /* ---------- Petits outils ---------- */

  function toast(texte) {
    const el = document.getElementById('toast');
    el.textContent = texte;
    el.classList.add('visible');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('visible'); }, 3500);
  }

  function voixFrancaise() {
    if (!('speechSynthesis' in window)) return null;
    const voix = speechSynthesis.getVoices().filter(function (v) { return /^fr/i.test(v.lang); });
    return voix.find(function (v) { return /fr[-_]FR/i.test(v.lang); }) || voix[0] || null;
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = function () {};

  // Lit plusieurs phrases à la suite (une phrase par énoncé : évite les coupures sur Android)
  function dire(phrases) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const v = voixFrancaise();
    [].concat(phrases).filter(Boolean).forEach(function (p) {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = 'fr-FR';
      if (v) u.voice = v;
      u.rate = 1.05;
      speechSynthesis.speak(u);
    });
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

  function carteVoix(i) {
    const t = effective(i);
    if (t.retire) return '';
    let choix = '';
    if (!t.site && t.candidats && t.candidats.length) {
      choix = '<div class="v-choix"><span>Quel chantier ?</span>' +
        t.candidats.slice(0, 12).map(function (n) {
          return '<button type="button" class="v-puce" data-site="' + echapper(n) + '">' + echapper(n) + '</button>';
        }).join('') + '</div>';
    }
    const agents = (t.agents && t.agents.length)
      ? '<p class="v-info">👥 ' + t.agents.map(echapper).join(', ') + '</p>' : '';
    return '<div class="v-carte prio-' + t.priorite + '" data-i="' + i + '">' +
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
      (t.duree ? '<p class="v-info">⏱ ' + echapper(t.duree) + ' min</p>' : '') +
      (t.notes ? '<p class="v-info">📝 ' + echapper(t.notes) + '</p>' : '') +
    '</div>';
  }

  function aValider() {
    return brouillons.map(function (_, i) { return effective(i); })
      .filter(function (t) { return !t.retire && t.titre && t.titre.trim(); });
  }

  function majBoutonValider() {
    const n = aValider().length;
    btnValider.disabled = n === 0;
    btnValider.textContent = n === 0 ? 'Ajouter' : 'Ajouter ' + pluriel(n, 'tâche');
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
    brouillons = AnalyseDictee.analyser(zoneTexte.value, { lexique: lexiqueActuel() });
    afficherApercu();
  }

  // Corrections à la main dans les fiches
  function surSaisie(e) {
    const champ = e.target.dataset ? e.target.dataset.champ : null;
    const carte = e.target.closest ? e.target.closest('.v-carte') : null;
    if (!champ || !carte) return;
    const i = Number(carte.dataset.i);
    modifs[i] = modifs[i] || {};
    modifs[i][champ] = e.target.value;
    if (champ === 'priorite') carte.className = 'v-carte prio-' + e.target.value;
    if (champ === 'site') {
      const infos = carte.querySelector('.v-infos');
      if (infos) infos.innerHTML = infoChantier(effective(i));
    }
    majBoutonValider();
  }
  apercu.addEventListener('input', surSaisie);
  apercu.addEventListener('change', surSaisie);
  apercu.addEventListener('click', function (e) {
    const carte = e.target.closest('.v-carte');
    if (!carte) return;
    const i = Number(carte.dataset.i);
    if (e.target.closest('.v-retirer')) {
      modifs[i] = Object.assign(modifs[i] || {}, { retire: true });
      afficherApercu();
    } else if (e.target.closest('.v-puce')) {
      modifs[i] = Object.assign(modifs[i] || {}, { site: e.target.dataset.site });
      afficherApercu();
    }
  });

  zoneTexte.addEventListener('input', function () {
    clearTimeout(minuterie);
    minuterie = setTimeout(analyserTexte, 400);
  });

  /* ---------- Micro ---------- */

  function majMicro(texte) {
    btnMicro.classList.toggle('actif', ecoute);
    etat.textContent = texte || (ecoute ? 'Je vous écoute… (appuyez pour arrêter)' :
      (zoneTexte.value.trim() ? '🎤 Appuyez pour continuer à parler' : '🎤 Appuyez pour parler'));
  }

  function arreter() {
    if (rec && ecoute) { try { rec.stop(); } catch (e) {} }
    ecoute = false;
    majMicro();
  }

  function demarrer() {
    if (!SR) {
      zoneTexte.focus();
      return;
    }
    if (ecoute) { arreter(); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();

    rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = !ANDROID; // Android : une phrase à la fois (sinon le texte se répète)
    rec.maxAlternatives = 1;
    base = zoneTexte.value.trim();

    rec.onresult = function (e) {
      let tout = '';
      for (let i = 0; i < e.results.length; i++) tout += ' ' + e.results[i][0].transcript.trim();
      zoneTexte.value = ((base ? base + ' ' : '') + tout.trim()).replace(/\s+/g, ' ');
      analyserTexte();
    };
    rec.onerror = function (e) {
      ecoute = false;
      const messages = {
        'not-allowed': '🔒 Micro refusé : autorisez le micro pour ce site, puis réessayez.',
        'service-not-allowed': '🔒 Micro refusé : autorisez le micro pour ce site, puis réessayez.',
        'no-speech': "Je n'ai rien entendu — appuyez et parlez.",
        'audio-capture': 'Aucun micro trouvé sur cet appareil.',
        'network': 'La dictée a besoin d\'internet — vous pouvez écrire ci-dessous.'
      };
      majMicro(messages[e.error] || '🎤 Appuyez pour parler');
    };
    rec.onend = function () {
      if (!ecoute) return;
      ecoute = false;
      majMicro();
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

  btnMicro.addEventListener('click', demarrer);

  /* ---------- Ouverture / validation ---------- */

  function ouvrir(lancerMicro) {
    zoneTexte.value = '';
    brouillons = [];
    modifs = {};
    afficherApercu();
    btnParole.textContent = parole ? '🔊' : '🔇';
    if (!SR) {
      btnMicro.hidden = true;
      aide.innerHTML = 'Sur ce téléphone, appuyez sur le <strong>micro 🎙️ du clavier</strong> ' +
        'et dictez dans la zone ci-dessous. Je synthétise au fur et à mesure. ' +
        'Dites <strong>puis</strong> entre deux tâches.';
    }
    dlg.showModal();
    if (SR && lancerMicro) demarrer(); else if (!SR) zoneTexte.focus();
    majMicro();
  }

  dlg.addEventListener('close', function () {
    arreter();
    clearTimeout(minuterie);
  });

  document.getElementById('btn-dicter').addEventListener('click', function () { ouvrir(true); });
  document.getElementById('v-annuler').addEventListener('click', function () { dlg.close(); });

  btnParole.addEventListener('click', function () {
    parole = !parole;
    try { localStorage.setItem(CLE_PAROLE, parole ? 'oui' : 'non'); } catch (e) {}
    btnParole.textContent = parole ? '🔊' : '🔇';
    toast(parole ? '🔊 Confirmation à voix haute activée' : '🔇 Confirmation à voix haute coupée');
  });

  btnValider.addEventListener('click', function () {
    arreter();
    const liste = aValider().map(function (t) {
      return {
        titre: t.titre.trim(), date: t.date, heure: t.heure, duree: t.duree,
        priorite: t.priorite, categorie: t.categorie, site: (t.site || '').trim(),
        notes: t.notes || ''
      };
    });
    if (!liste.length) return;
    ajouterTaches(liste);
    dlg.close();
    toast('✅ ' + pluriel(liste.length, 'tâche') + ' ajoutée' + (liste.length > 1 ? 's' : ''));
    if (parole) {
      const auj = aujourdhui();
      dire([liste.length === 1 ? "C'est noté." : "C'est noté, " + liste.length + ' tâches.']
        .concat(liste.map(function (t) { return AnalyseDictee.resumer(t, auj) + '.'; })));
    }
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
