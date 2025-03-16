const WHITELISTED_IPS = [
  "196.201.214.200",
  "196.201.214.206",
  "196.201.213.114",
  "196.201.214.207",
  "196.201.214.208",
  "196. 201.213.44",
  "196.201.212.127",
  "196.201.212.138",
  "196.201.212.129",
  "196.201.212.136",
  "196.201.212.74",
  "196.201.212.69",
];

// Middleware to check if request IP which to receive callback from is from Safaricom
function ipWhitelist(req, res, next) {
  try {
    const requestIP =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    if (WHITELISTED_IPS.includes(requestIP)) {
      console.log(`Allowed IP: ${requestIP}`);
      next(); // Allow request to continue
    } else {
      console.warn(`Blocked request from ${requestIP}`);
      return res.status(403).json({ error: "Unauthorized" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = ipWhitelist;
