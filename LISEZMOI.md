# 🧹 Mes Tâches Chantier — mode d'emploi

Application personnelle de gestion de tâches pour responsable de chantier /
chef d'équipe propreté. Fonctionne sur ordinateur ET téléphone, et permet
d'envoyer chaque tâche vers Google Agenda en un clic (bouton 📅).

## 🎤 Dicter ses tâches (nouveau)

- Appuyer sur le gros bouton **🎤** et parler normalement, par exemple :
  « demain à 9 h appeler Cotta, c'est urgent, **puis** vendredi contrôle qualité
  Néolia Belfort ». Dire **puis** ou **ensuite** entre deux tâches.
- Pendant qu'on parle, l'appli **synthétise en direct** chaque tâche : titre
  propre (« il faut que j'appelle… » → « Appeler… »), date, heure, durée,
  priorité (« urgent », « pas pressé »), catégorie et **chantier reconnu**
  (avec son adresse et la titulaire).
- Si un mot désigne plusieurs chantiers (« Néolia », « Cotta »), l'appli
  propose de choisir. Tout reste modifiable avant **Ajouter**.
- L'appli confirme à voix haute ce qu'elle a noté (bouton 🔊 / 🔇 pour couper).
- Mots compris : aujourd'hui, ce soir, demain, après-demain, lundi… dimanche,
  « mardi de la semaine prochaine », le 16 novembre, le 28/10, dans 3 jours,
  dans quinze jours, la semaine prochaine, fin de semaine, fin du mois ;
  à 9 h, 14 h 30, midi et demi, 8 h du soir ; pendant 30 minutes, pendant 1 h 30.
- **Raccourci** : appui long sur l'icône de l'appli → « Dicter une tâche ».
- Sans micro dans le navigateur (iPhone, Firefox…) : utiliser le micro 🎙️ du
  clavier, l'appli synthétise pareil.

**🔊 Ma journée** : lit à voix haute les tâches du jour, les retards et le
programme de demain (pratique en voiture). Toucher à nouveau pour arrêter.

**🧭 Itinéraire** : sur une tâche liée à un chantier connu, ouvre Google Maps
vers l'adresse. Sous la tâche s'affichent la titulaire et ses horaires.

La liste des chantiers (adresses, titulaires) vient du fichier `lexique.json`
du dépôt **privé** `mes-taches-data` ; elle arrive avec la synchro (rien de
privé n'est dans ce dépôt public).

**Avec Claude** : on peut aussi dicter à Claude (« ajoute une tâche : … ») ; il
écrit directement dans `mes-taches-data` et la tâche apparaît dans l'appli à la
synchro suivante.

## 1. Tester sur l'ordinateur (tout de suite)

Deux façons :

- **Simple** : double-cliquer sur `index.html` → l'appli s'ouvre dans le navigateur.
- **Complète** (recommandée, active le mode hors-ligne) :
  clic droit sur `serve.ps1` → « Exécuter avec PowerShell »,
  puis ouvrir http://localhost:8123/ dans le navigateur.

## 2. L'utiliser sur le téléphone (et partout) — GitHub Pages

Pour que l'appli soit accessible partout, il faut la mettre en ligne.
C'est gratuit avec GitHub Pages :

1. Aller sur https://github.com → se connecter.
2. Cliquer sur **+** (en haut à droite) → **New repository**.
3. Nom : `mes-taches` → cocher **Public** → **Create repository**.
4. Cliquer sur **uploading an existing file** (lien dans la page).
5. Glisser-déposer TOUS les fichiers de ce dossier (sauf `serve.ps1` et ce LISEZMOI,
   pas gênant mais inutile) → bouton vert **Commit changes**.
6. Dans le dépôt : **Settings** → **Pages** (menu de gauche) →
   Source : **Deploy from a branch** → Branch : `main` + `/ (root)` → **Save**.
7. Attendre 1-2 minutes. L'adresse apparaît en haut de la page Pages :
   `https://VOTRE-PSEUDO.github.io/mes-taches/`

Ensuite, sur le téléphone :
- Ouvrir cette adresse dans Chrome.
- Menu ⋮ → **Ajouter à l'écran d'accueil** (ou « Installer l'application »).
- L'appli a maintenant sa propre icône, comme une vraie application,
  et fonctionne même sans réseau.

Sur l'ordinateur : même adresse, et Chrome/Edge proposent aussi « Installer »
(petite icône dans la barre d'adresse).

**Mises à jour de l'appli** : si on remplace les fichiers sur GitHub,
tous les appareils reçoivent la nouvelle version automatiquement.

## 3. Google Agenda

Chaque tâche a un bouton **📅** : il ouvre Google Agenda avec l'événement
déjà rempli (titre, date, heure, durée, lieu, notes). Il n'y a plus qu'à
appuyer sur **Enregistrer**. Sur téléphone, cela ouvre directement
l'application Google Agenda.

Comme Google Agenda est synchronisé sur tous vos appareils, tout ce qui
est envoyé dedans se retrouve partout.

## 4. Synchro entre appareils (recommandé)

Avec la synchro activée, la MÊME liste de tâches se retrouve sur tous vos
appareils. Les données sont stockées dans VOTRE dépôt GitHub **privé**
`Jocelyn97470/mes-taches-data` (personne d'autre ne peut le lire).

### Créer la clé d'accès (une seule fois, ~2 minutes)

1. Ouvrir : https://github.com/settings/personal-access-tokens/new
   (se connecter à GitHub si demandé).
2. **Token name** : `taches-sync`
3. **Expiration** : choisir la durée la plus longue proposée
   (il faudra refaire une clé à l'expiration — l'appli vous le dira
   par un message « Clé refusée »).
4. **Repository access** : cocher **Only select repositories**
   → choisir `mes-taches-data` dans la liste.
5. Ouvrir **Repository permissions** → ligne **Contents** →
   choisir **Read and write**. (Ne rien toucher d'autre.)
6. Bouton vert **Generate token** en bas → **copier** la clé affichée
   (elle commence par `github_pat_`). Elle ne sera montrée qu'une fois :
   la coller par exemple dans un mail brouillon pour la retrouver
   depuis le téléphone.

### Activer dans l'appli (sur CHAQUE appareil)

1. Ouvrir l'appli → bouton **⚙️**.
2. Coller la clé dans « Clé d'accès GitHub ».
3. **Enregistrer et tester** → « ✅ Connexion réussie ».

Ensuite tout est automatique : chaque ajout / modification / suppression
est envoyé quelques secondes après, et l'appli récupère les nouveautés à
chaque ouverture (bouton **🔄** pour forcer une synchro immédiate).
L'état s'affiche sous la date : « ✓ Synchronisé à HH:MM ».

⚠️ Cette clé ne donne accès QU'AU dépôt `mes-taches-data` (vos tâches),
à rien d'autre de votre compte. Ne la partagez quand même avec personne.

## 5. Sans synchro : où sont mes tâches ?

Sans synchro, les tâches sont enregistrées **dans le navigateur de chaque
appareil** : liste du téléphone et du PC indépendantes. Boutons **💾**
(export fichier) et **📂** (restauration) pour transférer à la main.
Ne pas « vider les données de navigation » du site, sinon la liste locale
est effacée (avec la synchro active, rien n'est perdu : tout revient du
dépôt à la synchro suivante).

## 6. Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | la page de l'application |
| `styles.css` | l'apparence |
| `app.js` | le fonctionnement (tâches, filtres, Google Agenda, synchro) |
| `analyse.js` | compréhension d'une dictée en français (dates, heures, chantiers…) |
| `dictee.js` | micro 🎤, relecture, confirmation vocale, 🔊 Ma journée |
| `manifest.webmanifest` + `icon.svg` | installation sur téléphone (PWA) |
| `sw.js` | mode hors-ligne |
| `serve.ps1` | mini-serveur de test local (PC uniquement) |
