# Carnet magique

## Problem Statement
Comment donner à un enfant de 5 ans et plus — sur iPad au stylet comme sur smartphone au doigt — un carnet de dessin où il dessine, colorie et apprend à écrire, sans jamais perdre un dessin, sans pub, sans compte, hors ligne ?

## Recommended Direction
Une PWA sans framework (Vite + TypeScript, `vite-plugin-pwa`) centrée sur un moteur de dessin en TS pur, découplé de l'UI. L'écran de dessin est sans texte : grosses pastilles de couleur, deux épaisseurs, gomme, un bouton « annuler » géant. Chaque dessin est stocké sous forme de traits vectoriels (points + horodatage) dans IndexedDB, ce qui rend possibles le replay, les calques de fond et l'export. Bootstrap est réservé aux écrans « adulte » (galerie détaillée, réglages, export).

Trois couches successives : **le carnet** (ardoise + galerie « frigo » partageable via le partage natif), **la magie** (replay trait par trait), **le cahier d'activités** (coloriages SVG à zones fermées avec anti-dépassement par clip sur la zone de départ, et modèles de lettres — capitales puis cursive — sur un calque de fond verrouillé). Le moteur gère un trait par `pointerId` dès le départ : le multi-doigts devient un bonus bon marché, pas une refonte.

Deux modes de saisie de premier rang :
- **Tablette au stylet** (iPad + Metapen) : le stylet dessine, la paume est ignorée.
- **Doigt seul** (iPad sans stylet, smartphones iOS et Android) : le doigt dessine. Aucun geste au doigt n'est réservé au pan/zoom.

L'interface doit tenir sur un écran de smartphone en portrait comme sur une tablette en paysage (palette repliée en barre compacte sur petit écran, cibles tactiles ≥ 48 px partout).

**Appareils de référence pour valider le MVP :**
1. iPad 11 avec stylet Metapen (Safari, PWA installée) ;
2. iPad 11 au doigt ;
3. Google Pixel 9a au doigt (Chrome, PWA installée).

Une fonctionnalité n'est « terminée » que lorsqu'elle est validée sur les trois.

## Key Assumptions to Validate
- [ ] **Le Metapen est vu comme un stylet** (`pointerType: "pen"`) par Safari iPadOS — avec ou sans pression/inclinaison. → Page de diagnostic affichant les propriétés Pointer Events, testée **avant tout le reste**.
- [ ] **Basculement stylet / doigt sans réglage** : dès qu'un stylet est détecté, les contacts doigt/paume sont ignorés ; sans stylet, le doigt dessine. → Tester sur l'iPad dans les deux usages, et vérifier qu'un enfant ne se retrouve pas « bloqué » (doigt qui ne dessine plus après usage du stylet).
- [ ] **Les gestes système sont neutralisables** sur iOS et Android (loupe/appui long, double-tap zoom, sélection, menu contextuel, pull-to-refresh, gestes de bord). → Canvas de test plein écran en PWA installée, 10 min de gribouillage intensif sur chaque appareil.
- [ ] **Le stockage vectoriel reste léger** : un dessin de 10 min < ~500 Ko. → Mesurer ; simplification des points (Ramer–Douglas–Peucker) si besoin.
- [ ] **Le rendu est fluide**, sans latence perceptible, au stylet comme au doigt. → Vérifier `getCoalescedEvents()` sur les versions d'iPadOS/iOS et Chrome cibles, fallback prévu.
- [ ] **Les données survivent** en PWA installée avec `navigator.storage.persist()`. → Test après plusieurs jours sans ouverture ; export manuel comme filet.
- [ ] **Un enfant de 5 ans s'en sert seul**, y compris sur un petit écran de smartphone. → Test avec l'enfant, sans explication.

## MVP Scope
**Étape 0 (une soirée) :** page de diagnostic Pointer Events, testée sur les trois configurations de référence. Si le Metapen n'est pas vu comme `pen`, on revoit la stratégie de saisie avant d'écrire autre chose.

**MVP — le carnet :**
- ardoise : 6–8 couleurs, 2 épaisseurs, gomme, annuler/rétablir, « nouvelle page » ;
- choix du format à la création de la page, par 3 pictogrammes : **carré**, **A4 portrait**, **A4 paysage** (ratio 1:√2). La page est centrée et mise à l'échelle dans l'écran (bandes autour si besoin) ;
- saisie stylet et doigt, palm rejection quand un stylet est actif ;
- UI adaptative smartphone portrait ↔ tablette paysage ;
- sauvegarde automatique silencieuse ;
- galerie en vignettes, rouvrir un dessin, partager en PNG (partage natif) ;
- replay d'un dessin ;
- mode parent : suppression protégée par un geste adulte, export/import de la galerie, persistance du stockage ;
- installable en PWA, fonctionne hors ligne.

**Jalon 2 — le cahier :** 5–10 coloriages SVG faits main avec anti-dépassement, puis capitales à tracer (point de départ + flèches, pas de correction).

**Jalon 3 :** lettres cursives, multi-doigts simultanés, export du replay en vidéo/GIF.

## Not Doing (and Why)
- **Angular / framework UI** — aucune plus-value pour une app qui est surtout un canvas ; poids inutile.
- **Comptes, synchro, backend** — hors de portée solo le soir, et le partage natif couvre « envoyer à mamie ».
- **Épaisseur selon la pression, calques, brosses avancées** — le Metapen n'a probablement pas de pression, le doigt jamais ; c'est une app d'illustrateur, pas un carnet d'enfant.
- **Zoom / canvas infini, pan au doigt** — confusion à 5 ans, et conflit avec « le doigt dessine ». La page fait la taille de l'écran.
- **Correction automatique de l'écriture** — un projet de reconnaissance de tracé à part entière. On guide, on ne note pas.
- **Coloriages générés depuis les dessins de l'enfant** — détection de zones complexe et fragile ; quelques coloriages faits main suffisent à valider l'idée.
- **Tests ciblés PC souris / PC tactile** — le code reste standard (Pointer Events) et devrait fonctionner, mais aucun effort de validation avant que le MVP tienne sur les trois configurations de référence.
- **Texte dans l'UI enfant** — l'enfant ne lit pas encore bien ; tout passe par des pictogrammes.

## Open Questions
- Quel modèle de cursive, sous quelle licence (police scolaire libre, ou tracés refaits en SVG) ?
- Replay à vitesse réelle, ou accéléré pour durer ~10 s quel que soit le dessin ?
- Quel geste « adulte » pour le mode parent (appui long 3 s, petit calcul, autre) ?
- Gomme « pixel » ou gomme « trait entier » (plus simple en vectoriel, moins intuitive) ?
- Sur smartphone, un format dont l'orientation ne correspond pas à celle de l'écran (A4 paysage sur téléphone en portrait) devient tout petit : inviter à tourner le téléphone, ou laisser faire ?

## Décisions prises
- **Format de page choisi à la création** : carré, A4 portrait ou A4 paysage. Les traits sont stockés en **coordonnées de page** (indépendantes de l'écran), ce qui rend un dessin identique sur iPad et smartphone et permet un export PNG/PDF à taille A4. Chaque coloriage et modèle de lettres déclare son format.
- **« Nouvelle page » reprend le dernier format utilisé** (un tap de moins) ; le choix du format reste accessible depuis l'écran de dessin.
