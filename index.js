/*use strict*/

require('dotenv').config()
const fetch = require('node-fetch')
const fs = require('fs')
const util = require('util')
const readFile = util.promisify(fs.readFile)

const uri = 'https://newsblur.com' // 'https://newsblur-com-q9n1ynjmr1kn.runscope.net'
const sessionID = process.env['NEWSBLUR_SESSIONID']

Promise.all([getFeeds().then(showResult), getToBeImported()])
  .then(reportImportable)
  .catch(showError)

// ---

async function getFeeds(options = {forceFresh: false}) {
  const feedsFile = './data/feeds.json'

  if (options.forceFresh) {
    const response = await fetch(`${uri}/reader/feeds`, {
      headers: {
        Cookie: `newsblur_sessionid=${sessionID}`,
      },
    })
    const fileStream = fs.createWriteStream(feedsFile)
    response.body.pipe(fileStream)
    return await response.json()
  }

  return JSON.parse(await readFile(feedsFile))
}

async function getToBeImported() {
  const toBeImportedFile = './data/to-be-imported.json'
  return JSON.parse(await readFile(toBeImportedFile))
}

function showResult(result) {
  console.log({result: summariseFeeds(result)})
  return result
}

function showError(error) {
  console.warn({error})
}

function summariseFeeds(feeds) {
  return {
    authenticated: feeds.authenticated,
    feedCount: Object.keys(feeds.feeds).length,
  }
}

function getFeedIDbyURI(feeds = {}, uri = '') {
  const entries = Object.entries(feeds)
  const matches = entries.filter(feedURIMatches(uri))
  if (matches.length > 0) {
    return matches[0][0]
  }
  return null
}

function feedURIMatches(uri) {
  return feedentry => feedentry[1].feed_address === uri
}

function reportImportable([feeds, toBeImported = []]) {
  const checked = toBeImported.map(uri => ({
    uri,
    feedID: getFeedIDbyURI(feeds.feeds, uri),
  }))
  const importable = checked.filter(checkedItem => checkedItem.feedID === null)
  console.log({checked: checked.length, importable: importable.length})
  return {feeds, toBeImported, checked, importable}
}
