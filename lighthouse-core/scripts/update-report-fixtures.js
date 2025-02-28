/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const cli = require('../../lighthouse-cli/run.js');
const cliFlags = require('../../lighthouse-cli/cli-flags.js');
const assetSaver = require('../lib/asset-saver.js');
const {server} = require('../../lighthouse-cli/test/fixtures/static-server.js');
const budgetedConfig = require('../test/results/sample-config.js');
const {LH_ROOT} = require('../../root.js');

const artifactPath = 'lighthouse-core/test/results/artifacts';
// All artifacts must have resources from a consistent port, to ensure reproducibility.
// https://github.com/GoogleChrome/lighthouse/issues/11776
const MAGIC_SERVER_PORT = 10200;

/**
 * Update the report artifacts. If artifactName is set only that artifact will be updated.
 * @param {keyof LH.Artifacts=} artifactName
 */
async function update(artifactName) {
  await server.listen(MAGIC_SERVER_PORT, 'localhost');

  const oldArtifacts = assetSaver.loadArtifacts(artifactPath);

  const url = `http://localhost:${MAGIC_SERVER_PORT}/dobetterweb/dbw_tester.html`;
  const rawFlags = [
    `--gather-mode=${artifactPath}`,
    url,
  ].join(' ');
  const flags = cliFlags.getFlags(rawFlags);
  await cli.runLighthouse(url, flags, budgetedConfig);
  await server.close();

  if (artifactName) {
    // Revert everything except the one artifact
    const newArtifacts = assetSaver.loadArtifacts(artifactPath);
    if (!(artifactName in newArtifacts) && !(artifactName in oldArtifacts)) {
      throw Error('Unknown artifact name: ' + artifactName);
    }
    const finalArtifacts = oldArtifacts;
    const newArtifact = newArtifacts[artifactName];
    // @ts-expect-error tsc can't yet express that artifactName is only a single type in each iteration, not a union of types.
    finalArtifacts[artifactName] = newArtifact;
    await assetSaver.saveArtifacts(finalArtifacts, artifactPath);
  }

  // Normalize some data.
  const artifactsFile = `${LH_ROOT}/${artifactPath}/artifacts.json`;
  /** @type {LH.Artifacts} */
  const artifacts = JSON.parse(fs.readFileSync(artifactsFile, 'utf-8'));

  for (const timing of artifacts.Timing) {
    // @ts-expect-error: Value actually is writeable at this point.
    timing.startTime = 0;
    // @ts-expect-error: Value actually is writeable at this point.
    timing.duration = 1;
  }

  fs.writeFileSync(artifactsFile, JSON.stringify(artifacts, null, 2));
}

update(/** @type {keyof LH.Artifacts | undefined} */ (process.argv[2]));
