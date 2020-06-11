const BigQuery = require('@google-cloud/bigquery')
const axios = require('axios')
const flatten = require('lodash/flatten')
const Promise = require('bluebird')

const bigquery = new BigQuery({ projectId: 'deribit-220920' })

const currs = ['BTC', 'ETH']

const round = x => Math.round(x * 100) / 100

exports.history_v2 = (req, res) => {
  const dt = Math.round(new Date().getTime() / 1000)

  Promise.map(currs, async curr => {
    return Promise.all([
      axios.get(`https://www.deribit.com/api/v2/public/get_index?currency=${curr}`)
      .then(r => r.data.result[curr]),
      axios
        .get(`https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${curr}`)
        .then(r => r.data.result),
    ]).then(([index, instruments]) =>
      instruments.map(i => {
        return {
          dt,
          instrument: i.instrument_name,
          bid: i.bid_price,
          ask: i.ask_price,
          base: i.instrument_name.endsWith('-P') || i.instrument_name.endsWith('-C') ? round(i.underlying_price) : index,
        }
      })
    )
  },{ concurrency: currs.length })
    .then(instruments => flatten(instruments).filter(o => o.bid || o.ask))
    .then(rows =>
      bigquery
        .dataset('deribit')
        .table('history_v2')
        .insert(rows)
        .then(() => res.send(rows))
    )
    .catch(err => {
      res.status(500).send('Something broke!' + err.toString())
    })
}
