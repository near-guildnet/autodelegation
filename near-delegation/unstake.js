const nearAPI = require('near-api-js')
const path = require('path')
const fs = require("fs");
const fastCsv = require("fast-csv");
const args = require("args");

// const homedir = require("os").homedir();
// const CREDENTIALS_DIR = ".near-credentials";
// const credentialsPath = path.join(homedir, CREDENTIALS_DIR);
const credentialsPath = "/home/shardnet/near-delegation/key";

const statsFolder = "/home/shardnet/stats";
const TEST_ACCOUNT = "autodelegate";
var DEPOSIT_AMOUNT = "0.1";

const UPTIME_LIMIT = 60;
const COL_CHUNK = 3;

const near_unstake = async (network, amount) => {
    if(!network) network = "shardnet";
    if(amount) DEPOSIT_AMOUNT = parseInt(amount);

    var data = [];
    var pool_accounts = [];

    var row_index = 0;
    const options = {
        objectMode: true,
        delimiter: ",",
        quote: null,
        renameHeaders: false,
    };
    const date = new Date();
    // const readableStream = fs.createReadStream(statsFolder + `/validators_scoreboard_${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}.csv`);
    const readableStream = fs.createReadStream(`./unstake_list.csv`);
    
    fastCsv
    .parseStream(readableStream, options)
    .on("error", (error) => {
        console.log(error);
    })
    .on("data", (row) => {
        if(row_index > 0) data.push(row);
        row_index++;
    })
    .on("end", async() => {
        data.forEach(element => {
            pool_accounts.push(element[0].toString().replace('"', '').replace('"', ''));
        });

        console.log(pool_accounts);
        await unstake(pool_accounts, DEPOSIT_AMOUNT, network);
    });
}

const unstake = async (pool_accounts, amount, network) => {
    const { connect } = nearAPI;
    const date = new Date();
    var logs = "";
    const config = {
      networkId: network,
      keyStore: new nearAPI.keyStores.UnencryptedFileSystemKeyStore(credentialsPath),
      nodeUrl: `https://rpc.${network}.near.org`,
      walletUrl: `https://wallet.${network}.near.org`,
      helperUrl: `https://helper.${network}.near.org`,
      explorerUrl: `https://explorer.${network}.near.org`,
    };

    // connect to NEAR
    const near = await connect(config);
    const account = await near.account(`${TEST_ACCOUNT}.${network}.near`);

    for(let i = 0; i< pool_accounts.length; i++)
    {
        try{
            const contract = new nearAPI.Contract(
                account, // the account object that is connecting
                pool_accounts[i],
                {
                  // name of contract you're connecting to
                  changeMethods: ["unstake"], // change methods modify state
                  sender: account, // account object to initialize and sign transactions.
                }
              );
        
            // console.log(contract);
            const gasBigInt = BigInt(30_000_000_000_000);  // `10n` also works
            const gas = Number(gasBigInt);
         
            const depositAmount = nearAPI.utils.format.parseNearAmount(amount.toString());
            const result = await contract.unstake(
                {
                    "amount": depositAmount
                },
                gas,
            );
            console.log(`unstake successfully: \n${result}`);
            logs += `unstake successfully for ${pool_accounts[i]}\n`;
        } catch(error) {
            console.log(`unstake failed.`);
            logs += `unstake failed for ${pool_accounts[i]}: \n${error}`; + '\n';
        }

        fs.writeFileSync(
            path.join("/home/shardnet/near-delegation/log", `unstake_logs_${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}.csv`),
            logs
          );
    }
}

args
  .option('network', 'Used in check rpc, example shardnet or testnet, you can also use "f". \n example: --network')
  .option('amount', 'Delegation amount. \n example: --amount')

const flags = args.parse(process.argv)

near_unstake(flags.network, flags.amount);