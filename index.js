const BigQuery = require('@google-cloud/bigquery')
const axios = require('axios')
const Promise = require('bluebird')

/**
 * TODO(developer): Uncomment the following lines before running the sample.
 */
// const projectId = "your-project-id";
// const datasetId = "my_dataset";
// const tableId = "my_table";
// const rows = [{name: "Tom", age: 30}, {name: "Jane", age: 32}];

// Creates a client
const bigquery = new BigQuery({
  projectId: 'deribit-220920',
})

exports.history = (req, res) => {
  let dt

  axios
    .get('https://www.deribit.com/api/v1/public/getinstruments')
    .then(r => r.data.result)
    .then(r => {
      dt = Math.round(new Date().getTime() / 1000)

      return Promise.map(
        r,
        i => {
          return axios
            .get('https://www.deribit.com/api/v1/public/getorderbook', {
              params: { instrument: i.instrumentName },
            })
            .then(r => r.data.result)
            .then(r => {
              return {
                dt,
                instrument: i.instrumentName,
                bid: r.bids && r.bids[0] ? r.bids[0].price : null,
                ask: r.asks && r.asks[0] ? r.asks[0].price : null,
              }
            })
            .catch(err => {
              console.error(new Error(`${i.instrumentName} ${err.message}`))
              return { instrument: i.instrumentName, bid: null, ask: null }
            })
        },
        { concurrency: 10 },
      )
    })
    .then(rows => {
      return bigquery
        .dataset('deribit')
        .table('history')
        .insert(rows)
        .then(() => {
          res.send(`Inserted ${rows.length} rows`)
        })
    })
    .catch(err => {
      res.status(500).send('Something broke!' + err.message)
    })
}
