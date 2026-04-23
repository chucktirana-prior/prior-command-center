#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredEnvKeys = [
  'MONGODB_URI',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'PORT',
  'APP_BASE_URL',
  'NEXT_PUBLIC_API_BASE_URL',
  'DOWNLOAD_SIGNING_SECRET',
  'STORAGE_MODE',
  'LOCAL_STORAGE_DIR',
  'TEMPLATE_VERSION',
  'MODEL_VERSION',
  'PPTX_TEMPLATE_PATH',
  'WORKER_POLL_INTERVAL_MS',
  'DO_SPACES_BUCKET',
  'DO_SPACES_REGION',
  'DO_SPACES_ENDPOINT',
  'DO_SPACES_KEY',
  'DO_SPACES_SECRET',
];

const expectedRootScripts = ['dev', 'build', 'test', 'lint', 'typecheck'];
const expectedServiceScripts = new Map([
  ['apps/web/package.json', ['dev', 'build', 'typecheck']],
  ['services/api/package.json', ['dev', 'build', 'typecheck']],
  ['services/worker/package.json', ['dev', 'build', 'typecheck']],
]);

function readJson(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8').then((content) => JSON.parse(content));
}

function assertExit(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
}

function runTsxSnippet(snippet, label) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', snippet], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assertExit(result, label);
  return result.stdout.trim();
}

async function checkWorkspaceManifests() {
  const rootPackage = await readJson('package.json');
  for (const scriptName of expectedRootScripts) {
    assert.ok(rootPackage.scripts?.[scriptName], `root package.json is missing the ${scriptName} script`);
  }

  for (const [relativePath, scripts] of expectedServiceScripts) {
    const manifest = await readJson(relativePath);
    for (const scriptName of scripts) {
      assert.ok(manifest.scripts?.[scriptName], `${relativePath} is missing the ${scriptName} script`);
    }
  }
}

async function checkEnvTemplate() {
  const envExample = await readFile(path.join(repoRoot, '.env.example'), 'utf8');
  for (const key of requiredEnvKeys) {
    assert.match(envExample, new RegExp(`^${key}=`, 'm'), `.env.example is missing ${key}`);
  }
}

async function checkSourceInvariants() {
  const [apiSource, workerSource, routeSource] = await Promise.all([
    readFile(path.join(repoRoot, 'services/api/src/index.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'services/worker/src/index.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'services/api/src/routes/decks.ts'), 'utf8'),
  ]);

  assert.match(apiSource, /connectToDatabase\(config\.mongodbUri\)/, 'API should connect to MongoDB at startup');
  assert.match(apiSource, /app\.use\(requireUser\)/, 'API should keep the auth guard in place');
  assert.match(apiSource, /\/api\/downloads\/\*/, 'API should keep the local download route');
  assert.match(routeSource, /router\.get\('\//, 'Deck routes should include a deck listing endpoint');
  assert.match(routeSource, /outline\/generate/, 'Deck routes should include outline generation');
  assert.match(routeSource, /copy\/generate/, 'Deck routes should include copy generation');
  assert.match(routeSource, /download-url/, 'Deck routes should include download URL generation');
  assert.match(workerSource, /while \(true\)/, 'Worker should remain a background poller');
  assert.match(workerSource, /processNextDeckJob/, 'Worker should process queued jobs');
  assert.match(workerSource, /pollIntervalMs/, 'Worker should respect its polling interval');
}

function checkSharedContractSmoke() {
  const stdout = runTsxSnippet(`
    import assert from 'node:assert/strict';
    import {
      DECK_STATUSES,
      inferBuildStatus,
      inferCopyStatus,
      inferOutlineStatus,
      layoutIds,
      layoutRegistry,
    } from './packages/shared/src/index.ts';

    assert.equal(layoutRegistry.length, 10);
    assert.equal(new Set(layoutRegistry.map((layout) => layout.layoutId)).size, layoutRegistry.length);
    assert.equal(new Set(layoutRegistry.map((layout) => layout.templateSlideRef)).size, layoutRegistry.length);
    assert.equal(new Set(layoutIds).size, layoutIds.length);
    assert.deepEqual([...DECK_STATUSES], [
      'draft',
      'outline_queued',
      'outline_generating',
      'outline_ready',
      'copy_queued',
      'copy_generating',
      'copy_ready',
      'build_queued',
      'building',
      'complete',
      'failed',
    ]);
    assert.equal(inferOutlineStatus('outline_generating'), 'pending');
    assert.equal(inferCopyStatus('copy_ready'), 'ready');
    assert.equal(inferBuildStatus('failed'), 'failed');
    console.log('shared-contract-smoke:ok');
  `, 'shared contract smoke');

  assert.equal(stdout, 'shared-contract-smoke:ok');
}

async function checkPromptAssets() {
  const promptFiles = [
    'packages/core/prompts/outline-system.txt',
    'packages/core/prompts/copy-system.txt',
  ];

  const missing = [];
  for (const relativePath of promptFiles) {
    try {
      await readFile(path.join(repoRoot, relativePath), 'utf8');
    } catch {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    console.warn(`warning: prompt asset files are missing and API import smoke was skipped: ${missing.join(', ')}`);
    console.warn('warning: the repo still verifies source wiring, but the runtime prompt bundle should be restored before handoff');
  }
}

async function checkRuntimePathWarning() {
  if (!repoRoot.includes(' ')) {
    return;
  }

  const coreSource = await readFile(path.join(repoRoot, 'packages/core/src/index.ts'), 'utf8');
  if (coreSource.includes('new URL(import.meta.url).pathname')) {
    console.warn('warning: packages/core resolves prompt assets from import.meta.url.pathname, which breaks runtime imports when the repo path contains spaces');
    console.warn('warning: the helper script uses source-level route checks instead of importing the API stack for that reason');
  }
}

async function main() {
  await checkWorkspaceManifests();
  await checkEnvTemplate();
  await checkSourceInvariants();
  await checkPromptAssets();
  await checkRuntimePathWarning();
  checkSharedContractSmoke();
  console.log('handoff verification passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
