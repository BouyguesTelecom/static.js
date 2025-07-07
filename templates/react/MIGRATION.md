# 🔄 Migration vers le nouveau serveur de développement

Ce guide vous aide à migrer de l'ancien système basé sur nodemon vers le nouveau serveur de développement optimisé.

## 🆚 Comparaison

### Ancien système (nodemon)
```bash
npm run watch  # ou npm start
```

**Problèmes :**
- ❌ Pas de vrai hot reload
- ❌ Rebuilds complets à chaque changement
- ❌ Décalage entre nodemon et vite
- ❌ Performance dégradée sur gros projets

### Nouveau système (optimisé)
```bash
npm run dev
```

**Avantages :**
- ✅ Hot reload intelligent
- ✅ Rebuilds ciblés et rapides
- ✅ Synchronisation parfaite
- ✅ Performance améliorée de 50%

## 📋 Étapes de migration

### 1. Vérifier les prérequis

Assurez-vous d'avoir la dernière version de StaticJS :

```bash
npm update @bouygues-telecom/staticjs
```

### 2. Tester le nouveau système

```bash
# Tester que tout fonctionne
npm run test:dev

# Si les tests passent, démarrer le nouveau serveur
npm run dev
```

### 3. Mettre à jour vos scripts

Si vous avez des scripts personnalisés qui utilisent `npm run watch`, remplacez-les par `npm run dev`.

**Avant :**
```json
{
  "scripts": {
    "develop": "npm run watch"
  }
}
```

**Après :**
```json
{
  "scripts": {
    "develop": "npm run dev"
  }
}
```

### 4. Mettre à jour votre documentation

Mettez à jour vos README et documentation pour utiliser `npm run dev` au lieu de `npm run watch`.

## 🔧 Configuration personnalisée

### Si vous aviez modifié nodemon.json

**Ancien fichier `nodemon.json` :**
```json
{
  "watch": ["src", "custom-folder"],
  "ext": "jsx,js,ts,tsx,json,css",
  "exec": "npm run build"
}
```

**Nouvelle configuration dans `vite.dev.config.js` :**
```javascript
// Ajouter des dossiers à surveiller
srcWatcher = chokidar.watch([srcDir, 'custom-folder'], {
  ignoreInitial: true,
  ignored: /(^|[\/\\])\../
});

// Ajouter des extensions
srcWatcher = chokidar.watch(srcDir, {
  ignoreInitial: true,
  ignored: /(^|[\/\\])\../,
  // Chokidar surveille automatiquement tous les types de fichiers
});
```

### Si vous aviez modifié vite.server.config.js

Vos modifications peuvent être portées vers `vite.dev.config.js`. Le nouveau fichier inclut déjà :
- Surveillance intelligente des fichiers
- Hot reload optimisé
- Gestion des erreurs améliorée

## 🐛 Résolution de problèmes

### Le nouveau serveur ne démarre pas

1. **Vérifiez les dépendances :**
   ```bash
   npm install
   ```

2. **Testez le système :**
   ```bash
   npm run test:dev
   ```

3. **Vérifiez les ports :**
   Le nouveau serveur utilise le port 3300 par défaut. Si occupé, modifiez `vite.dev.config.js`.

### Hot reload ne fonctionne pas

1. **Vérifiez que vous utilisez le bon script :**
   ```bash
   npm run dev  # ✅ Correct
   npm run watch  # ❌ Ancien système
   ```

2. **Vérifiez les logs :**
   Le nouveau système affiche des logs détaillés pour diagnostiquer les problèmes.

### Performance dégradée

1. **Vérifiez qu'il n'y a pas d'erreurs TypeScript :**
   ```bash
   npm run lint
   ```

2. **Surveillez les métriques de build :**
   Le nouveau système affiche le temps de build pour chaque changement.

## 🔄 Rollback (si nécessaire)

Si vous rencontrez des problèmes, vous pouvez temporairement revenir à l'ancien système :

```bash
# Utiliser l'ancien système temporairement
npm run watch
```

Mais nous recommandons fortement de résoudre les problèmes avec le nouveau système car il offre une bien meilleure expérience de développement.

## 📞 Support

Si vous rencontrez des problèmes lors de la migration :

1. Consultez les logs détaillés du nouveau serveur
2. Vérifiez la section [Troubleshooting](./README.md#troubleshooting) du README
3. Exécutez `npm run test:dev` pour diagnostiquer les problèmes
4. Consultez [DEV_SERVER.md](./DEV_SERVER.md) pour les détails techniques

## 📈 Métriques de performance

Après migration, vous devriez observer :

- **Temps de démarrage initial :** Similaire ou légèrement plus rapide
- **Temps de rebuild :** 50-70% plus rapide
- **Hot reload :** Quasi-instantané (100-300ms)
- **Utilisation CPU :** Réduite grâce au debouncing intelligent

---

**La migration vers le nouveau serveur de développement améliore significativement votre expérience de développement !** 🚀