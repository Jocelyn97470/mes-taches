# 🌴 Voyage en famille — mode d'emploi

Application pour organiser un voyage avec les enfants : valises, achats,
activités et budget. Elle vit dans le dossier `voyage/` du dépôt
`mes-taches`, à côté de l'appli Tâches Chantier.

## L'ouvrir

- **Sur l'ordinateur** : double-cliquer sur `voyage/index.html`,
  ou lancer `serve.ps1` (à la racine) puis ouvrir
  http://localhost:8123/voyage/
- **Sur le téléphone** (si GitHub Pages est activé sur le dépôt) :
  `https://jocelyn97470.github.io/mes-taches/voyage/`
  puis menu ⋮ → « Ajouter à l'écran d'accueil » : l'appli s'installe
  avec sa propre icône et fonctionne même sans réseau.

## Ce qu'elle fait

### 🧳 Valises (à emporter)
Liste pré-remplie de tout ce qu'il ne faut pas oublier, classée par
catégorie (papiers, vêtements, pharmacie, plage, électronique, pour les
filles…). On coche au fur et à mesure ; une barre de progression montre
l'avancement de chaque catégorie et le pourcentage global s'affiche en
haut. Les petits boutons en haut de l'onglet filtrent par personne
(Moi / Fille 1 / Fille 2).

### 🛒 Achats
Ce qu'il reste **à acheter** et ce qui est **déjà acheté**, avec le prix
de chaque article et le total de chaque liste. Cocher un article le passe
en « déjà acheté ». Quelques achats classiques sont pré-remplis avec des
prix indicatifs : à ajuster avec les vrais prix (bouton ✏️).

### 🎡 Activités
Le programme des sorties : nom, lieu, date, heure, prix, statut
(💡 idée / 📌 réservé / ✅ payé) et notes. Le bouton 📅 envoie
l'activité dans Google Agenda, déjà remplie. Le coût total s'affiche
en haut de la liste.

### 💰 Budget
Se calcule tout seul : déjà dépensé (achats faits + activités payées),
encore à prévoir, et — si un budget total est défini dans ⚙️ —
ce qu'il restera à la fin.

## ⚙️ Réglages

Bouton ⚙️ en haut : destination, dates de départ/retour (affiche le
compte à rebours « J−x »), prénoms des filles (utilisés dans les listes)
et budget total.

## Sauvegarde

Les données sont enregistrées dans le navigateur de l'appareil.
Boutons 💾 (exporter en fichier) et 📂 (restaurer) pour transférer
d'un appareil à l'autre. Ne pas « vider les données de navigation »
du site sans avoir exporté avant.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | la page de l'application |
| `styles.css` | l'apparence (thème vacances) |
| `app.js` | le fonctionnement (listes, prix, budget, Google Agenda) |
| `manifest.webmanifest` + `icon.svg` | installation sur téléphone (PWA) |
| `sw.js` | mode hors-ligne |
