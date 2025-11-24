// server.js

console.log("Server booting…");

const express = require("express");          // <-- require first
const cors = require("cors");
const multer = require("multer");
const { convertTcxToTtl } = require("./convert");
const app = express();
app.use(cors({ origin: true }));             // or your exact frontend origin
const upload = multer({ storage: multer.memoryStorage() });

app.post("/convert", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const original = req.file.originalname || "workout.tcx";

  //change this
  if (!/\.tcx$/i.test(original)) return res.status(400).send("Only .tcx files allowed");

  const tcxText = req.file.buffer.toString("utf-8");
  const ttlText = await convertTcxToTtl(tcxText);

  const outputFileName = original.replace(/\.tcx$/i, ".ttl");
  res.setHeader("Content-Type", "text/turtle; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${outputFileName}"`);
  res.send(ttlText);
});

const PORT = 3001;                             // <-- use 3001
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
