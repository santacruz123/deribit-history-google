const BigQuery = require('@google-cloud/bigquery')
const axios = require('axios')
const Promise = require('bluebird')
const IV = require('implied-volatility')
const moment = require('moment')

const bigquery = new BigQuery({ projectId: 'deribit-220920' })

function calcIV(spot, dt, i, price) {
  if (price === null) {
    return null
  }

  const type = i[3] === 'C' ? 'call' : 'put'

  const t = moment(i[1] + ' 09:00', 'DDMMMYY HH:mm').diff(moment.unix(dt), 'years', true)
  const iv = IV.getImpliedVolatility(+price, +spot, +i[2], t, 0, type, 1)
  return Math.round(iv * 10000) / 100
}

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
        { concurrency: 7 },
      )
    })
    .then(rows => {
      let btcPrice = rows.filter(e => e.instrument === 'BTC-PERPETUAL')[0].bid
      let ethPrice = rows.filter(e => e.instrument === 'ETH-PERPETUAL')[0].bid

      rows.forEach(e => {
        let p = e.instrument.split('-')

        if (p[0] === 'BTC' && p[3]) {
          e.bid_iv = e.bid ? calcIV(btcPrice, dt, p, e.bid * btcPrice) : null
          e.ask_iv = e.ask ? calcIV(btcPrice, dt, p, e.ask * btcPrice) : null

          e.bid_iv = e.bid_iv > 1000 ? 1000 : e.bid_iv
          e.ask_iv = e.ask_iv > 1000 ? 1000 : e.ask_iv
        }

        if (p[0] === 'ETH' && p[3]) {
          e.bid_iv = e.bid ? calcIV(ethPrice, dt, p, e.bid * ethPrice) : null
          e.ask_iv = e.ask ? calcIV(ethPrice, dt, p, e.ask * ethPrice) : null

          e.bid_iv = e.bid_iv > 1000 ? 1000 : e.bid_iv
          e.ask_iv = e.ask_iv > 1000 ? 1000 : e.ask_iv
        }
      })

      return rows
    })
    .then(rows => {
      return bigquery
        .dataset('deribit')
        .table('history')
        .insert(rows)
        .then(() => res.send(rows))
    })
    .catch(err => {
      res.status(500).send('Something broke!' + err.toString())
    })
}
