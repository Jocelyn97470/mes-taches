/* ===== Mes Tâches Chantier — logique de l'application =====
   Données enregistrées dans le navigateur (localStorage) ET synchronisées
   entre appareils via un dépôt GitHub privé (voir LISEZMOI.md).
   Bouton 📅 : ouvre Google Agenda avec l'événement pré-rempli. */

'use strict';

const CLE_STOCKAGE = 'taches-chantier-v1';
const CLE_SYNC = 'taches-chantier-sync';
const DEPOT_DEFAUT = 'Jocelyn97470/mes-taches-data';

const CATEGORIES = {
  chantier: '🧹 Chantier',
  equipe:   '👥 Équipe',
  qualite:  '✅ Contrôle qualité',
  materiel: '🧴 Produits / Matériel',
  client:   '🤝 Client',
  admin:    '📋 Administratif'
};

let taches = [];
let supprimees = {}; // { id: date ISO de suppression } — pour la synchro
let filtreActuel = 'auj';
let idEnCours = null; // null = nouvelle tâche, sinon id de la tâche modifiée

/* ---------- Stockage local ---------- */

function charger() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
    if (Array.isArray(brut)) {           // ancien format (liste simple)
      taches = brut;
    } else if (brut && typeof brut === 'object') {
      taches = Array.isArray(brut.taches) ? brut.taches : [];
      supprimees = (brut.supprimees && typeof brut.supprimees === 'object') ? brut.supprimees : {};
    }
  } catch (e) { /* stockage illisible : on repart de zéro */ }
}

function sauver() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ taches: taches, supprimees: supprimees }));
  planifierSync();
}

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function maintenant() {
  return new Date().toISOString();
}

/* ---------- Dates ---------- */

