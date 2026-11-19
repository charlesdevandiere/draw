# Notes de la campagne de mesure (T11)

Observations faites à l'écran pendant les tests, qui ne figurent pas dans les rapports JSON.

## iPad 11 + Metapen — `ipad11-metapen.json` (19/11/2026, version 79dcd82)

- PWA installée (standalone), persistance demandée → accordée.
- **Paume posée** : le Metapen « n'est pas toujours reconnu directement ». Nettement mieux en stratégie « Session stylet », mais le souci se produit aussi dans ce mode.
  - Cause confirmée : en « Session stylet », le souci résiduel survient au **premier trait**, avec une marque **orange** sous la paume. La paume touche l'écran avant le stylet et dessine (aucun stylet n'a encore été vu, donc rien n'est bloqué).
- **Coalesced events** : aucune différence visuelle perçue entre activé et désactivé.
- **Protections activées** : efficaces, sauf deux gestes non bloqués : centre de notifications (glissé depuis le haut) et dock / barre d'accueil (glissé depuis le bas).
- **Protections désactivées** : app inutilisable, trop d'actions système déclenchées.

## Pixel 9a

- Premier essai en PWA dans **Brave** : persistance **refusée**. Dans **Chrome**, persistance **accordée**. La suite de la campagne Android se fait dans Chrome, cible retenue (Brave écarté, comme pour les autres PWA de l'utilisateur).

### Pixel 9a au doigt — `pixel9a-doigt.json` (Chrome)

Étapes 0 à 3 et 5 au doigt. L'étape 4 (paume) a été faite au stylet à embout rond, sans réinitialiser : le rapport mélange doigt et stylet rond, tous deux vus comme `touch`.

- Le stylet passif est vu comme un doigt (`touch`) : aucune stratégie de palm rejection ne peut agir (0 contact ignoré).
- **Paume posée (étape 4)** : inexploitable, la paume gêne totalement. Mais sur smartphone, poser la paume n'est pas un besoin : c'est même contre-intuitif (à reconsidérer pour un téléphone pliant grand format). Sur une **tablette Android** en revanche (Metapen probablement incompatible, donc stylet passif ou doigt), la paume redeviendra un problème. Pas d'appareil pour tester.
- **Gestes (étape 2)** : comme sur iPad, protections efficaces avec les mêmes limites (glissé depuis le haut). Le glissé depuis le bas n'a pas pu être testé : navigation à 3 boutons.

## iPad 11 au doigt — `ipad11-doigt.json`

- **Paume posée** : la palm rejection ne sert à rien au doigt, des traits apparaissent sous la paume dans toutes les stratégies (elles ne filtrent que pendant l'activité d'un stylet).
  - Idée de l'utilisateur : un mode « non multipoint » qui laisse la priorité au trait commencé quand la paume se pose ensuite. → Ajouté à la page : option « Un seul doigt à la fois » (à mesurer).
- Le rapport ne contient aucun incident « protections désactivées » : étape 3 non faite (ou rien n'a été déclenché) pour cette configuration.

## Observations communes

- **Sans coalesced events, les traits rapides sont anguleux** (constaté après coup). Coalesced indispensable.
- **Impossible de faire un simple point** (point du `i`, du `!`), quels que soient l'outil et l'appareil : il faut faire un petit rond. Cause : le canvas ne peint pas un segment de longueur nulle. → Corrigé dans la page : un appui sans mouvement dessine un disque. À reprendre dans le moteur du MVP.
- **Idée pour l'app** : un bouton « mode » pour choisir « stylet », « doigt » ou « multi doigts ».

## Tests après ajouts (version 300d383 puis 71f767c)

- **Mise à jour sur iPad** : l'app installée restait bloquée sur l'ancienne version, même après suppression de l'icône et rafraîchissement dans Safari. → Ajout d'une recherche de mise à jour au retour au premier plan, et des boutons « Rechercher une mise à jour » et « Vider le cache et recharger ».
- **Point par simple appui** : fonctionne.
- **« Un seul doigt à la fois »** (doigt et stylet rond) : fonctionne, mais pas parfait. Des traits apparaissent encore sous la paume **quand on relève le doigt ou le stylet rond**. Évite quand même une partie des traits indésirables par rapport au multi doigts. Décision de l'utilisateur : **garder ce choix dans l'app**.
