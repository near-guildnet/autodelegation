NODE SCRIPT FOR NEAR DELEGATION

npx node delegate --network <network_id>

example: npx node delegate --network shardnet

network_id: The name of near chain. \n example --network shardnet or testnet

*transactions json and scoreboard csv file save in ../stats
*key file is loaded from ./key if wanna to change, replace credentialsPath with following code.

<!-- const homedir = require("os").homedir();
const CREDENTIALS_DIR = ".near-credentials";
const credentialsPath = path.join(homedir, CREDENTIALS_DIR); -->