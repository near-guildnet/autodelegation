const fs = require("fs");
const path = require("path");

const filterNodes = [
  "boot1.near",
  "boot2.near",
  "boot3.near",
  "boot4.near",
];

const LAST_EPOCHS = 80;


async function getAllNodes(statsFolder) {
  const dir = await fs.promises.opendir(statsFolder);
  const validatorsIds = new Set();

  for await (const statsFile of dir) {
    if (!statsFile.isFile() || !statsFile.name.match(/^\d+\.json/)) {
      continue;
    }

    // Get all validators from files
    const epochValidatorsStats = JSON
      .parse(fs.readFileSync(path.join(statsFolder, statsFile.name)))
      .filter(epochValidatorStats => !filterNodes.includes(epochValidatorStats.account_id));

    for (const epochValidatorStats of epochValidatorsStats) {
      validatorsIds.add(epochValidatorStats.account_id)
    }
  }

  return Array.from(validatorsIds).sort();
}

async function getValidatorsCreationDate(statsFolder) {
  const dir = await fs.promises.opendir(statsFolder);

  const creationDates = new Map();

  for await (const statsFile of dir) {
    if (!statsFile.isFile() || !statsFile.name.match(/^\d+\.json/)) {
      continue;
    }

    // Calculate validators in epoch (epoch block stats)
    const epochValidatorsStats = JSON
      .parse(fs.readFileSync(path.join(statsFolder, statsFile.name)))
      .filter(epochValidatorStats => !filterNodes.includes(epochValidatorStats.account_id));

    const fileStat = fs.statSync(path.join(statsFolder, statsFile.name));
    const fileModificationDate = fileStat.mtimeMs;
    // const fileModificationDate = new Date(fileStat.mtimeMs);

    for (const epochValidatorStats of epochValidatorsStats) {
      const accountId = epochValidatorStats.account_id;

      if (!creationDates.has(accountId) || fileModificationDate < creationDates.get(accountId)) {
        creationDates.set(accountId, fileModificationDate);
      }
    }
  }
  
  return creationDates;
  // return Array.from(creationDates).sort();
}

