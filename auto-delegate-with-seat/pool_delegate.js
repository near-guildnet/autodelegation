const nearAPI = require('near-api-js');
const { validators } = require('near-api-js');
const args = require("args");
const axios = require('axios');
const fs = require("fs");
const HTMLParser = require('node-html-parser');
const cron = require('node-cron');
const {Octokit} = require("@octokit/rest");

const credentialsPath = "/home/shardnet/near-delegation/key";

// const credentialsPath = "./key";
const TEST_ACCOUNT = "autodelegate";
const network = "shardnet";
const NEAR_RPC_URL = process.env.NEAR_RPC_URL || `https://rpc.shardnet.near.org`;
const TOKEN = "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";
const TITLE = "Update draft-delegation.md";
const DIR = "/home/shardnet/auto-delegate-with-seat";
// const TITLE = "Add new pool juju_pool";


const get_pull_id = async() => {
  const octokit = new Octokit({
    auth: TOKEN,
    timeZone: 'Europe/Amsterdam',
    baseUrl: 'https://api.github.com',
  })
  
  const response = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
    owner: 'near',
    repo: 'stakewars-iii',
  });
  
  const pulls = response.data;

  for(let i = 0; i < pulls.length; i++) {
    const pull = pulls[pulls.length - i - 1];
    if(pull.title == TITLE)
    {
      const pull_id_lastest = fs.readFileSync(`${DIR}/pull_id.txt`).toString();
      if(parseInt(pull.number) > parseInt(pull_id_lastest))
      {
        console.log(pull.number, pull_id_lastest);
        near_delegation(pull.number);
        fs.writeFileSync(`${DIR}/pull_id.txt`, pull.number.toString());
      }
    }
  }
}

const near_delegation = async(pull_id) => {
    const returns = await axios.get(`https://github.com/near/stakewars-iii/pull/${pull_id}/files`);
    var root = HTMLParser.parse(returns.data);
    var spans = root.getElementsByTagName("span");
    var pool_id = "";
    spans.forEach(span => {
        if(span.rawAttrs == `class='blob-code-inner blob-code-marker js-code-nav-pass ' data-code-marker="+"`)
        {
            if(span.childNodes.length >= 3)
            {
                if(span.childNodes[0].rawText == "POOL_ID: " && span.childNodes[1].childNodes.length >= 1)
                {
                    pool_id += span.childNodes[1].childNodes[0].rawText;
                    pool_id += span.childNodes[2].rawText;
                }
            }
            console.log(pool_id);
        }
    });

    const result = await get_validators();
    if(result)
    {
        let SeatPrice = validators.findSeatPrice(result.current_validators, result.numSeats);
        console.log(parseInt(SeatPrice) / Math.pow(10, 24));
        await delegate(pool_id, (parseInt(SeatPrice) / Math.pow(10, 24)) + 10);
    }
}

const get_validators = async() => {
    const { data } = await axios.post(NEAR_RPC_URL, {
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

    return data.result;
}

const delegate = async (pool_account, amount) => {
  const logs = fs.readFileSync(`${DIR}/log.txt`); 
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

    try{
        const contract = new nearAPI.Contract(
            account, // the account object that is connecting
            pool_account,
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
        logs += `deposit to ${pool_account} ${amount} NEAR successfully: ${result}\n\n`
        console.log(`deposit successfully: \n${result}`);
    } catch(error) {
        logs += `deposit to ${pool_account} ${amount} NEAR failed: ${result}\n\n`
        console.log(`deposit failed: ${error}`);
    }

    fs.writeFileSync(`${DIR}/log.txt`, logs);
}

// cron.schedule('0 0 * * *', () => {
//   get_pull_id();
//   console.log('running a task everyday');
// });

get_pull_id();