import { revalidate } from "@bouygues-telecom/staticjs/dist/scripts/revalidate.js";
import express from "express";

const app = express();
app.use(express.json());
app.use(express.static("dist"));
const PORT = process.env.PORT || 3000;

app.post("/revalidate", revalidate);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
