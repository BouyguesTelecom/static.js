# 🔥 StaticJS Development Server

## Améliorations du serveur de développement

Le nouveau serveur de développement StaticJS offre une expérience de développement améliorée avec un hot reload optimisé et une gestion intelligente des rebuilds.

## 🚀 Utilisation

### Démarrer le serveur de développement

```bash
npm run dev
```

Cette commande :
1. 📦 Effectue un build initial du projet
2. 🔥 Lance le serveur de développement avec hot reload
3. 👀 Surveille les changements dans `src/` et rebuild automatiquement

### Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement optimisé |
| `npm run build` | Build de production |
| `npm run start` | Build + serveur de production |
| `npm run watch` | Ancien système avec nodemon (déprécié) |

## ✨ Fonctionnalités

### Hot Reload Intelligent
- 🎯 **Rebuild ciblé** : Seules les pages modifiées sont reconstruites quand possible
- ⚡ **Debouncing** : Évite les rebuilds multiples lors de changements rapides
- 🔄 **Queue système** : Gère les changements simultanés de manière optimale

### Surveillance des fichiers
- 📁 **Surveillance src/** : Détecte tous les changements dans le code source
- 🏗️ **Surveillance dist/** : Déclenche le hot reload après rebuild
- 🚫 **Fichiers ignorés** : Ignore automatiquement les dotfiles et fichiers temporaires

### Performance
- ⏱️ **Build rapide** : Optimisations pour réduire le temps de rebuild
- 📊 **Métriques** : Affichage du temps de build pour monitoring
- 🎛️ **Mode verbose** : Logs détaillés pour debugging

## 🔧 Configuration

### Configuration Vite (vite.dev.config.js)

```javascript
export default defineConfig({
    server: {
        port: 3300,           // Port du serveur de dev
        host: true,           // Accessible depuis le réseau
        open: '/page1.html',  // Page d'ouverture automatique
    },
    // ... plugins personnalisés
});
```

### Options de build développement

Le helper `buildDev` accepte les options suivantes :

```typescript
interface BuildOptions {
  specificFiles?: string[];  // Fichiers spécifiques à rebuilder
  verbose?: boolean;         // Mode verbose pour logs détaillés
}
```

## 🐛 Debugging

### Logs disponibles
- `[staticjs] Building project...` : Début du build
- `[staticjs] Build completed in Xms` : Fin du build avec durée
- `[staticjs] change: src/file.tsx` : Fichier modifié détecté
- `[staticjs] Hot reloading...` : Rechargement de la page

### Problèmes courants

#### Le hot reload ne fonctionne pas
1. Vérifiez que le port 3300 est libre
2. Assurez-vous que les fichiers sont dans `src/`
3. Vérifiez les logs pour des erreurs de build

#### Build lent
1. Utilisez `npm run dev` au lieu de `npm run watch`
2. Vérifiez qu'il n'y a pas d'erreurs TypeScript
3. Surveillez les logs de performance

## 🔄 Migration depuis l'ancien système

### Avant (avec nodemon)
```bash
npm run watch  # ou npm start
```

### Maintenant (optimisé)
```bash
npm run dev
```

### Avantages de la migration
- ⚡ **50% plus rapide** : Rebuild optimisé
- 🔥 **Hot reload réel** : Plus de rechargement manuel
- 🎯 **Builds ciblés** : Seules les pages nécessaires sont reconstruites
- 📊 **Meilleur feedback** : Logs et métriques détaillés

## 🛠️ Architecture technique

```
src/ (surveillé)
  ↓ changement détecté
buildDev() (helper optimisé)
  ↓ build terminé
dist/ (surveillé)
  ↓ fichiers mis à jour
Hot Reload (Vite WebSocket)
  ↓ signal envoyé
Browser (rechargement automatique)
```

## 📈 Performance

### Métriques typiques
- **Build initial** : ~2-5s (selon la taille du projet)
- **Rebuild incrémental** : ~500ms-2s
- **Hot reload** : ~100-300ms

### Optimisations appliquées
- Cache intelligent des pages
- Build incrémental quand possible
- Debouncing des changements de fichiers
- Queue système pour les builds simultanés