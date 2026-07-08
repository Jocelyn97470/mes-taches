/* ===== Mes Tâches Chantier — logique de l'application =====
   Données enregistrées dans le navigateur (localStorage).
   Bouton 📅 : ouvre Google Agenda avec l'événement pré-rempli. */

'use strict';

const CLE_STOCKAGE = 'taches-chantier-v1';

const CATEGORIES = {
  chantier: '🧹 Chantier',
  equipe:   '👥 Équipe',
  qualite:  '✅ Contrôle qualité',
  materiel: '🧴 Produits / Matériel',
  client:   '🤝 Client',
  admin:    '📋 Administratif'
};

let taches = charger();
let filtreActuel = 'auj';
let idEnCours = null; // null = nouvelle tâche, sinon id de la tâche modifiée

/* ---------- Stockage ---------- */

function charger() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) {
    return [];
  }
}

function sauver() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(taches));
}

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
  switch (filtreActuel) {
    case 'auj':     return !t.fait && (!t.date || t.date <= auj);
    case 'semaine': return !t.fait && (!t.date || t.date <= dansNJours(7));
    case 'toutes':  return !t.fait;
    case 'faites':  return !!t.fait;
    default:        return true;
  }
}

function carteHTML(t) {
  const enRetard = !t.fait && t.date && t.date < aujourdhui();
  const classes = ['tache', 'prio-' + (t.priorite || 'normale')];
  if (t.fait) classes.push('faite');
  if (enRetard) classes.push('retard');

  let badges = '<span class="badge">' + (CATEGORIES[t.categorie] || echapper(t.categorie)) + '</span>';
  if (t.site) badges += '<span class="badge">📍 ' + echapper(t.site) + '</span>';
  if (t.date) {
    badges += '<span class="badge' + (enRetard ? ' badge-retard' : '') + '">🗓 ' +
      dateFr(t.date) + (t.heure ? ' · ' + t.heure : '') +
      (enRetard ? ' — en retard !' : '') + '</span>';
  }

  return '<article class="' + classes.join(' ') + '" data-id="' + t.id + '">' +
    '<label class="check"><input type="checkbox" class="cb-fait"' + (t.fait ? ' checked' : '') + '></label>' +
    '<div class="corps">' +
      '<h3>' + echapper(t.titre) + '</h3>' +
      '<div class="badges">' + badges + '</div>' +
      (t.notes ? '<p class="notes">' + echapper(t.notes) + '</p>' : '') +
    '</div>' +
    '<div class="actions">' +
      '<a class="btn-gcal" href="' + lienGoogleAgenda(t) + '" target="_blank" rel="noopener" title="Ajouter à Google Agenda">📅</a>' +
      '<button class="btn-modif" title="Modifier">✏️</button>' +
      '<button class="btn-suppr" title="Supprimer">🗑️</button>' +
    '</div>' +
  '</article>';
}

function afficher() {
  const auj = aujourdhui();

  document.getElementById('stat-auj').textContent =
    taches.filter(function (t) { return !t.fait && t.date === auj; }).length;
  document.getElementById('stat-retard').textContent =
    taches.filter(function (t) { return !t.fait && t.date && t.date < auj; }).length;
  document.getElementById('stat-fait').textContent =
    taches.filter(function (t) { return t.fait; }).length;

  const visibles = taches.filter(correspondAuFiltre).sort(function (a, b) {
    const ka = (a.date || '9999-99-99') + ' ' + (a.heure || '99:99');
    const kb = (b.date || '9999-99-99') + ' ' + (b.heure || '99:99');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const conteneur = document.getElementById('liste-taches');
  if (visibles.length === 0) {
    conteneur.innerHTML = '<div class="vide"><span class="gros">🌤️</span>' +
      'Rien ici pour le moment.<br>Appuyez sur <strong>＋</strong> pour ajouter une tâche.</div>';
  } else {
    conteneur.innerHTML = visibles.map(carteHTML).join('');
  }
}

/* ---------- Formulaire ---------- */

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
    notes: document.getElementById('f-notes').value.trim()
  };

  if (idEnCours) {
    const t = taches.find(function (x) { return x.id === idEnCours; });
    if (t) Object.assign(t, donnees);
  } else {
    donnees.id = nouvelId();
    donnees.fait = false;
    donnees.cree = new Date().toISOString();
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
  const carte = e.target.closest('.tache');
  if (!carte) return;
  const tache = taches.find(function (t) { return t.id === carte.dataset.id; });
  if (!tache) return;

  if (e.target.closest('.btn-modif')) {
    ouvrirFormulaire(tache);
  } else if (e.target.closest('.btn-suppr')) {
    if (confirm('Supprimer la tâche « ' + tache.titre + ' » ?')) {
      taches = taches.filter(function (t) { return t.id !== tache.id; });
      sauver();
      afficher();
    }
  }
});

document.getElementById('liste-taches').addEventListener('change', function (e) {
  if (!e.target.classList.contains('cb-fait')) return;
  const carte = e.target.closest('.tache');
  const tache = taches.find(function (t) { return t.id === carte.dataset.id; });
  if (tache) {
    tache.fait = e.target.checked;
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

afficher();

if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
  navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible */ });
}
