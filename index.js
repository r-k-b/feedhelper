/*use strict*/

require('dotenv').config()
const fetch = require('node-fetch')
const fs = require('fs')
const util = require('util')
const readFile = util.promisify(fs.readFile)
const FormData = require('form-data')
const PQueue = require('p-queue')
const chalk = require('chalk')
const inspect = util.inspect

const host = 'https://newsblur.com' // 'https://newsblur-com-q9n1ynjmr1kn.runscope.net'
const sessionID = process.env['NEWSBLUR_SESSIONID']
const targetFolder = process.env['NEWSBLUR_TARGET_FOLDER']

Promise.all([getFeeds({forceFresh: true}).then(showResult), getToBeImported()])
  .then(reportImportable)
  .then(uploadImportable)
  .catch(showError)

// ---

async function getFeeds(options = {forceFresh: false}) {
  const feedsFile = './data/feeds.json'

  if (options.forceFresh) {
    console.log(chalk.grey('Fetching fresh feed info...'))
    const response = await fetch(`${host}/reader/feeds`, {
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
  console.log(chalk.green(inspect({result: summariseFeeds(result)})))
  return result
}

function showError(error) {
  console.warn(chalk.red(inspect({error})))
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
  const importable = checked
    .filter(checkedItem => checkedItem.feedID === null)
    .map(checkedItem => checkedItem.uri)
  console.log(
    chalk.green(
      inspect({checked: checked.length, importable: importable.length}),
    ),
  )
  return {feeds, toBeImported, checked, importable}
}

async function uploadImportable({feeds, toBeImported, checked, importable}) {
  const queue = new PQueue({concurrency: 3})
  importable.forEach(uri => {
    queue.add(() => addFeed(uri))
  })
}

async function addFeed(uri) {
  const form = new FormData()
  form.append('url', uri)
  form.append('folder', targetFolder)
  console.log(chalk.grey(`Adding: ${uri}`))
  const result = await fetch(`${host}/reader/add_url`, {
    method: 'POST',
    headers: {
      Cookie: `newsblur_sessionid=${sessionID}`,
    },
    body: form,
  })
  const body = await result.json()
  if (body.code === -1) {
    /* Some valid Tumblr sites may return "This address does not point to an RSS feed"; they are likely
     blocked by the 'Safe Mode' filter. Not sure if there's a way to get NewsBlur to fetch those feeds.
     See also: https://stackoverflow.com/questions/47493273/how-to-bypass-tumblrs-safe-mode-for-rss-feeds
    */
    console.warn(
      chalk.red(`Failed:  ${uri}
    "${JSON.stringify(body)}"`),
    )
  } else {
    console.log(
      chalk.green(`Added:  ${uri}
    "${JSON.stringify(body)}"`),
    )
  }
  return result
}
