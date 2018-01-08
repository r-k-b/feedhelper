/*use strict*/

require('dotenv').config()
const fetch = require('node-fetch')
const fs = require('fs')

const uri = 'https://newsblur.com' // 'https://newsblur-com-q9n1ynjmr1kn.runscope.net'
const sessionID = process.env['NEWSBLUR_SESSIONID']

getFeeds()
  .then(showResult)
  .catch(showError)

async function getFeeds() {
  const response = await fetch(`${uri}/reader/feeds`, {
    headers: {
      Cookie: `newsblur_sessionid=${sessionID}`,
    },
  })
  const fileStream = fs.createWriteStream('./data/feeds.json')
  response.body.pipe(fileStream)
  const asJson = await response.json()
  return {
    authenticated: asJson.authenticated,
    feedCount: Object.keys(asJson.feeds).length,
  }
}

function showResult(result) {
  console.log({result})
}

function showError(error) {
  console.warn({error})
}
