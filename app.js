var express = require('express');
const { Octokit } = require('octokit');

var fs = require('fs')
var path = require('path')
var child_process = require('child_process')

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { Conf } = require('./conf')

const port = Conf.port;

const secret = Conf.secret

// the only artifact name expected to download
const artifact_name = Conf.artifact_name

const octokit = new Octokit({
   auth: Conf.auth_token
})

app.all('/*', async (req, res) => {
   console.log("-------------- New Request --------------");
   if (req.headers['x-github-event'] != 'deployment') {
      console.log("unhandled type")
      res.json({status: 400, message: `unhandled event type ${req.headers['x-github-event']}`})
      return
   }

   let workflow_run = req.body.workflow_run
   let workflow_run_id = workflow_run.id

   let repo = req.body.repository
   let owner = repo?.owner?.login
   let name = repo.name
   console.log(`repo info: ${owner}/${name}`)

   var artifact_res = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts{?per_page,page}', {
      owner: owner,
      repo: name,
      run_id: workflow_run_id
   })
      // .then()
      // .catch()
   if (artifact_res.status != 200) {
      res.json({status: 500, message: `request artifacts failed with error code ${artifact_res.status}`})
      return
   }

   let artifact = artifact_res.data
   console.log("Artfact meta: " + JSON.stringify(artifact))
   if (artifact == null || artifact.total_count == 0) {
      res.json({ status: 404, message: `invlid or no artifact for workflow run ${workflow_run_id}` })
      return
   }

   let filtered_artifacts = artifact.artifacts.filter(ar => ar.name == artifact_name)
   if (filtered_artifacts.length == 0) {
      res.json({status: 404, message: `no artfacts named ${artifact_name} found`})
      return
   }

   if (filtered_artifacts.length > 1) {
      console.warn(`multiple artifacts found for workflow run ${workflow_run_id}, use first one by default`)
   }

   let artifact_id = filtered_artifacts[0].id
   let artifact_dir = Conf.artifact_dir
   let sha = req.body.deployment?.sha
   fs.mkdirSync(artifact_dir, { recursive: true })
   let cur_artifact_path = path.join(artifact_dir, `${artifact_name}-${sha}.zip`)
   let post_hook = Conf.post_hook

   octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}', {
      owner: owner,
      repo: name,
      artifact_id: artifact_id,
      archive_format: 'zip'
   }).then(res => {
      fs.writeFileSync(cur_artifact_path, Buffer.from(res.data))
      console.log(`Downloaded ${cur_artifact_path}`)
   })
      .then(() => {
         if (post_hook != null && post_hook.length > 0) {
            console.log(`Excuting post host: ${post_hook}`)
            let res = child_process.spawnSync(post_hook, [cur_artifact_path])
            console.log(res.stdout)
         }
      })
      .finally(() => {
         console.log(`Cleanup: removing ${cur_artifact_path}`)
         fs.rmSync(cur_artifact_path, { force: true })
      })

   res.json({status: 200, message: 'ok'})
   return
})

app.listen(port, function () {
   console.log(`Example app listening at ${port}`)
})
