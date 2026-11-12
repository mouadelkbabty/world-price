# Prixmonde

**Le même produit. Cinq pays. Le meilleur prix.**

Prixmonde compare le prix d'un même article entre les sites français, allemand,
italien, espagnol et britannique d'une même enseigne, et met en avant le moins
cher. Interface en français et en anglais, thème clair/sombre automatique.

*Same product, five countries, best price — a small web app that compares one
item across a retailer's FR, DE, IT, ES and UK sites. French and English UI.*

## Lancer l'app

Node.js 20 ou plus, aucune dépendance à installer.

```bash
npm start
```

Puis ouvrir <http://localhost:3000>.

```bash
npm test
```

## Enseignes

| Enseigne | Données | Comment |
| --- | --- | --- |
| Amazon | Démo + liens directs | Collez un ASIN ou un lien Amazon : l'app ouvre la même fiche sur les cinq domaines. Les prix en direct demandent l'API officielle d'Amazon (Creators API, compte Partenaires) — pas encore branchée. |
| eBay | Démo, ou prix réels avec clés | API officielle *Browse*. Renseignez `EBAY_CLIENT_ID` et `EBAY_CLIENT_SECRET` (voir `.env.example`) puis `node --env-file=.env server.js`. |

Le mode démo utilise des produits génériques et des **prix fictifs** ; l'interface
l'indique toujours. L'app ne récupère pas les pages des marchands : elle ne passe
que par leurs API officielles.

## Structure

```
server.js               serveur HTTP + API JSON (/api/config, /api/search, /api/offer)
src/markets.js          les cinq marchés
src/fx.js               taux £ → € (BCE via frankfurter.dev, valeur de secours sinon)
src/demo.js             catalogue et prix de démonstration
src/providers/          une enseigne = un fichier (amazon.js, ebay.js)
public/                 interface (HTML, CSS, modules JS — sans étape de build)
test/                   tests (node --test)
```

Ajouter une enseigne : créer `src/providers/<nom>.js` avec `id`, `name`, `live`,
`markets`, `resolve()`, `search()` et `offer()`, puis l'enregistrer dans `server.js`.

## Limites

- Les prix n'incluent ni la livraison ni, pour le Royaume-Uni, les droits de douane.
- Le connecteur eBay n'a pas encore été testé avec de vraies clés.
- Projet indépendant, sans lien avec Amazon ni eBay.
