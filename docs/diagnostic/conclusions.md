# Conclusions du diagnostic Pointer Events (étape 0)

Campagne du 19/11/2026, page `diagnostic.html` versions `79dcd82` → `71f767c`, PWA installée sur chaque appareil.

| Rapport                                      | Configuration                                                        |
| -------------------------------------------- | -------------------------------------------------------------------- |
| [`ipad11-metapen.json`](ipad11-metapen.json) | iPad 11, Safari standalone, stylet Metapen                           |
| [`ipad11-doigt.json`](ipad11-doigt.json)     | iPad 11, Safari standalone, doigt                                    |
| [`pixel9a-doigt.json`](pixel9a-doigt.json)   | Pixel 9a, Chrome standalone, doigt (+ stylet à embout rond, étape 4) |
| [`notes-campagne.md`](notes-campagne.md)     | Observations visuelles hors rapport                                  |

## Les 5 hypothèses

### 1. Le Metapen est vu comme `pointerType: "pen"` par Safari iPadOS — **OUI**

- 9 255 événements `pen` dans `ipad11-metapen.json`.
- Mais **pression et inclinaison sont factices** : `pressure` fixe à 0,12, `tiltX`/`tiltY` fixes à −27°/16°, `width`/`height` à 0,5. Elles ne servent à rien : épaisseur fixe confirmée.
- Le stylet à embout rond (passif) est vu comme un **doigt** (`touch`) sur les deux appareils : aucune distinction possible avec la main.

### 2. On peut ignorer la paume quand le stylet est actif sans bloquer le doigt — **OUI, avec une limite**

- iPadOS fait déjà une partie du travail : 139 contacts de paume annulés par le système (`pointercancel:touch`) pendant l'écriture au Metapen.
- Notre filtrage complète : 20 contacts ignorés en « Pendant le trait », 32 en « Session stylet ». **« Session stylet » est nettement meilleure** ; le doigt redevient actif après S secondes sans stylet.
- **Limite** : la paume posée **avant** le premier trait au stylet dessine (marque orange constatée), puisqu'aucun stylet n'a encore été vu. Seul un mode « Stylet » choisi explicitement l'évite.
- **Au doigt, aucune stratégie stylet n'agit** (iPad comme Pixel : des traits sous la paume dans tous les modes). L'option « Un seul doigt à la fois » en évite une partie, mais pas tout : la place se libère dès que le doigt se lève, et la paume encore posée qui touche un nouvel endroit dessine alors.
- Sur smartphone, poser la paume n'est pas un besoin (constat de l'utilisateur). Sur une tablette Android (Metapen probablement incompatible, donc doigt ou stylet passif), la paume redeviendra un problème : **non testé, pas d'appareil**.

### 3. Les gestes système sont neutralisables — **OUI, sauf les bords haut et bas**

- Protections activées : pincement bloqué (`gesturestart:bloqué` ×31 iPad), appui long / menu bloqué (`contextmenu:bloqué` Pixel), plus de sélection ni de double-tap zoom, pas de défilement.
- Protections désactivées : **app inutilisable** (sélection, double-tap, défilement, menu…).
- **Non bloquables** (système) : centre de notifications (glissé depuis le haut, iPad et Pixel) et barre d'accueil / dock (glissé depuis le bas, iPad ; Pixel non testé, navigation à 3 boutons).
- Aucun rechargement involontaire en PWA installée (pas de pull-to-refresh compté).

### 4. Le tracé est fluide — **OUI**

| Mesure                                  | iPad + Metapen | iPad doigt   | Pixel doigt   |
| --------------------------------------- | -------------- | ------------ | ------------- |
| Événements `pointermove` / s            | 62,5           | 70,6         | 132,3         |
| Points reçus / s (avec coalesced)       | 238,6          | 108,1        | 238,1         |
| Coalesced par `pointermove` (moyenne)   | 3,5            | 1,6          | 1,8           |
| Intervalle entre images (moyenne / p95) | 22,7 / 46 ms   | 19,6 / 34 ms | 8,9 / 16,6 ms |
| Événement → rendu (moyenne / p95)       | 6,1 / 21 ms    | 7,0 / 20 ms  | 6,0 / 10,3 ms |

- **Coalesced indispensable** : sur iPad, le stylet n'envoie que 60 événements/s, chacun regroupant 4 points. Sans coalesced, les traits rapides sont anguleux (constaté).
- Pixel 9a : écran 120 Hz, excellent.
- **À surveiller** : sur iPad, le p95 de l'intervalle entre images (34 à 46 ms) montre des images sautées ; la page de diagnostic rafraîchit ses panneaux texte à 10 Hz, à vérifier sur le moteur du MVP.
- **Défaut trouvé** : un simple appui ne dessinait rien (le canvas ignore les segments de longueur nulle) — impossible de faire le point du « i ». Corrigé en dessinant un disque ; à reprendre dans le moteur.

### 5. En PWA installée, le stockage peut être rendu persistant — **OUI**

- iPad (Safari standalone) : `persist()` accordé, `storagePersisted: true`.
- Pixel 9a (**Chrome**) : accordé. Dans **Brave**, refusé : Chrome est la cible Android.
- L'export manuel de la galerie reste prévu comme filet de sécurité.

## Décisions pour le MVP

### Mode de saisie : bouton « Stylet » / « Doigt » / « Multi doigts »

Idée de l'utilisateur, confirmée par les mesures :

- **Stylet** : seuls les `pen` dessinent, tout `touch` est ignoré. Règle aussi la paume posée avant le premier trait. Proposé automatiquement dès qu'un `pen` est détecté.
- **Doigt** (défaut sans stylet) : un seul contact dessine à la fois. À améliorer par rapport au diagnostic :
  - la place ne se libère que lorsque **plus aucun contact** ne touche l'écran, puis après un court délai (~300 ms, à régler) ;
  - **filtre de largeur** : ignorer les contacts trop larges (iPad : doigt ≈ 42–63 px, paume jusqu'à 292 px). Le Pixel ne remonte que de petites largeurs (≤ 61 px) : filtre inefficace sur Android. **Risque : les mains d'enfant sont plus petites**, l'écart doigt / paume se réduit. Seuil à mesurer avec un enfant, et filtre désactivable.
- **Multi doigts** : tous les contacts dessinent (plusieurs enfants, plusieurs doigts).

### Protections anti-gestes obligatoires (toujours actives sur l'écran de dessin)

`touch-action: none` ; `user-select: none` et `-webkit-user-select: none` ; `-webkit-touch-callout: none` ; `overscroll-behavior: none` ; viewport sans zoom (`maximum-scale=1, user-scalable=no`) ; `preventDefault` sur `contextmenu`, `selectstart`, `dblclick`, `gesturestart` ; `touchstart` / `touchmove` non passifs avec `preventDefault` sur la surface.

**Aucune commande près des bords haut et bas** de l'écran : ces glissés appartiennent au système.

### Autres règles

- **Coalesced events** obligatoires (avec repli si absents).
- **Ne jamais utiliser `pressure` ni `tilt`** : factices au Metapen, nulles au doigt sur iPad, variables au doigt sur Android (incohérent).
- **Un appui sans mouvement dessine un point.**
- **Mise à jour de la PWA** : rechercher une nouvelle version à chaque retour au premier plan (une PWA iOS reprend sans naviguer et restait bloquée sur l'ancienne version), plus un moyen manuel de forcer la mise à jour dans l'écran adulte.
- **Ne jamais se fier au user-agent** : Safari sur iPad se présente comme un Mac (`Macintosh`).
- Demander `navigator.storage.persist()` dans l'app installée (accordé sur les deux appareils de référence).
