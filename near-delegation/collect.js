const axios = require("axios");
const fs = require("fs");
const process = require("process");
const args = require("args");

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || `https://archival-rpc.shardnet.near.org`;

async function getValidators(url, blockHeight) {
  const { data } = await axios.post(url, {
    jsonrpc: "2.0",
    id: "dontcare",
    method: "validators",
    params: [blockHeight],
  });
  if (
    !data ||
    (!data.error && (!data.result || !data.result.epoch_start_height))
  ) {
    throw Error(`Unknown API response: ${data}`);
  }
  return data;
}

async function getEpochStart(url, blockHeight) {
  try {
    const response = await getValidators(url, blockHeight || null);
    if (response.error) {
      //console.log(response.error);
      throw Error(response.error);
    }
    console.log('response.result', JSON.stringify(response.result));
    const { epoch_start_height: epochStartHeight } = response.result;
    return epochStartHeight;
  } catch (error) {
    console.log("error: ", error);
    throw error;
  }
}

async function fetchValidationStats(url, blockHeight, findEpoch) {
  if (!blockHeight) {
    blockHeight = (await getEpochStart(url)) - 1;
  }
  if (findEpoch && blockHeight) {
    blockHeight = (await getEpochStart(url, blockHeight)) - 1;
  }
  while (true) {
    console.log(
      "Trying to fetch validation stats for the block #",
      blockHeight
    );
    const currentValidators = await getValidators(url, blockHeight);
    if (currentValidators.result) {
      return {
        blockHeight,
        validators: currentValidators.result.current_validators,
      };
    }
    --blockHeight;
  }
}

function writeFile({ blockHeight, validators }) {
  const jsonData = JSON.stringify(validators, null, 2);
  try {
    fs.mkdirSync("stats");
  } catch {}
  fs.writeFileSync(`stats/${blockHeight}.json`, jsonData);
  console.log("Saved validation stats as of block #", blockHeight);
}

async function fetchValidationStats(url, blockHeight, findEpoch) {
    if (!blockHeight) {
      blockHeight = (await getEpochStart(url)) - 1;
    }
    if (findEpoch && blockHeight) {
      blockHeight = (await getEpochStart(url, blockHeight)) - 1;
    }
    while (true) {
      console.log(
        "Trying to fetch validation stats for the block #",
        blockHeight
      );
      const currentValidators = await getValidators(url, blockHeight);
      if (currentValidators.result) {
        return {
          blockHeight,
          validators: currentValidators.result.current_validators,
        };
      }
      --blockHeight;
    }
  }

  async function getEpochStart(url, blockHeight) {
    try {
      const response = await getValidators(url, blockHeight || null);
      if (response.error) {
        //console.log(response.error);
        throw Error(response.error);
      }
      console.log('response.result', JSON.stringify(response.result));
      const { epoch_start_height: epochStartHeight } = response.result;
      return epochStartHeight;
    } catch (error) {
      console.log("error: ", error);
      throw error;
    }
  }
  
const fetchHistoricalValidationStats = async (url, blockHeight) => 
{
  while (true) {
    const validationStats = await fetchValidationStats(url, blockHeight);
    writeFile(validationStats);
    blockHeight = (await getEpochStart(url, validationStats.blockHeight)) - 1;
  }
}

// args
//   .option('block_height', 'The block height to retrieve historical data, you can also use "b". \n example: --block_height 24042142')
//   .option('find_epoch', 'Used in conjunction with block_height, will look for epoch data, you can also use "f". \n example: --find_epoch')

// const flags = args.parse(process.argv)

// if (flags.blockHeight) {
//   console.log(`Starting historical on block # ${flags.blockHeight}`);
// }

// fetchValidationStats(NEAR_RPC_URL, flags.blockHeight, flags.findEpoch).then(writeFile);
// fetchHistoricalValidationStats(NEAR_RPC_URL);

// const delayInterval = setInterval(sendData, 2000);

// module.exports = fetchHistoricalValidationStats;