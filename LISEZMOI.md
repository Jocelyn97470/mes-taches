# 🧹 Mes Tâches Chantier — mode d'emploi

Application personnelle de gestion de tâches pour responsable de chantier /
chef d'équipe propreté. Fonctionne sur ordinateur ET téléphone, et permet
d'envoyer chaque tâche vers Google Agenda en un clic (bouton 📅).

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

## 4. Où sont mes tâches ? (important)

Les tâches sont enregistrées **dans le navigateur de chaque appareil**
(pas sur un serveur). Conséquences :

- La liste du téléphone et celle de l'ordinateur sont indépendantes.
- Pour transférer : bouton **💾** (sauvegarder → fichier `.json`),
  puis bouton **📂** sur l'autre appareil (restaurer).
- Ne pas « vider les données de navigation » du site, sinon la liste est effacée.
  Faire un export 💾 de temps en temps par sécurité.

## 5. Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | la page de l'application |
| `styles.css` | l'apparence |
| `app.js` | le fonctionnement (tâches, filtres, Google Agenda) |
| `manifest.webmanifest` + `icon.svg` | installation sur téléphone (PWA) |
| `sw.js` | mode hors-ligne |
| `serve.ps1` | mini-serveur de test local (PC uniquement) |