async function aggregateValidatorsScoreboard(statsFolder, nodesWhitelist, nodesCreation) {
  var count = 0;
  const dir = await fs.promises.opendir(statsFolder);



  const validatorsStatsOrder = new Map();
  for await (const statsFile of dir)
  {
    if (!statsFile.isFile() || !statsFile.name.match(/^\d+\.json/)) {
      continue;
    }

    // Calculate validators in epoch (epoch block stats)
    const epochValidatorsStats = JSON
    .parse(fs.readFileSync(path.join(statsFolder, statsFile.name)))
    .filter(epochValidatorStats => !filterNodes.includes(epochValidatorStats.account_id));
  
    const fileStat = fs.statSync(path.join(statsFolder, statsFile.name));
    const fileModificationTs = fileStat.mtimeMs;

    validatorsStatsOrder.set(fileModificationTs, statsFile.name);
  }

  var sort = Array.from(validatorsStatsOrder).sort();
  const validatorsStats = new Map();
  for(var index = 0; index < sort.length; index++)
  {
    var statfileName = sort[sort.length - index - 1][1];
        if(count >= LAST_EPOCHS) break;

    // Calculate validators in epoch (epoch block stats)
    const epochValidatorsStats = JSON
      .parse(fs.readFileSync(path.join(statsFolder, statfileName)))
      .filter(epochValidatorStats => !filterNodes.includes(epochValidatorStats.account_id));

    const fileStat = fs.statSync(path.join(statsFolder, statfileName));
    const fileModificationTs = fileStat.mtimeMs;

    console.log(`Reading ${count + 1}th file, fileModificationTs: ${fileModificationTs}`)

    for (const epochValidatorStats of epochValidatorsStats) {
      const validatorStats = validatorsStats.get(epochValidatorStats.account_id);
      const num_produced_blocks =
        epochValidatorStats.num_produced_blocks + ((validatorStats || {}).num_produced_blocks || 0);
      const num_expected_blocks =
        epochValidatorStats.num_expected_blocks + ((validatorStats || {}).num_expected_blocks || 0);
      const num_produced_chunks =
        epochValidatorStats.num_produced_chunks + ((validatorStats || {}).num_produced_chunks || 0);
      const num_expected_chunks =
        epochValidatorStats.num_expected_chunks + ((validatorStats || {}).num_expected_chunks || 0);
      const num_missed_epochs = ((validatorStats || {}).num_missed_epochs || 0);
      const num_validated_epochs = (epochValidatorStats.num_produced_chunks > 0) ? 1 + ((validatorStats || {}).num_validated_epochs || 0) : ((validatorStats || {}).num_validated_epochs || 0);
      const num_total_epochs = 1 + ((validatorStats || {}).num_validated_epochs || 0);

      let percentEpochMissed = ((validatorStats || {}).num_missed_epochs >= (validatorStats || {}).num_total_epochs) ? 0 : ((validatorStats || {}).num_validated_epochs === (validatorStats || {}).num_total_epochs) ? 1 : ( (validatorStats || {}).num_missed_epochs / (validatorStats || {}).num_total_epochs)

      const percent_chunks_produced = (((validatorStats || {}).num_produced_chunks / (validatorStats || {}).num_expected_chunks) * percentEpochMissed * 100).toFixed(2)


      validatorsStats.set(
        epochValidatorStats.account_id,
          { num_produced_blocks, num_expected_blocks, num_produced_chunks, num_expected_chunks, percent_chunks_produced, num_missed_epochs, num_validated_epochs, num_total_epochs }
      );
    }

    // Calculate validators not in epoch (missed epoch)
    const validatorsInEpoch = epochValidatorsStats.map(validator => validator.account_id);
    const validatorsNotInEpoch = nodesWhitelist.filter(accountId => !validatorsInEpoch.includes(accountId));
    const validatorsInEpoch2 = nodesWhitelist.filter(accountId => validatorsInEpoch.includes(accountId));


    for (const validatorNotInEpochId of validatorsNotInEpoch) {
      const validatorStats = validatorsStats.get(validatorNotInEpochId);

      let numMissedEpochs = (validatorStats || {}).num_missed_epochs || 0


      if (fileModificationTs >= nodesCreation.get(validatorNotInEpochId)) {
        numMissedEpochs++;
      }

      validatorsStats.set(validatorNotInEpochId, {
        num_produced_blocks: ((validatorStats || {}).num_produced_blocks || 0),
        num_expected_blocks: ((validatorStats || {}).num_expected_blocks || 0),
        num_produced_chunks: ((validatorStats || {}).num_produced_chunks || 0),
        num_expected_chunks: ((validatorStats || {}).num_expected_chunks || 0),
        num_missed_epochs: numMissedEpochs,
        num_validated_epochs: ((validatorStats || {}).num_validated_epochs || 0),
        num_total_epochs: ((validatorStats || {}).num_validated_epochs + numMissedEpochs || 0)
      });
    }

    count++;
  }

  const validatorsScoreboard = [...validatorsStats.entries()];
  validatorsScoreboard.sort(([_1, validatorStats1], [_2, validatorStats2]) =>
    validatorStats2.percent_chunks_produced - validatorStats1.percent_chunks_produced
  );

  const date = new Date();

  fs.writeFileSync(
    path.join(statsFolder, `validators_scoreboard_${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}.json`),
    JSON.stringify(
      validatorsScoreboard.map(
        ([account_id, { num_produced_blocks, num_expected_blocks, num_produced_chunks, num_expected_chunks, percent_chunks_produced, num_missed_epochs, num_validated_epochs }]) => (
          { account_id, num_expected_blocks, num_produced_blocks, num_produced_chunks, num_expected_chunks, percent_chunks_produced, num_missed_epochs, num_validated_epochs }
        )
      ),
      null,
      2
    )
  );

  let validatorsScoreboardCsv =
    "ACCOUNT,CHUNKS PRODUCED,CHUNKS EXPECTED,%CHUNKS ONLINE,BLOCKS PRODUCED,BLOCKS EXPECTED,%BLOCKS ONLINE,MISSED EPOCHS,VALIDATED EPOCHS,TOTAL EPOCHS\n";

  for (const [account_id, validatorStats] of validatorsScoreboard) {

    const totalEpochs = (validatorStats.num_total_epochs < (validatorStats.num_validated_epochs  + validatorStats.num_missed_epochs)) ? validatorStats.num_validated_epochs  + validatorStats.num_missed_epochs : validatorStats.num_total_epochs
    let percentEpochMissed = (validatorStats.num_missed_epochs >= totalEpochs) ? 0 : (validatorStats.num_validated_epochs === totalEpochs) ? 1 : (validatorStats.num_validated_epochs / totalEpochs)
    const percentChunksOnline = ( (validatorStats.num_produced_chunks / validatorStats.num_expected_chunks) * percentEpochMissed * 100).toFixed(2)

    validatorsStats.set(account_id, {
      num_produced_blocks: ((validatorStats || {}).num_produced_blocks || 0),
      num_expected_blocks: ((validatorStats || {}).num_expected_blocks || 0),
      percent_chunks_online: (percentChunksOnline === 'NaN') ? 0 : parseFloat(percentChunksOnline),
      num_produced_chunks: ((validatorStats || {}).num_produced_chunks || 0),
      num_expected_chunks: ((validatorStats || {}).num_expected_chunks || 0),
      num_missed_epochs: ((validatorStats || {}).num_missed_epochs || 0),
      num_validated_epochs: ((validatorStats || {}).num_validated_epochs || 0),
      num_total_epochs: totalEpochs
    });
  }

  const validatorsScoreboard1 = [...validatorsStats.entries()];
  validatorsScoreboard1.sort(([_1, validatorStats1], [_2, validatorStats2]) =>
    validatorStats2.percent_chunks_online - validatorStats1.percent_chunks_online
  );

  for (const [account_id, validatorStats] of validatorsScoreboard1) {
    let totalEpochs = validatorStats.num_total_epochs
    let percentEpochMissed = (validatorStats.num_missed_epochs >= totalEpochs) ? 0 : (validatorStats.num_validated_epochs === totalEpochs) ? 1 : (validatorStats.num_validated_epochs / totalEpochs)

    validatorsScoreboardCsv += `"${account_id}",${validatorStats.num_produced_chunks},${validatorStats.num_expected_chunks},${validatorStats.percent_chunks_online},${validatorStats.num_produced_blocks},${validatorStats.num_expected_blocks},${( (validatorStats.num_produced_blocks / validatorStats.num_expected_blocks) * percentEpochMissed * 100).toFixed(2)},${validatorStats.num_missed_epochs},${validatorStats.num_validated_epochs},${totalEpochs}\n`;
  }

  fs.writeFileSync(
    path.join(statsFolder, `validators_scoreboard_${date.getFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}.csv`),
    validatorsScoreboardCsv
  );
}

async function saveValidatorsScoreCSV(statsFolder) {
    // Main script
    console.log('Starting');
    console.log('Fetching validators list...');

    await getAllNodes(statsFolder)
    .then(async(nodes) => {
        console.log('Aggregating validators data...');
        await getValidatorsCreationDate(statsFolder)
        .then(async(nodesCreation) => {
            await aggregateValidatorsScoreboard(statsFolder, nodes, nodesCreation).catch(console.error);
            console.log('End');
        })
        .catch(console.error);
    })
    .catch(error => {
        console.log('Failed!!!');
        console.error(error);
    })

    return true;
}



module.exports = saveValidatorsScoreCSV;