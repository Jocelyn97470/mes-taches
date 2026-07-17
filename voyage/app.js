/* ===== Voyage en famille — logique de l'application =====
   Organise un voyage : valises (à emporter), achats avec prix,
   activités avec prix, et suivi du budget.
   Données enregistrées dans le navigateur (localStorage).
   Boutons 💾 / 📂 pour sauvegarder / restaurer en fichier. */

'use strict';

const CLE_STOCKAGE = 'voyage-famille-v1';

const CATEGORIES_AFFAIRES = {
  papiers:  '📄 Papiers & argent',
  vetements:'👕 Vêtements',
  toilette: '🧴 Trousse de toilette',
  pharmacie:'💊 Pharmacie',
  plage:    '🏖️ Plage & loisirs',
  electro:  '🔌 Électronique',
  filles:   '🧸 Pour les filles',
  divers:   '🎒 Divers & trajet'
};

let donnees = null;
let ongletActuel = 'valises';
let personneFiltre = 'tous';
let idEnCours = null; // id de l'élément en cours de modification, sinon null

/* ---------- Données de départ (pré-remplies) ---------- */

function donneesInitiales() {
  const affaires = [];
  function aff(nom, categorie, personne) {
    affaires.push({ id: nouvelId(), nom: nom, categorie: categorie, personne: personne || 'tous', fait: false });
  }

  // 📄 Papiers & argent
  aff("Cartes d'identité / passeports (les 3)", 'papiers');
  aff('Billets (avion / train) et réservations', 'papiers');
  aff('Carte vitale + carte mutuelle', 'papiers');
  aff('Carnets de santé des filles', 'papiers');
  aff('Permis de conduire', 'papiers', 'moi');
  aff('Carte bancaire + un peu d’espèces', 'papiers', 'moi');
  aff('Photos des papiers dans le téléphone (secours)', 'papiers', 'moi');

  // 👕 Vêtements
  aff('Tenues pour chaque jour (+1 de secours)', 'vetements');
  aff('Sous-vêtements + chaussettes', 'vetements');
  aff('Pyjamas', 'vetements');
  aff('Maillots de bain', 'vetements');
  aff('Gilets / vestes pour le soir', 'vetements');
  aff('Casquettes ou chapeaux', 'vetements');
  aff('Chaussures confortables pour marcher', 'vetements');
  aff('Sandales / tongs', 'vetements');
  aff('K-way en cas de pluie', 'vetements');

  // 🧴 Trousse de toilette
  aff('Brosses à dents + dentifrice', 'toilette');
  aff('Gel douche + shampoing', 'toilette');
  aff('Brosse à cheveux + élastiques', 'toilette', 'filles');
  aff('Crème solaire indice 50 (enfants)', 'toilette');
  aff('Après-soleil', 'toilette');
  aff('Anti-moustiques', 'toilette');
  aff('Lingettes + mouchoirs', 'toilette');

  // 💊 Pharmacie
  aff('Doliprane adulte + enfants', 'pharmacie');
  aff('Pansements + désinfectant', 'pharmacie');
  aff('Médicaments habituels + ordonnances', 'pharmacie');
  aff('Thermomètre', 'pharmacie');
  aff('Sérum physiologique', 'pharmacie');
  aff('Médicament mal des transports', 'pharmacie');
  aff('Arnica (bleus et bosses)', 'pharmacie');

  // 🏖️ Plage & loisirs
  aff('Serviettes de plage', 'plage');
  aff('Brassards / bouées', 'plage', 'filles');
  aff('Jeux de plage (seau, pelle…)', 'plage', 'filles');
  aff('Lunettes de soleil (x3)', 'plage');
  aff('Sac étanche pour la plage', 'plage');

  // 🔌 Électronique
  aff('Téléphone + chargeur', 'electro', 'moi');
  aff('Batterie externe', 'electro', 'moi');
  aff('Écouteurs', 'electro');
  aff('Tablette + chargeur (pour le trajet)', 'electro', 'filles');
  aff('Adaptateur de prise (si étranger)', 'electro');

  // 🧸 Pour les filles
  aff('Doudous', 'filles', 'filles');
  aff('Jeux / coloriages pour le trajet', 'filles', 'filles');
  aff('Livres', 'filles', 'filles');
  aff('Veilleuse', 'filles', 'filles');

  // 🎒 Divers & trajet
  aff('Sac à dos pour les sorties', 'divers');
  aff('Gourdes (x3)', 'divers');
  aff('Goûters / encas pour le trajet', 'divers');
  aff('Sacs pour le linge sale', 'divers');
  aff('Oreiller de voyage', 'divers');

  // 🛒 Achats conseillés (prix indicatifs, à ajuster)
  const achats = [
    { nom: 'Crème solaire enfant SPF 50', prix: 12,   note: 'Prix indicatif' },
    { nom: 'Anti-moustiques (spray famille)', prix: 8, note: 'Prix indicatif' },
    { nom: 'Trousse de premiers secours voyage', prix: 15, note: 'Prix indicatif' },
    { nom: 'Brassards pour les filles', prix: 10,     note: 'Prix indicatif — x2' },
    { nom: 'Batterie externe', prix: 20,              note: 'Prix indicatif' },
    { nom: 'Jeux de plage', prix: 12,                 note: 'Prix indicatif' },
    { nom: 'Sac étanche', prix: 10,                   note: 'Prix indicatif' }
  ].map(function (a) {
    return { id: nouvelId(), nom: a.nom, prix: a.prix, statut: 'a-acheter', note: a.note };
  });

  return {
    reglages: { destination: '', depart: '', retour: '', nom1: 'Moi', nom2: 'Fille 1', nom3: 'Fille 2', budget: 0 },
    affaires: affaires,
    achats: achats,
    activites: []
  };
}