function aujourdhui() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function dansNJours(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function dateFr(iso) {
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ---------- Lien Google Agenda ---------- */

function formatGcal(d) {
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') + '00';
}

function lienGoogleAgenda(t) {
  const p = new URLSearchParams();
  p.set('action', 'TEMPLATE');
  p.set('text', t.titre + (t.site ? ' — ' + t.site : ''));

  if (t.date && t.heure) {
    const debut = new Date(t.date + 'T' + t.heure);
    const fin = new Date(debut.getTime() + (Number(t.duree) || 60) * 60000);
    p.set('dates', formatGcal(debut) + '/' + formatGcal(fin));
  } else if (t.date) {
    // Journée entière : Google attend date de début / date du lendemain
    const lendemain = new Date(t.date + 'T00:00:00');
    lendemain.setDate(lendemain.getDate() + 1);
    const fin = lendemain.getFullYear() +
      String(lendemain.getMonth() + 1).padStart(2, '0') +
      String(lendemain.getDate()).padStart(2, '0');
    p.set('dates', t.date.replace(/-/g, '') + '/' + fin);
  }

  const details = [];
  details.push('Catégorie : ' + (CATEGORIES[t.categorie] || t.categorie));
  details.push('Priorité : ' + t.priorite);
  if (t.notes) details.push('\n' + t.notes);
  details.push('\n(Créé avec Mes Tâches Chantier)');
  p.set('details', details.join('\n'));

  if (t.site) p.set('location', t.site);

  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/* ---------- Affichage ---------- */

function echapper(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function correspondAuFiltre(t) {
  const auj = aujourdhui();
  if (filtreActuel === 'archives') return !!t.archive;
  if (t.archive) return false;
  switch (filtreActuel) {
    case 'auj':     return !t.fait && (!t.date || t.date <= auj);
    case 'semaine': return !t.fait && (!t.date || t.date <= dansNJours(7));
    case 'toutes':  return !t.fait;
    case 'faites':  return !!t.fait;
    default:        return true;
  }
}

function carteHTML(t) {
  const enRetard = !t.fait && !t.archive && t.date && t.date < aujourdhui();
  const classes = ['tache', 'prio-' + (t.priorite || 'normale')];
  if (t.fait) classes.push('faite');
  if (t.archive) classes.push('archivee');
  if (enRetard) classes.push('retard');

  let badges = '<span class="badge">' + (CATEGORIES[t.categorie] || echapper(t.categorie)) + '</span>';
  if (t.site) badges += '<span class="badge">📍 ' + echapper(t.site) + '</span>';
  if (t.date) {
    badges += '<span class="badge' + (enRetard ? ' badge-retard' : '') + '">🗓 ' +
      dateFr(t.date) + (t.heure ? ' · ' + t.heure : '') +
      (enRetard ? ' — en retard !' : '') + '</span>';
  }

  let actions;
  if (t.archive) {
    actions =
      '<button class="btn-restaurer" title="Remettre dans Terminées">↩️</button>' +
      '<button class="btn-suppr" title="Supprimer définitivement">🗑️</button>';
  } else {
    actions =
      '<a class="btn-gcal" href="' + lienGoogleAgenda(t) + '" target="_blank" rel="noopener" title="Ajouter à Google Agenda">📅</a>' +
      '<button class="btn-note" title="Ajouter / modifier la note">📝</button>' +
      '<button class="btn-modif" title="Modifier">✏️</button>' +
      (t.fait ? '<button class="btn-archiver" title="Archiver">📦</button>' : '') +
      '<button class="btn-suppr" title="Supprimer">🗑️</button>';
  }

  return '<article class="' + classes.join(' ') + '" data-id="' + t.id + '">' +
    '<label class="check"><input type="checkbox" class="cb-fait"' + (t.fait ? ' checked' : '') +
      (t.archive ? ' disabled' : '') + '></label>' +
    '<div class="corps">' +
      '<h3>' + echapper(t.titre) + '</h3>' +
      '<div class="badges">' + badges + '</div>' +
      (t.notes ? '<p class="notes">📝 ' + echapper(t.notes) + '</p>' : '') +
    '</div>' +
    '<div class="actions">' + actions + '</div>' +
  '</article>';
}

function afficher() {
  const auj = aujourdhui();

  document.getElementById('stat-auj').textContent =
    taches.filter(function (t) { return !t.fait && t.date === auj; }).length;
  document.getElementById('stat-retard').textContent =
    taches.filter(function (t) { return !t.fait && t.date && t.date < auj; }).length;
  document.getElementById('stat-fait').textContent =
    taches.filter(function (t) { return t.fait && !t.archive; }).length;

  const visibles = taches.filter(correspondAuFiltre).sort(function (a, b) {
    const ka = (a.date || '9999-99-99') + ' ' + (a.heure || '99:99');
    const kb = (b.date || '9999-99-99') + ' ' + (b.heure || '99:99');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const conteneur = document.getElementById('liste-taches');
  if (visibles.length === 0) {
    const message = filtreActuel === 'archives' ? 'Aucune tâche archivée.' :
                    filtreActuel === 'faites' ? 'Aucune tâche terminée à archiver.' :
                    'Rien ici pour le moment.<br>Appuyez sur <strong>＋</strong> pour ajouter une tâche.';
    conteneur.innerHTML = '<div class="vide"><span class="gros">' +
      (filtreActuel === 'archives' ? '📦' : '🌤️') + '</span>' + message + '</div>';
  } else {
    let html = '';
    if (filtreActuel === 'faites') {
      html += '<button id="btn-tout-archiver" class="btn-bandeau">📦 Archiver toutes les terminées (' +
        visibles.length + ')</button>';
    }
    conteneur.innerHTML = html + visibles.map(carteHTML).join('');
  }
}

/* ---------- Synchronisation GitHub ----------
   Principe : un fichier taches.json dans un dépôt privé.
   À chaque synchro : on lit le fichier, on fusionne avec la liste locale
   (la version la plus récente de chaque tâche gagne, les suppressions
   sont mémorisées), puis on réécrit le fichier si besoin. */

let configSync = null;
try { configSync = JSON.parse(localStorage.getItem(CLE_SYNC) || 'null'); } catch (e) {}

let syncTimer = null;
let syncEnCours = false;

function majEtatSync(texte, classe) {
  const el = document.getElementById('sync-etat');
  el.textContent = texte;
  el.className = 'sync-etat' + (classe ? ' ' + classe : '');
}

function horodatage(t) {
  return t.modif || t.cree || '';
}

function fusionner(tachesA, supprA, tachesB, supprB) {
  // Union des suppressions (date la plus récente par id)
  const suppr = {};
  [supprA, supprB].forEach(function (s) {
    for (const id in s) {
      if (!suppr[id] || s[id] > suppr[id]) suppr[id] = s[id];
    }
  });

  // La version la plus récente de chaque tâche gagne
  const parId = {};
  tachesA.concat(tachesB).forEach(function (t) {
    if (!t || !t.id) return;
    if (!parId[t.id] || horodatage(t) > horodatage(parId[t.id])) parId[t.id] = t;
  });

  const resultat = [];
  for (const id in parId) {
    // Tâche supprimée après sa dernière modification → elle reste supprimée
    if (suppr[id] && suppr[id] >= horodatage(parId[id])) continue;
    resultat.push(parId[id]);
  }
  return { taches: resultat, supprimees: suppr };
}

function versBase64(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

function depuisBase64(b) {
  return decodeURIComponent(escape(atob(b.replace(/\s/g, ''))));
}

function synchroniser(manuel) {
  if (!configSync || !configSync.token) {
    majEtatSync('Synchro non configurée — appuyez sur ⚙️', '');
    if (manuel) ouvrirReglages();
    return Promise.resolve(false);
  }
  if (syncEnCours) return Promise.resolve(false);
  syncEnCours = true;
  majEtatSync('Synchronisation…', 'sync-encours');

  const api = 'https://api.github.com/repos/' + configSync.depot + '/contents/taches.json';
  const entetes = {
    'Authorization': 'Bearer ' + configSync.token,
    'Accept': 'application/vnd.github+json'
  };

  let sha = null;
  let contenuDistant = null;

  return fetch(api + '?cacheBust=' + Date.now(), { headers: entetes, cache: 'no-store' })
    .then(function (rep) {
      if (rep.status === 200) return rep.json();
      if (rep.status === 404) return null; // fichier pas encore créé
      throw new Error(rep.status === 401 ? 'Clé (token) refusée' :
                      rep.status === 403 ? 'Accès refusé au dépôt' :
                      'Erreur GitHub ' + rep.status);
    })
    .then(function (json) {
      let distant = { taches: [], supprimees: {} };
      if (json) {
        sha = json.sha;
        contenuDistant = depuisBase64(json.content);
        try {
          const d = JSON.parse(contenuDistant);
          if (d && typeof d === 'object') {
            distant.taches = Array.isArray(d.taches) ? d.taches : [];
            distant.supprimees = d.supprimees || {};
          }
        } catch (e) { /* fichier distant illisible : on le réécrira */ }
      }

      const fusion = fusionner(taches, supprimees, distant.taches, distant.supprimees);
      taches = fusion.taches;
      supprimees = fusion.supprimees;
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ taches: taches, supprimees: supprimees }));
      afficher();

      const nouveau = JSON.stringify({ taches: taches, supprimees: supprimees, maj: maintenant() }, null, 1);
      // Rien de nouveau à envoyer ? On s'arrête là (pas de commit inutile).
      if (contenuDistant) {
        try {
          const d = JSON.parse(contenuDistant);
          const identique = JSON.stringify({ t: d.taches, s: d.supprimees }) ===
                            JSON.stringify({ t: taches, s: supprimees });
          if (identique) return { ok: true };
        } catch (e) {}
      }

      const corps = { message: 'Synchro du ' + new Date().toLocaleString('fr-FR'), content: versBase64(nouveau) };
      if (sha) corps.sha = sha;
      return fetch(api, { method: 'PUT', headers: entetes, body: JSON.stringify(corps) })
        .then(function (rep) {
          if (!rep.ok) throw new Error('Écriture refusée (' + rep.status + ')');
          return { ok: true };
        });
    })
    .then(function () {
      const h = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      majEtatSync('✓ Synchronisé à ' + h, 'sync-ok');
      syncEnCours = false;
      return true;
    })
    .catch(function (err) {
      majEtatSync('⚠️ Synchro impossible : ' + (err.message || 'hors ligne ?'), 'sync-erreur');
      syncEnCours = false;
      return false;
    });
}

function planifierSync() {
  if (!configSync || !configSync.token) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(function () { synchroniser(false); }, 2500);
}

/* ---------- Réglages de la synchro ---------- */

const dlgReglages = document.getElementById('dlg-reglages');

function ouvrirReglages() {
  document.getElementById('r-token').value = configSync ? (configSync.token || '') : '';
  document.getElementById('r-depot').value = (configSync && configSync.depot) ? configSync.depot : DEPOT_DEFAUT;
  document.getElementById('r-message').textContent = '';
  dlgReglages.showModal();
}

document.getElementById('btn-reglages').addEventListener('click', ouvrirReglages);

document.getElementById('btn-sync').addEventListener('click', function () {
  synchroniser(true);
});

document.getElementById('form-reglages').addEventListener('submit', function (e) {
  e.preventDefault();
  const token = document.getElementById('r-token').value.trim();
  const depot = document.getElementById('r-depot').value.trim() || DEPOT_DEFAUT;
  const message = document.getElementById('r-message');

  if (!token) {
    message.textContent = 'Collez votre clé (token) GitHub ci-dessus.';
    return;
  }

  configSync = { token: token, depot: depot };
  localStorage.setItem(CLE_SYNC, JSON.stringify(configSync));
  message.textContent = 'Test de connexion en cours…';

  synchroniser(false).then(function (ok) {
    if (ok) {
      message.textContent = '✅ Connexion réussie ! La synchro est active.';
      setTimeout(function () { dlgReglages.close(); }, 1200);
    } else {
      message.textContent = '❌ Échec — vérifiez la clé (token) et réessayez. ' +
        'Voir le LISEZMOI pour créer la clé correctement.';
    }
  });
});

document.getElementById('btn-reglages-annuler').addEventListener('click', function () {
  dlgReglages.close();
});

document.getElementById('btn-sync-off').addEventListener('click', function () {
  if (confirm('Désactiver la synchronisation sur cet appareil ? (Vos tâches restent sur l\'appareil.)')) {
    configSync = null;
    localStorage.removeItem(CLE_SYNC);
    majEtatSync('Synchro non configurée — appuyez sur ⚙️', '');
    dlgReglages.close();
  }
});

/* ---------- Formulaire de tâche ---------- */

const dlg = document.getElementById('dlg-tache');
const form = document.getElementById('form-tache');

function ouvrirFormulaire(tache) {
  idEnCours = tache ? tache.id : null;
  document.getElementById('dlg-titre').textContent = tache ? 'Modifier la tâche' : 'Nouvelle tâche';
  document.getElementById('f-titre').value = tache ? tache.titre : '';
  document.getElementById('f-categorie').value = tache ? tache.categorie : 'chantier';
  document.getElementById('f-priorite').value = tache ? tache.priorite : 'normale';
  document.getElementById('f-site').value = tache ? (tache.site || '') : '';
  document.getElementById('f-date').value = tache ? (tache.date || '') : aujourdhui();
  document.getElementById('f-heure').value = tache ? (tache.heure || '') : '';
  document.getElementById('f-duree').value = tache ? (tache.duree || '') : '';
  document.getElementById('f-notes').value = tache ? (tache.notes || '') : '';
  dlg.showModal();
  document.getElementById('f-titre').focus();
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  const titre = document.getElementById('f-titre').value.trim();
  if (!titre) {
    document.getElementById('f-titre').focus();
    return;
  }

  const donnees = {
    titre: titre,
    categorie: document.getElementById('f-categorie').value,
    priorite: document.getElementById('f-priorite').value,
    site: document.getElementById('f-site').value.trim(),
    date: document.getElementById('f-date').value,
    heure: document.getElementById('f-heure').value,
    duree: document.getElementById('f-duree').value,
    notes: document.getElementById('f-notes').value.trim(),
    modif: maintenant()
  };

  if (idEnCours) {
    const t = taches.find(function (x) { return x.id === idEnCours; });
    if (t) Object.assign(t, donnees);
  } else {
    donnees.id = nouvelId();
    donnees.fait = false;
    donnees.cree = maintenant();
    taches.push(donnees);
  }

  sauver();
  dlg.close();
  afficher();
});

document.getElementById('btn-annuler').addEventListener('click', function () {
  dlg.close();
});

document.getElementById('btn-ajouter').addEventListener('click', function () {
  ouvrirFormulaire(null);
});

/* ---------- Actions sur les cartes (délégation) ---------- */

document.getElementById('liste-taches').addEventListener('click', function (e) {
  // Bouton « Archiver toutes les terminées » (hors carte)
  if (e.target.closest('#btn-tout-archiver')) {
    const terminees = taches.filter(function (t) { return t.fait && !t.archive; });
    if (terminees.length &&
        confirm('Archiver les ' + terminees.length + ' tâche(s) terminée(s) ?')) {
      const quand = maintenant();
      terminees.forEach(function (t) { t.archive = true; t.modif = quand; });
      sauver();
      afficher();
    }
    return;
  }

  const carte = e.target.closest('.tache');
  if (!carte) return;
  const tache = taches.find(function (t) { return t.id === carte.dataset.id; });
  if (!tache) return;

  if (e.target.closest('.btn-modif')) {
    ouvrirFormulaire(tache);
  } else if (e.target.closest('.btn-note')) {
    ouvrirNote(tache);
  } else if (e.target.closest('.btn-archiver')) {
    tache.archive = true;
    tache.modif = maintenant();
    sauver();
    afficher();
  } else if (e.target.closest('.btn-restaurer')) {
    tache.archive = false;
    tache.modif = maintenant();
    sauver();
    afficher();
  } else if (e.target.closest('.btn-suppr')) {
    if (confirm('Supprimer la tâche « ' + tache.titre + ' » ?')) {
      supprimees[tache.id] = maintenant();
      taches = taches.filter(function (t) { return t.id !== tache.id; });
      sauver();
      afficher();
    }
  }
});

/* ---------- Note rapide ---------- */

const dlgNote = document.getElementById('dlg-note');
let idNote = null;

function ouvrirNote(tache) {
  idNote = tache.id;
  document.getElementById('note-titre-tache').textContent = tache.titre;
  document.getElementById('n-texte').value = tache.notes || '';
  dlgNote.showModal();
  document.getElementById('n-texte').focus();
}

document.getElementById('form-note').addEventListener('submit', function (e) {
  e.preventDefault();
  const tache = taches.find(function (t) { return t.id === idNote; });
  if (tache) {
    tache.notes = document.getElementById('n-texte').value.trim();
    tache.modif = maintenant();
    sauver();
    afficher();
  }
  dlgNote.close();
});

document.getElementById('btn-note-annuler').addEventListener('click', function () {
  dlgNote.close();
});

document.getElementById('liste-taches').addEventListener('change', function (e) {
  if (!e.target.classList.contains('cb-fait')) return;
  const carte = e.target.closest('.tache');
  const tache = taches.find(function (t) { return t.id === carte.dataset.id; });
  if (tache) {
    tache.fait = e.target.checked;
    tache.modif = maintenant();
    sauver();
    afficher();
  }
});

/* ---------- Filtres ---------- */

document.getElementById('filtres').addEventListener('click', function (e) {
  const bouton = e.target.closest('.filtre');
  if (!bouton) return;
  filtreActuel = bouton.dataset.filtre;
  document.querySelectorAll('.filtre').forEach(function (b) {
    b.classList.toggle('actif', b === bouton);
  });
  afficher();
});

/* ---------- Sauvegarde / restauration (fichier JSON) ---------- */

document.getElementById('btn-export').addEventListener('click', function () {
  const blob = new Blob([JSON.stringify(taches, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mes-taches-' + aujourdhui() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('btn-import').addEventListener('click', function () {
  document.getElementById('input-import').click();
});

document.getElementById('input-import').addEventListener('change', function (e) {
  const fichier = e.target.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = function () {
    try {
      const liste = JSON.parse(lecteur.result);
      if (!Array.isArray(liste)) throw new Error('format');
      if (confirm('Remplacer vos ' + taches.length + ' tâche(s) actuelle(s) par les ' +
                  liste.length + ' tâche(s) du fichier ?')) {
        const quand = maintenant();
        liste.forEach(function (t) { if (!t.modif) t.modif = quand; });
        taches = liste;
        sauver();
        afficher();
      }
    } catch (err) {
      alert("Ce fichier n'est pas une sauvegarde valide.");
    }
    e.target.value = '';
  };
  lecteur.readAsText(fichier);
});

/* ---------- Démarrage ---------- */

document.getElementById('date-jour').textContent =
  new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

charger();
afficher();
synchroniser(false);

// Re-synchronise quand on revient sur l'appli (retour d'un autre onglet / réveil du téléphone)
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') synchroniser(false);
});

if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible */ });
}
