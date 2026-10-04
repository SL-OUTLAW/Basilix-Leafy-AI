const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const outputDirectory = path.resolve(
  process.argv[2] || "../../secrets"
);

fs.mkdirSync(outputDirectory, {
  recursive: true
});

const { privateKey, publicKey } = crypto.generateKeyPairSync(
  "ed25519",
  {
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    }
  }
);

fs.writeFileSync(
  path.join(outputDirectory, "webapp_backend_private_key"),
  privateKey,
  {
    mode: 0o600
  }
);

fs.writeFileSync(
  path.join(outputDirectory, "webapp_backend_public_key"),
  publicKey,
  {
    mode: 0o644
  }
);

console.log(
  `Created Engine service keys in ${outputDirectory}`
);