/* ---------- Stockage local ---------- */

function charger() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null');
    if (brut && typeof brut === 'object' && Array.isArray(brut.affaires)) {
      donnees = brut;
      donnees.reglages = donnees.reglages || {};
      donnees.achats = Array.isArray(donnees.achats) ? donnees.achats : [];
      donnees.activites = Array.isArray(donnees.activites) ? donnees.activites : [];
      return;
    }
  } catch (e) { /* stockage illisible : on repart des données de départ */ }
  donnees = donneesInitiales();
  sauver();
}

function sauver() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
}

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Utilitaires ---------- */

function echapper(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function lirePrix(champ) {
  const n = Number(String(champ.value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

function prixFr(n) {
  return (Number(n) || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }) + ' €';
}

function dateFr(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00')
    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function nomPersonne(code) {
  const r = donnees.reglages;
  if (code === 'moi') return r.nom1 || 'Moi';
  if (code === 'f1') return r.nom2 || 'Fille 1';
  if (code === 'f2') return r.nom3 || 'Fille 2';
  if (code === 'filles') return 'Les filles';
  return 'Tout le monde';
}

/* ---------- Lien Google Agenda (activités) ---------- */

function formatGcal(d) {
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + 'T' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') + '00';
}

function lienGoogleAgenda(a) {
  const p = new URLSearchParams();
  p.set('action', 'TEMPLATE');
  p.set('text', a.nom + (a.lieu ? ' — ' + a.lieu : ''));

  if (a.date && a.heure) {
    const debut = new Date(a.date + 'T' + a.heure);
    const fin = new Date(debut.getTime() + 120 * 60000); // 2 h par défaut
    p.set('dates', formatGcal(debut) + '/' + formatGcal(fin));
  } else if (a.date) {
    const lendemain = new Date(a.date + 'T00:00:00');
    lendemain.setDate(lendemain.getDate() + 1);
    const fin = lendemain.getFullYear() +
      String(lendemain.getMonth() + 1).padStart(2, '0') +
      String(lendemain.getDate()).padStart(2, '0');
    p.set('dates', a.date.replace(/-/g, '') + '/' + fin);
  }

  const details = [];
  if (a.prix) details.push('Prix : ' + prixFr(a.prix));
  if (a.notes) details.push(a.notes);
  p.set('details', details.join('\n'));
  if (a.lieu) p.set('location', a.lieu);

  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/* ---------- Calculs budget ---------- */

function totaux() {
  let achatsFaits = 0, achatsRestants = 0, activitesPayees = 0, activitesAPayer = 0;
  donnees.achats.forEach(function (a) {
    if (a.statut === 'achete') achatsFaits += Number(a.prix) || 0;
    else achatsRestants += Number(a.prix) || 0;
  });
  donnees.activites.forEach(function (a) {
    if (a.statut === 'paye') activitesPayees += Number(a.prix) || 0;
    else activitesAPayer += Number(a.prix) || 0;
  });
  return {
    achatsFaits: achatsFaits,
    achatsRestants: achatsRestants,
    activitesPayees: activitesPayees,
    activitesAPayer: activitesAPayer,
    depense: achatsFaits + activitesPayees,
    aPrevoir: achatsRestants + activitesAPayer
  };
}

/* ---------- Entête + statistiques ---------- */

function afficherEntete() {
  const r = donnees.reglages;
  document.getElementById('titre-voyage').textContent =
    '🌴 ' + (r.destination ? 'Voyage — ' + r.destination : 'Voyage en famille');

  const sous = [];
  if (r.depart) sous.push('Du ' + dateFr(r.depart));
  if (r.retour) sous.push('au ' + dateFr(r.retour));
  document.getElementById('sous-titre').textContent = sous.join(' ');

  // Compte à rebours
  const statJours = document.getElementById('stat-jours');
  const statJoursLabel = document.getElementById('stat-jours-label');
  if (r.depart) {
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const dep = new Date(r.depart + 'T00:00:00');
    const diff = Math.round((dep - auj) / 86400000);
    const ret = r.retour ? new Date(r.retour + 'T00:00:00') : null;
    if (diff > 0) {
      statJours.textContent = 'J−' + diff;
      statJoursLabel.textContent = diff > 1 ? 'jours avant départ' : 'jour avant départ';
    } else if (ret && auj <= ret) {
      statJours.textContent = '🏖️';
      statJoursLabel.textContent = 'En voyage !';
    } else if (diff === 0) {
      statJours.textContent = '✈️';
      statJoursLabel.textContent = "C'est le départ !";
    } else {
      statJours.textContent = '🏠';
      statJoursLabel.textContent = 'Voyage terminé';
    }
  } else {
    statJours.textContent = '–';
    statJoursLabel.textContent = 'Départ (⚙️)';
  }

  // Valises
  const total = donnees.affaires.length;
  const faits = donnees.affaires.filter(function (a) { return a.fait; }).length;
  document.getElementById('stat-valise').textContent =
    total ? Math.round(100 * faits / total) + '%' : '0%';

  // Dépensé
  document.getElementById('stat-depense').textContent = prixFr(totaux().depense);
}

/* ---------- Onglet Valises ---------- */

function afficherValises(zone) {
  let html = '';

  // Sous-filtres « pour qui ? »
  const persos = [
    ['tous', 'Tout'], ['moi', nomPersonne('moi')],
    ['f1', nomPersonne('f1')], ['f2', nomPersonne('f2')], ['filles', 'Les filles']
  ];
  html += '<div class="sous-filtres">' + persos.map(function (p) {
    return '<button class="sous-filtre' + (personneFiltre === p[0] ? ' actif' : '') +
      '" data-personne="' + p[0] + '">' + echapper(p[1]) + '</button>';
  }).join('') + '</div>';

  const visibles = donnees.affaires.filter(function (a) {
    if (personneFiltre === 'tous') return true;
    if (a.personne === 'tous') return true;
    if (personneFiltre === 'filles') return a.personne === 'filles' || a.personne === 'f1' || a.personne === 'f2';
    if (a.personne === 'filles') return personneFiltre === 'f1' || personneFiltre === 'f2';
    return a.personne === personneFiltre;
  });

  if (!visibles.length) {
    html += '<div class="vide"><span class="gros">🧳</span>Rien ici pour le moment.<br>Bouton ＋ pour ajouter.</div>';
    zone.innerHTML = html;
    return;
  }

  Object.keys(CATEGORIES_AFFAIRES).forEach(function (cat) {
    const items = visibles.filter(function (a) { return a.categorie === cat; });
    if (!items.length) return;
    const faits = items.filter(function (a) { return a.fait; }).length;

    html += '<div class="groupe">';
    html += '<div class="groupe-titre"><h2>' + CATEGORIES_AFFAIRES[cat] + '</h2>' +
      '<span class="compteur">' + faits + ' / ' + items.length + '</span></div>';
    html += '<div class="barre-progression"><div style="width:' +
      Math.round(100 * faits / items.length) + '%"></div></div>';

    items.forEach(function (a) {
      html += '<div class="ligne' + (a.fait ? ' fait' : '') + '">' +
        '<div class="check"><input type="checkbox" data-coche-affaire="' + a.id + '"' + (a.fait ? ' checked' : '') + '></div>' +
        '<div class="corps"><p class="nom">' + echapper(a.nom) + '</p>' +
        (a.personne !== 'tous'
          ? '<div class="badges"><span class="badge badge-personne">' + echapper(nomPersonne(a.personne)) + '</span></div>'
          : '') +
        '</div>' +
        '<div class="actions">' +
        '<button data-modif-affaire="' + a.id + '" title="Modifier">✏️</button>' +
        '<button data-suppr-affaire="' + a.id + '" title="Supprimer">🗑️</button>' +
        '</div></div>';
    });
    html += '</div>';
  });

  zone.innerHTML = html;
}

/* ---------- Onglet Achats ---------- */

function afficherAchats(zone) {
  const aAcheter = donnees.achats.filter(function (a) { return a.statut !== 'achete'; });
  const achetes = donnees.achats.filter(function (a) { return a.statut === 'achete'; });

  if (!donnees.achats.length) {
    zone.innerHTML = '<div class="vide"><span class="gros">🛒</span>Aucun achat prévu.<br>Bouton ＋ pour ajouter.</div>';
    return;
  }

  function totalDe(liste) {
    return liste.reduce(function (s, a) { return s + (Number(a.prix) || 0); }, 0);
  }

  function ligneAchat(a) {
    return '<div class="ligne' + (a.statut === 'achete' ? ' fait' : '') + '">' +
      '<div class="check"><input type="checkbox" data-coche-achat="' + a.id + '"' +
      (a.statut === 'achete' ? ' checked' : '') + '></div>' +
      '<div class="corps"><p class="nom">' + echapper(a.nom) + '</p>' +
      (a.note ? '<p class="detail">' + echapper(a.note) + '</p>' : '') +
      '</div>' +
      '<span class="prix">' + (a.prix ? prixFr(a.prix) : '–') + '</span>' +
      '<div class="actions">' +
      '<button data-modif-achat="' + a.id + '" title="Modifier">✏️</button>' +
      '<button data-suppr-achat="' + a.id + '" title="Supprimer">🗑️</button>' +
      '</div></div>';
  }

  let html = '';
  if (aAcheter.length) {
    html += '<div class="groupe"><div class="groupe-titre"><h2>🛒 À acheter</h2>' +
      '<span class="total">' + prixFr(totalDe(aAcheter)) + '</span></div>' +
      aAcheter.map(ligneAchat).join('') + '</div>';
  }
  if (achetes.length) {
    html += '<div class="groupe"><div class="groupe-titre"><h2>✅ Déjà acheté</h2>' +
      '<span class="total">' + prixFr(totalDe(achetes)) + '</span></div>' +
      achetes.map(ligneAchat).join('') + '</div>';
  }
  zone.innerHTML = html;
}

/* ---------- Onglet Activités ---------- */

const STATUTS_ACTIVITE = {
  idee:    ['💡 Idée', 'badge-idee'],
  reserve: ['📌 Réservé', 'badge-reserve'],
  paye:    ['✅ Payé', 'badge-paye']
};

function afficherActivites(zone) {
  if (!donnees.activites.length) {
    zone.innerHTML = '<div class="vide"><span class="gros">🎡</span>' +
      'Aucune activité pour le moment.<br>' +
      'Bouton ＋ pour ajouter vos sorties : parc, plage, resto, visites…<br>' +
      'Avec la date, le prix, et un bouton 📅 pour l’envoyer dans Google Agenda.</div>';
    return;
  }

  const triees = donnees.activites.slice().sort(function (a, b) {
    return (a.date || '9999') < (b.date || '9999') ? -1 : 1;
  });

  const total = triees.reduce(function (s, a) { return s + (Number(a.prix) || 0); }, 0);

  let html = '<div class="groupe"><div class="groupe-titre"><h2>🎡 Programme des activités</h2>' +
    '<span class="total">Total : ' + prixFr(total) + '</span></div>';

  triees.forEach(function (a) {
    const statut = STATUTS_ACTIVITE[a.statut] || STATUTS_ACTIVITE.idee;
    const badges = [];
    if (a.date) badges.push('<span class="badge">📅 ' + dateFr(a.date) + (a.heure ? ' · ' + a.heure : '') + '</span>');
    if (a.lieu) badges.push('<span class="badge">📍 ' + echapper(a.lieu) + '</span>');
    badges.push('<span class="badge ' + statut[1] + '">' + statut[0] + '</span>');

    html += '<div class="ligne activite">' +
      '<div class="corps"><p class="nom">' + echapper(a.nom) + '</p>' +
      '<div class="badges">' + badges.join('') + '</div>' +
      (a.notes ? '<p class="detail">' + echapper(a.notes) + '</p>' : '') +
      '</div>' +
      '<span class="prix">' + (a.prix ? prixFr(a.prix) : 'Gratuit') + '</span>' +
      '<div class="actions">' +
      '<a class="btn-gcal" href="' + lienGoogleAgenda(a) + '" target="_blank" rel="noopener" title="Envoyer vers Google Agenda">📅</a>' +
      '<button data-modif-activite="' + a.id + '" title="Modifier">✏️</button>' +
      '<button data-suppr-activite="' + a.id + '" title="Supprimer">🗑️</button>' +
      '</div></div>';
  });

  html += '</div>';
  zone.innerHTML = html;
}

/* ---------- Onglet Budget ---------- */

function afficherBudget(zone) {
  const t = totaux();
  const budget = Number(donnees.reglages.budget) || 0;
  const reste = budget - t.depense - t.aPrevoir;

  let html = '<div class="groupe"><div class="groupe-titre"><h2>💰 Où en est le budget ?</h2></div>';
  html += '<table class="tableau-budget">';
  html += '<tr><td>✅ Achats déjà faits</td><td>' + prixFr(t.achatsFaits) + '</td></tr>';
  html += '<tr><td>🛒 Achats restants</td><td>' + prixFr(t.achatsRestants) + '</td></tr>';
  html += '<tr><td>✅ Activités payées</td><td>' + prixFr(t.activitesPayees) + '</td></tr>';
  html += '<tr><td>🎡 Activités à payer</td><td>' + prixFr(t.activitesAPayer) + '</td></tr>';
  html += '<tr class="total"><td>Déjà dépensé</td><td class="neutre">' + prixFr(t.depense) + '</td></tr>';
  html += '<tr class="total"><td>Encore à prévoir</td><td class="neutre">' + prixFr(t.aPrevoir) + '</td></tr>';
  if (budget > 0) {
    html += '<tr class="total"><td>Budget prévu</td><td>' + prixFr(budget) + '</td></tr>';
    html += '<tr class="total"><td>' + (reste >= 0 ? 'Il restera' : 'Dépassement') + '</td>' +
      '<td class="' + (reste >= 0 ? 'positif' : 'negatif') + '">' + prixFr(Math.abs(reste)) + '</td></tr>';
  }
  html += '</table>';

  if (budget <= 0) {
    html += '<p class="aide">💡 Astuce : définissez votre budget total dans les réglages (⚙️) ' +
      'pour voir automatiquement ce qu’il vous restera.</p>';
  }
  html += '<p class="aide">Le budget se calcule tout seul à partir des prix saisis dans ' +
    'les onglets Achats et Activités.</p>';
  html += '</div>';
  zone.innerHTML = html;
}

/* ---------- Affichage général ---------- */

function afficher() {
  afficherEntete();
  const zone = document.getElementById('contenu');
  if (ongletActuel === 'valises') afficherValises(zone);
  else if (ongletActuel === 'achats') afficherAchats(zone);
  else if (ongletActuel === 'activites') afficherActivites(zone);
  else afficherBudget(zone);

  document.getElementById('btn-ajouter').classList.toggle('cache', ongletActuel === 'budget');
}

/* ---------- Fenêtres (dialogs) ---------- */

function remplirSelectAffaire() {
  const selCat = document.getElementById('fa-categorie');
  selCat.innerHTML = Object.keys(CATEGORIES_AFFAIRES).map(function (c) {
    return '<option value="' + c + '">' + CATEGORIES_AFFAIRES[c] + '</option>';
  }).join('');

  const selPers = document.getElementById('fa-personne');
  selPers.innerHTML = [
    ['tous', '👨‍👧‍👧 Tout le monde'],
    ['moi', '🧑 ' + nomPersonne('moi')],
    ['f1', '👧 ' + nomPersonne('f1')],
    ['f2', '👧 ' + nomPersonne('f2')],
    ['filles', '👧👧 Les filles']
  ].map(function (p) {
    return '<option value="' + p[0] + '">' + echapper(p[1]) + '</option>';
  }).join('');
}

function ouvrirDlgAffaire(id) {
  idEnCours = id || null;
  remplirSelectAffaire();
  const a = id ? donnees.affaires.find(function (x) { return x.id === id; }) : null;
  document.getElementById('dlg-affaire-titre').textContent = a ? 'Modifier' : 'Nouvelle chose à emporter';
  document.getElementById('fa-nom').value = a ? a.nom : '';
  document.getElementById('fa-categorie').value = a ? a.categorie : 'divers';
  document.getElementById('fa-personne').value = a ? a.personne : 'tous';
  document.getElementById('dlg-affaire').showModal();
}

function ouvrirDlgAchat(id) {
  idEnCours = id || null;
  const a = id ? donnees.achats.find(function (x) { return x.id === id; }) : null;
  document.getElementById('dlg-achat-titre').textContent = a ? 'Modifier l’achat' : 'Nouvel achat';
  document.getElementById('fh-nom').value = a ? a.nom : '';
  document.getElementById('fh-prix').value = a && a.prix ? String(a.prix).replace('.', ',') : '';
  document.getElementById('fh-statut').value = a ? a.statut : 'a-acheter';
  document.getElementById('fh-note').value = a ? (a.note || '') : '';
  document.getElementById('dlg-achat').showModal();
}

function ouvrirDlgActivite(id) {
  idEnCours = id || null;
  const a = id ? donnees.activites.find(function (x) { return x.id === id; }) : null;
  document.getElementById('dlg-activite-titre').textContent = a ? 'Modifier l’activité' : 'Nouvelle activité';
  document.getElementById('fv-nom').value = a ? a.nom : '';
  document.getElementById('fv-lieu').value = a ? (a.lieu || '') : '';
  document.getElementById('fv-date').value = a ? (a.date || '') : '';
  document.getElementById('fv-heure').value = a ? (a.heure || '') : '';
  document.getElementById('fv-prix').value = a && a.prix ? String(a.prix).replace('.', ',') : '';
  document.getElementById('fv-statut').value = a ? a.statut : 'idee';
  document.getElementById('fv-notes').value = a ? (a.notes || '') : '';
  document.getElementById('dlg-activite').showModal();
}

function ouvrirDlgReglages() {
  const r = donnees.reglages;
  document.getElementById('fr-destination').value = r.destination || '';
  document.getElementById('fr-depart').value = r.depart || '';
  document.getElementById('fr-retour').value = r.retour || '';
  document.getElementById('fr-nom1').value = r.nom1 || '';
  document.getElementById('fr-nom2').value = r.nom2 || '';
  document.getElementById('fr-nom3').value = r.nom3 || '';
  document.getElementById('fr-budget').value = r.budget ? String(r.budget).replace('.', ',') : '';
  document.getElementById('dlg-reglages').showModal();
}

/* ---------- Export / import ---------- */

function exporter() {
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voyage-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importer(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = function () {
    try {
      const brut = JSON.parse(lecteur.result);
      if (!brut || !Array.isArray(brut.affaires)) throw new Error('format');
      if (!confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
      donnees = brut;
      donnees.reglages = donnees.reglages || {};
      donnees.achats = Array.isArray(donnees.achats) ? donnees.achats : [];
      donnees.activites = Array.isArray(donnees.activites) ? donnees.activites : [];
      sauver();
      afficher();
    } catch (e) {
      alert('Fichier illisible : ce n’est pas une sauvegarde de l’appli Voyage.');
    }
  };
  lecteur.readAsText(fichier);
}

/* ---------- Événements ---------- */

function initEvenements() {
  // Onglets
  document.getElementById('onglets').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-onglet]');
    if (!btn) return;
    ongletActuel = btn.dataset.onglet;
    document.querySelectorAll('#onglets .filtre').forEach(function (b) {
      b.classList.toggle('actif', b === btn);
    });
    afficher();
  });

  // Clics dans le contenu (cases, modifier, supprimer, sous-filtres)
  document.getElementById('contenu').addEventListener('click', function (e) {
    const sf = e.target.closest('[data-personne]');
    if (sf) { personneFiltre = sf.dataset.personne; afficher(); return; }

    const cocheAff = e.target.closest('[data-coche-affaire]');
    if (cocheAff) {
      const a = donnees.affaires.find(function (x) { return x.id === cocheAff.dataset.cocheAffaire; });
      if (a) { a.fait = cocheAff.checked; sauver(); afficher(); }
      return;
    }
    const cocheAch = e.target.closest('[data-coche-achat]');
    if (cocheAch) {
      const a = donnees.achats.find(function (x) { return x.id === cocheAch.dataset.cocheAchat; });
      if (a) { a.statut = cocheAch.checked ? 'achete' : 'a-acheter'; sauver(); afficher(); }
      return;
    }

    const modifAff = e.target.closest('[data-modif-affaire]');
    if (modifAff) { ouvrirDlgAffaire(modifAff.dataset.modifAffaire); return; }
    const modifAch = e.target.closest('[data-modif-achat]');
    if (modifAch) { ouvrirDlgAchat(modifAch.dataset.modifAchat); return; }
    const modifAct = e.target.closest('[data-modif-activite]');
    if (modifAct) { ouvrirDlgActivite(modifAct.dataset.modifActivite); return; }

    const supprAff = e.target.closest('[data-suppr-affaire]');
    if (supprAff && confirm('Supprimer cet élément ?')) {
      donnees.affaires = donnees.affaires.filter(function (x) { return x.id !== supprAff.dataset.supprAffaire; });
      sauver(); afficher(); return;
    }
    const supprAch = e.target.closest('[data-suppr-achat]');
    if (supprAch && confirm('Supprimer cet achat ?')) {
      donnees.achats = donnees.achats.filter(function (x) { return x.id !== supprAch.dataset.supprAchat; });
      sauver(); afficher(); return;
    }
    const supprAct = e.target.closest('[data-suppr-activite]');
    if (supprAct && confirm('Supprimer cette activité ?')) {
      donnees.activites = donnees.activites.filter(function (x) { return x.id !== supprAct.dataset.supprActivite; });
      sauver(); afficher(); return;
    }
  });

  // Bouton +
  document.getElementById('btn-ajouter').addEventListener('click', function () {
    if (ongletActuel === 'valises') ouvrirDlgAffaire(null);
    else if (ongletActuel === 'achats') ouvrirDlgAchat(null);
    else if (ongletActuel === 'activites') ouvrirDlgActivite(null);
  });

  // Boutons Annuler de toutes les fenêtres
  document.querySelectorAll('.btn-annuler').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close(); });
  });

  // Formulaire affaire
  document.getElementById('form-affaire').addEventListener('submit', function (e) {
    e.preventDefault();
    const nom = document.getElementById('fa-nom').value.trim();
    if (!nom) return;
    if (idEnCours) {
      const a = donnees.affaires.find(function (x) { return x.id === idEnCours; });
      if (a) {
        a.nom = nom;
        a.categorie = document.getElementById('fa-categorie').value;
        a.personne = document.getElementById('fa-personne').value;
      }
    } else {
      donnees.affaires.push({
        id: nouvelId(), nom: nom,
        categorie: document.getElementById('fa-categorie').value,
        personne: document.getElementById('fa-personne').value,
        fait: false
      });
    }
    sauver();
    document.getElementById('dlg-affaire').close();
    afficher();
  });

  // Formulaire achat
  document.getElementById('form-achat').addEventListener('submit', function (e) {
    e.preventDefault();
    const nom = document.getElementById('fh-nom').value.trim();
    if (!nom) return;
    const valeurs = {
      nom: nom,
      prix: lirePrix(document.getElementById('fh-prix')),
      statut: document.getElementById('fh-statut').value,
      note: document.getElementById('fh-note').value.trim()
    };
    if (idEnCours) {
      const a = donnees.achats.find(function (x) { return x.id === idEnCours; });
      if (a) Object.assign(a, valeurs);
    } else {
      valeurs.id = nouvelId();
      donnees.achats.push(valeurs);
    }
    sauver();
    document.getElementById('dlg-achat').close();
    afficher();
  });

  // Formulaire activité
  document.getElementById('form-activite').addEventListener('submit', function (e) {
    e.preventDefault();
    const nom = document.getElementById('fv-nom').value.trim();
    if (!nom) return;
    const valeurs = {
      nom: nom,
      lieu: document.getElementById('fv-lieu').value.trim(),
      date: document.getElementById('fv-date').value,
      heure: document.getElementById('fv-heure').value,
      prix: lirePrix(document.getElementById('fv-prix')),
      statut: document.getElementById('fv-statut').value,
      notes: document.getElementById('fv-notes').value.trim()
    };
    if (idEnCours) {
      const a = donnees.activites.find(function (x) { return x.id === idEnCours; });
      if (a) Object.assign(a, valeurs);
    } else {
      valeurs.id = nouvelId();
      donnees.activites.push(valeurs);
    }
    sauver();
    document.getElementById('dlg-activite').close();
    afficher();
  });

  // Réglages
  document.getElementById('btn-reglages').addEventListener('click', ouvrirDlgReglages);
  document.getElementById('form-reglages').addEventListener('submit', function (e) {
    e.preventDefault();
    donnees.reglages = {
      destination: document.getElementById('fr-destination').value.trim(),
      depart: document.getElementById('fr-depart').value,
      retour: document.getElementById('fr-retour').value,
      nom1: document.getElementById('fr-nom1').value.trim() || 'Moi',
      nom2: document.getElementById('fr-nom2').value.trim() || 'Fille 1',
      nom3: document.getElementById('fr-nom3').value.trim() || 'Fille 2',
      budget: lirePrix(document.getElementById('fr-budget'))
    };
    sauver();
    document.getElementById('dlg-reglages').close();
    afficher();
  });

  // Export / import
  document.getElementById('btn-export').addEventListener('click', exporter);
  document.getElementById('btn-import').addEventListener('click', function () {
    document.getElementById('input-import').click();
  });
  document.getElementById('input-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importer(e.target.files[0]);
    e.target.value = '';
  });
}

/* ---------- Démarrage ---------- */

charger();
initEvenements();
afficher();

// Mode hors-ligne (PWA)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}
