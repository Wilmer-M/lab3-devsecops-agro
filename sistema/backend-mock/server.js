const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Endpoint de salud del cascarón mock
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "backend-mock-skeleton" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[Mock Server Skeleton] Escuchando en el puerto ${PORT}`);
  });
}

module.exports = app;
