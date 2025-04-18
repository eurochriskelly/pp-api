const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const tournamentRoutes = require("./routes/tournaments");
const fixtureRoutes = require("./routes/fixtures");
const regionRoutes = require("./routes/regions");
const generalRoutes = require("./routes/general");
const authRoutes = require("./routes/auth");

const app = express();
app.use(bodyParser.json());

module.exports = (db, ARGS) => {
  console.log("Setting up API endpoints ...");
  app.use(morgan('dev'));
  app.use(express.static(ARGS.staticPath));

  // Direct endpoint (unchanged)
  app.post("/api/upload", (req, res) => {
    parseFormData(req, res, (filePath) => {
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          console.error("Error reading file:", err);
          return res.status(500).send("Error reading file");
        }
        console.log("File contents:", data);
        res.send("File received and contents logged.");
      });
    });
  });

  app.use("/api/tournaments", tournamentRoutes(db));
  app.use("/api/tournaments/:tournamentId/fixtures", fixtureRoutes(db));
  app.use("/api/regions", regionRoutes(db));
  app.use("/api", generalRoutes(db));
  app.use("/api/auth", authRoutes(db));

  app.get("*", (req, res) => {
    console.log(`Catch-all triggered: Requested path -> ${req.path}`);
    console.log(`Serving [${ARGS.staticPath}]`);  
    res.sendFile(ARGS.staticPath + "/index.html");
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  });

  const { port } = ARGS;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

function parseFormData(req, res, callback) {
  const boundary = req.headers["content-type"].split("boundary=")[1];
  let data = "";
  req.on("data", (chunk) => data += chunk.toString());
  req.on("end", () => {
    const parts = data.split("--" + boundary);
    parts.forEach((part) => {
      if (part.includes("Content-Disposition")) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          const filename = filenameMatch[1];
          const fileContent = part.split("\r\n\r\n")[1].split("\r\n--")[0];
          const filePath = path.join(__dirname, "uploads", filename);
          fs.writeFileSync(filePath, fileContent);
          callback(filePath);
        }
      }
    });
  });
}
