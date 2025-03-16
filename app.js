const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;


app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());


// Root route
app.get("/", (req, res) => {
  res.send("M-Pesa STK PUSH");
});


// Import Route(s)
const routes = require("./routes");


// Use Routes
app.use("/api/", routes);


// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
