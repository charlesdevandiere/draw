# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du projet

Dépôt démarré from scratch : seuls `.gitignore`, `LICENSE` (MIT) et la note de cadrage existent. Aucun code, aucune dépendance, aucune commande de build/test n'est encore en place. **Mettre à jour ce fichier dès que le projet Vite est généré** (commandes `npm`, lancement d'un test unitaire isolé, structure).

La vision produit, le périmètre MVP, les hypothèses à valider et la liste « Not Doing » sont dans **`docs/ideas/carnet-magique.md`** — à lire avant toute décision de fonctionnalité ou d'architecture.

## Objectif

« Carnet magique » : PWA de dessin pour enfants de 5 ans et plus (dessin libre, coloriages anti-dépassement, modèles de lettres à tracer), sans compte, sans backend, hors ligne. Cibles :
- iPad (Safari iPadOS, PWA installée), au stylet **et** au doigt ;
- smartphones iOS et Android (Safari / Chrome), au doigt.

PC (souris / tactile) : non ciblé pour la validation, mais le code doit rester standard pour ne pas l'exclure.

**Appareils de référence** — une fonctionnalité n'est terminée que lorsqu'elle est validée sur les trois :
1. iPad 11 + stylet Metapen ;
2. iPad 11 au doigt ;
3. Google Pixel 9a au doigt.

## Stack

- **Vite + TypeScript, sans framework UI** (Angular écarté : aucune plus-value pour une app essentiellement canvas).
- `vite-plugin-pwa` (Workbox) pour le service worker et le manifeste.
- **Bootstrap uniquement pour les écrans « adulte »** (galerie détaillée, réglages, export). L'écran de dessin enfant utilise du CSS sur mesure : pictogrammes sans texte, cibles tactiles ≥ 48 px.
- Stockage : IndexedDB.

## Contraintes techniques structurantes

- **Moteur de dessin en TypeScript pur**, découplé de l'UI (pas de dépendance DOM hors canvas fourni), testable unitairement.
- **Pointer Events** comme API d'entrée unique ; `touch-action: none` sur la surface de dessin ; `getCoalescedEvents()` quand disponible, avec fallback.
- **Un trait en cours par `pointerId`** (jamais un « trait courant » unique) : prépare le multi-doigts simultané.
- **Stylet et doigt** : quand un stylet (`pointerType: "pen"`) est actif, ignorer les contacts doigt/paume ; sans stylet, le doigt dessine. **Aucun geste au doigt réservé au pan/zoom** : pas de zoom, la page a la taille de l'écran.
- **Ne pas dépendre de `pressure`/`tilt`** : le Metapen n'a probablement pas de pression, le doigt jamais. Épaisseur fixe (ou simulée par la vitesse).
- **Format de page fixe, choisi à la création** : carré, A4 portrait ou A4 paysage (ratio 1:√2). La page est mise à l'échelle et centrée dans l'écran (letterboxing). **Les points sont stockés en coordonnées de page, jamais en pixels écran** : conversion écran → page à l'entrée, page → écran au rendu (tenir compte de `devicePixelRatio`). Chaque coloriage / modèle de lettres déclare son format.
- **Dessins stockés en vectoriel** (points + horodatage) — indispensable au replay, aux calques de fond (coloriages, modèles de lettres) et à l'export. Surveiller la taille, simplifier les points si besoin.
- **Anti-dépassement** : coloriages SVG dont chaque zone est un chemin fermé ; au `pointerdown`, détecter la zone (`isPointInPath`) et clipper le trait dessus.
- **Neutraliser les gestes système** (loupe/appui long, double-tap zoom, sélection, menu contextuel, pull-to-refresh) sur iOS et Android.
- **Persistance** : `navigator.storage.persist()`, sauvegarde automatique silencieuse, export/import manuel de la galerie comme filet de sécurité.
- **UI adaptative** smartphone portrait ↔ tablette paysage.
- Safari iOS est la cible la plus restrictive : vérifier la compatibilité iOS de toute API web utilisée.

## Première étape

Avant toute fonctionnalité : une page de diagnostic affichant `pointerType`, `pressure`, `tiltX/Y` et le nombre de coalesced events, testée sur les trois configurations de référence, pour confirmer que le Metapen est bien vu comme `pen` par Safari.
