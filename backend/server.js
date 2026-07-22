const { createApp } = require("./src/app");
const { config } = require("./src/config");

const app = createApp();
app.listen(config.port, () => {
  console.log(`certverify backend listening on http://localhost:${config.port}`);
  console.log(`  RPC:      ${config.rpcUrl}`);
  console.log(`  contract: ${config.contractAddress || "(CONTRACT_ADDRESS not set)"}`);
});
