<div align='center'>

# React-power-static

**To build react static project**

</div>

---

## Utilisation du package

```shell
npm install -g @bytel/react-power-static
# Démarrage
create-react-power-static
```

- npm i
- npm run build
- try => test.html (navigator)

## Revalidate

curl -X POST http://localhost:3000/revalidate

curl -X POST http://localhost:3000/revalidate \
-H "Content-Type: application/json" \
-d '{
"paths": ["page3/page3.tsx"]
}'
