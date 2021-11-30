const core = require('@actions/core')
const github = require('@actions/github')
const markdownTable = require('markdown-table')
const {deleteComment} = require('@aki77/actions-replace-comment')
const replaceComment = require('@aki77/actions-replace-comment').default

function getExamples(results) {
  return getChildren(results, [])
}

function getChildren(input, output, filepath) {
  Object.values(input).forEach(({tests, suites, file}) => {
    if (file) {
      filepath = file
    }

    if (tests) {
      tests.forEach(({fail, pending, skipped, fullTitle, err: {message}}) => {
        if (fail || pending || skipped) {
          output.push({
            title: fullTitle,
            filepath,
            message: message ? message.replace(/\n+/g, ' ') : null,
            state: fail ? 'fail' : (skipped ? 'skipped' : 'pending')
          })
        }
      })
    }

    if (suites) {
      output = [...getChildren(suites, output, filepath)]
    }
  })

  return output
}

function getTable(examples) {
  return markdownTable([
    ['State', 'Description'],
    ...examples.map(({state, filepath, title, message}) => [
      state,
      `**Filepath**: ${filepath}<br>**Title**: ${title}<br>**Error**: ${message}`
    ])
  ])
}

function getSummary(stats) {
  return `Passes: ${stats.passes},` +
    ` failures: ${stats.failures},` +
    ` pending: ${stats.pending},` +
    ` skipped: ${stats.skipped},` +
    ` other: ${stats.other}.`
}

const commentGeneralOptions = (pullRequestId) => {
  return {
    token: core.getInput('token', {required: true}),
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pullRequestId
  }
}

async function report(result) {
  const pullRequestId = github.context.issue.number

  const summary = getSummary(result.stats);

  if(pullRequestId) {
    const title = core.getInput('title', {required: true})
    const always = core.getInput('always', {required: true})
    const options = commentGeneralOptions(pullRequestId)

    if (!result.stats.failures && !always) {
      await deleteComment({
        ...options,
        body: title,
        startsWith: true
      })
      return
    }

    await replaceComment({
      ...options,
      body: `${title}
<details>
<summary>${summary}</summary>

${getTable(getExamples(result.results))}

</details>
`
    })

  }

  if(result.stats.failures) {
    core.setFailed(summary);
  }
}

exports.getTable = getTable
exports.getExamples = getExamples
exports.getSummary = getSummary
exports.report = report
