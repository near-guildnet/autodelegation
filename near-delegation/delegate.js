const nearAPI = require('near-api-js')
const path = require('path')
const fs = require("fs");
const fastCsv = require("fast-csv");
const args = require("args");
const axios = require('axios');
const saveValidatorsScoreCSV = require("./scoreboard");

// const homedir = require("os").homedir();
// const CREDENTIALS_DIR = ".near-credentials";
// const credentialsPath = path.join(homedir, CREDENTIALS_DIR);
const credentialsPath = "/home/shardnet/near-delegation/key";

const statsFolder = "/home/shardnet/stats";
const TEST_ACCOUNT = "autodelegate";
var DEPOSIT_AMOUNT = "0.1";

const UPTIME_LIMIT = 60;
const COL_CHUNK = 3;

var CURRENT_STAKE_AMOUNT_LIMIT = 0;
var current_validators = [];



const near_delegation = async(network, amount, limit) => {
    console.log("Start save validation stats");
    if(!network) network = "shardnet";
    if(amount) DEPOSIT_AMOUNT = parseInt(amount);
    if(limit) CURRENT_STAKE_AMOUNT_LIMIT = parseInt(limit);

    await saveValidatorsScoreCSV(statsFolder).then((result) => {
        read_csv(network, amount);
    });
}

const read_csv = async (network) => {
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
    const readableStream = fs.createReadStream(statsFolder + `/validators_scoreboard_${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}.csv`);
    
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
            if(element[COL_CHUNK] > UPTIME_LIMIT){
                pool_accounts.push(element[0].toString().replace('"', '').replace('"', ''));
            }
        });

        console.log(pool_accounts);
        await delegate(pool_accounts, DEPOSIT_AMOUNT, network);
    });
}

const delegate = async (pool_accounts, amount, network) => {
    var logs = 'Deposit failed for :\n';
    current_validators = await get_validators(network);
    console.log(current_validators);
    const date = new Date();
    // console.log("credentialsPath", credentialsPath);
    const { connect } = nearAPI;
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
        var current_stake = 0;
        for(let l = 0; l < current_validators.length; l++)
        {
            if(current_validators[l].account_id == pool_accounts[i])
            {
                current_stake = current_validators[l].stake
            }
        }
        
        console.log(`${pool_accounts[i]} current stake amount ${current_stake}`);

        if(CURRENT_STAKE_AMOUNT_LIMIT == 0 || 
            CURRENT_STAKE_AMOUNT_LIMIT > 0 && current_stake < CURRENT_STAKE_AMOUNT_LIMIT * Math.pow(10, 24))
        {
            try{
                const contract = new nearAPI.Contract(
                    account, // the account object that is connecting
                    pool_accounts[i],
                    {
                      // name of contract you're connecting to
                      changeMethods: ["deposit_and_stake"], // change methods modify state
                      sender: account, // account object to initialize and sign transactions.
                    }
                  );
            
                // console.log(contract);
                const gasBigInt = BigInt(30_000_000_000_000);  // `10n` also works
                const gas = Number(gasBigInt);
             
                const depositAmount = nearAPI.utils.format.parseNearAmount(amount.toString());
                const result = await contract.deposit_and_stake(
                    {},
                    gas,
                    depositAmount
                );
                console.log(`deposit successfully to ${pool_accounts[i]}: \n${result}`);
            } catch(error) {
                console.log(`deposit failed to ${pool_accounts[i]}.`);
                logs += pool_accounts[i] + '\n';
            }
        }
    }

    fs.writeFileSync(
        path.join("/home/shardnet/near-delegation/log", `logs_${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}.csv`),
        logs
      );
}

const get_validators = async(network) => {
    const { data } = await axios.post(`https://rpc.${network}.near.org`, {
        jsonrpc: "2.0",
        id: "dontcare",
        method: "validators",
        params: [null],
      });
      if (
        !data ||
        (!data.error && (!data.result || !data.result.epoch_start_height))
      ) {
        throw Error(`Unknown API response: ${data}`);
      }

    return data.result.current_validators;
}

args
  .option('network', 'Used in check rpc, example shardnet or testnet, you can also use "f". \n example: --network')
  .option('amount', 'Delegation amount. \n example: --amount')
  .option('limit', 'Limit current stake amount. \n example: --limit')

const flags = args.parse(process.argv)

near_delegation(flags.network, flags.amount, flags.limit);