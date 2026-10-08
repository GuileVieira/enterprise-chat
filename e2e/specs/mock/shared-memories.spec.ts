import fs from 'node:fs/promises';
import { MongoClient, ObjectId } from 'mongodb';
import { expect, test, request as playwrightRequest } from '@playwright/test';
import {
  getAccessToken,
  requestJson,
  selectMockEndpoint,
  sendMessage,
  MOCK_ENDPOINTS,
} from './helpers';
import { applyRuntimeEnv } from '../../setup/runtimeEnv';

test('resolves a local conflict by keyboard, exports and imports library memories', async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  applyRuntimeEnv();
  expect(process.env.MONGO_URI).toMatch(/^mongodb:\/\/127\.0\.0\.1:/);
  await page.goto('/c/new');
  const administratorToken = await getAccessToken(page);
  const administrator = await requestJson<{ role: string }>(page, {
    path: '/api/user',
    token: administratorToken,
  });
  expect(administrator.role).toBe('ADMIN');
  const tenantId = 'e2e-shared-memory-pilot';
  const email = 'shared-memory-pilot@example.com';
  const password = 'Local-smoke-only-654321';
  const registered = await page.request.post('/api/auth/register', {
    headers: { 'X-Tenant-Id': tenantId },
    data: {
      email,
      password,
      confirm_password: password,
      name: 'Memory pilot',
      username: 'memorypilot',
    },
  });
  expect(registered.ok()).toBeTruthy();
  const mongo = await new MongoClient(process.env.MONGO_URI!).connect();
  try {
    const result = await mongo
      .db()
      .collection('users')
      .updateOne({ email, tenantId }, { $set: { role: 'OWNER', emailVerified: true } });
    expect(result.matchedCount).toBe(1);
  } finally {
    await mongo.close();
  }
  const login = await page.request.post('/api/auth/login', {
    headers: { 'X-Tenant-Id': tenantId },
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto('/c/new');
  const token = await getAccessToken(page);
  const memory = await requestJson<{ id: string }>(page, {
    path: '/api/shared-memories',
    token,
    method: 'POST',
    body: { key: 'browser_tone', value: 'Shared browser content' },
  });
  const project = await requestJson<{ projectId: string }>(page, {
    path: '/api/projects',
    token,
    method: 'POST',
    body: {
      name: 'Memory browser smoke',
      memories: [{ key: 'browser_tone', value: 'Local browser content' }],
    },
  });
  await page.goto(`/projects/${project.projectId}`);
  await expect(
    page.getByRole('heading', { name: 'Memory browser smoke', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /^Memories/ })
    .last()
    .click();
  const library = page.getByRole('region', { name: 'Organization library' });
  await library.getByRole('checkbox').first().check();
  await library.getByRole('button', { name: 'Add from library' }).click();
  const conflict = page.getByRole('dialog', { name: 'Local or shared memory?' });
  await expect(conflict).toBeVisible();
  await conflict.getByRole('button', { name: 'Use shared', exact: true }).focus();
  await expect(conflict.getByRole('button', { name: 'Use shared', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(conflict).toBeHidden();
  const linked = await requestJson<{ memories: Array<{ key: string }>; sharedMemoryIds: string[] }>(
    page,
    { path: `/api/projects/${project.projectId}`, token },
  );
  expect(linked.memories).toEqual([]);
  expect(linked.sharedMemoryIds).toContain(memory.id);
  const secondProject = await requestJson<{ projectId: string }>(page, {
    path: '/api/projects',
    token,
    method: 'POST',
    body: { name: 'Second linked memory project' },
  });
  await requestJson(page, {
    path: `/api/projects/${secondProject.projectId}/shared-memories`,
    token,
    method: 'POST',
    body: { memoryIds: [memory.id] },
  });
  const copyProject = await requestJson<{ projectId: string }>(page, {
    path: '/api/projects',
    token,
    method: 'POST',
    body: {
      name: 'Independent copied memory project',
      memories: [{ key: 'local_publish', value: 'Saved local publication' }],
    },
  });
  await requestJson(page, {
    path: `/api/shared-memories/${memory.id}/copy`,
    token,
    method: 'POST',
    body: { projectId: copyProject.projectId },
  });

  const exportedDownload = page.waitForEvent('download');
  await library.getByRole('button', { name: 'JSON', exact: true }).click();
  const download = await exportedDownload;
  expect(download.suggestedFilename()).toBe('orqest-memories.json');
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const exported = JSON.parse(await fs.readFile(downloadedPath!, 'utf8')) as {
    items: Array<{ key: string; value: string }>;
  };
  expect(exported.items).toContainEqual({
    ref: 'm1',
    key: 'browser_tone',
    value: 'Shared browser content',
  });

  await library.getByRole('button', { name: 'Import memories', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import memories' });
  await dialog.getByRole('radio', { name: 'Organization library', exact: true }).check();
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'memories.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'orqest-memories',
        version: 1,
        items: [{ ref: 'new', key: 'browser_import', value: 'Imported browser content' }],
      }),
    ),
  });
  await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(dialog.getByText('Imported browser content', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Created: 1');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(library.getByText('browser_import', { exact: true })).toBeVisible();
  await library.getByPlaceholder('e.g. preferred_language').fill('browser_published');
  await library.getByPlaceholder('e.g. Portuguese').fill('Published via browser UI');
  await library.getByRole('button', { name: 'Publish to library', exact: true }).click();
  await expect(library.getByText('browser_published', { exact: true })).toBeVisible();
  await library
    .locator('label')
    .filter({ hasText: 'browser_import' })
    .getByRole('button', { name: 'Create independent copy', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await requestJson<{ memories: Array<{ key: string; value: string }> }>(page, {
            path: `/api/projects/${project.projectId}`,
            token,
          })
        ).memories,
    )
    .toContainEqual(
      expect.objectContaining({ key: 'browser_import', value: 'Imported browser content' }),
    );

  const linkedRow = library.getByRole('listitem').filter({ hasText: 'browser_tone' });
  await linkedRow.getByRole('button', { name: 'Edit Memory', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Memory', exact: true });
  await editDialog.getByRole('textbox').last().fill('SHARED_MEMORY_CONTEXT_CANARY');
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(linkedRow.getByText('SHARED_MEMORY_CONTEXT_CANARY', { exact: true })).toBeVisible();
  const secondLinked = await requestJson<{
    items: Array<{ id: string; value: string; linkedToProject: boolean }>;
  }>(page, { path: `/api/shared-memories?projectId=${secondProject.projectId}`, token });
  expect(secondLinked.items.find((item) => item.id === memory.id)).toMatchObject({
    value: 'SHARED_MEMORY_CONTEXT_CANARY',
    linkedToProject: true,
  });
  const independent = await requestJson<{
    memories: Array<{ key: string; value: string }>;
    sharedMemoryIds: string[];
  }>(page, { path: `/api/projects/${copyProject.projectId}`, token });
  expect(independent.memories).toContainEqual(
    expect.objectContaining({ key: 'browser_tone', value: 'Shared browser content' }),
  );
  expect(independent.sharedMemoryIds).toEqual([]);

  await page.goto(`/c/new?projectId=${secondProject.projectId}`);
  await selectMockEndpoint(page, MOCK_ENDPOINTS[0], true);
  expect(
    (await sendMessage(page, 'E2E_ASSERT_AGENT_CONTEXT:SHARED_MEMORY_CONTEXT_CANARY')).ok(),
  ).toBeTruthy();
  await expect(
    page.getByText('E2E agent context assertion passed: SHARED_MEMORY_CONTEXT_CANARY', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  await page.goto(`/c/new?projectId=${copyProject.projectId}`);
  await selectMockEndpoint(page, MOCK_ENDPOINTS[0], true);
  expect(
    (await sendMessage(page, 'E2E_ASSERT_AGENT_CONTEXT:SHARED_MEMORY_CONTEXT_CANARY')).ok(),
  ).toBeTruthy();
  await expect(page.getByText(/E2E agent context assertion failed:/).last()).toBeVisible({
    timeout: 30000,
  });
  await page.goto(`/projects/${copyProject.projectId}`);
  await expect(
    page.getByRole('heading', { name: 'Independent copied memory project', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /^Memories/ })
    .last()
    .click();
  await page
    .locator('fieldset')
    .getByRole('button', { name: 'Publish to library', exact: true })
    .first()
    .click();
  const localPublication = page.getByRole('dialog', { name: 'Publish to library', exact: true });
  await localPublication
    .getByRole('checkbox', { name: 'Replace local memory with shared link', exact: true })
    .check();
  await localPublication.getByRole('button', { name: 'Publish to library', exact: true }).click();
  await expect(localPublication).toBeHidden();
  await expect
    .poll(async () =>
      (
        await requestJson<{ memories: Array<{ key: string }> }>(page, {
          path: `/api/projects/${copyProject.projectId}`,
          token,
        })
      ).memories.map((item) => item.key),
    )
    .not.toContain('local_publish');
  const publishedLocal = await requestJson<{ items: Array<{ key: string; value: string }> }>(page, {
    path: '/api/shared-memories?search=local_publish',
    token,
  });
  expect(publishedLocal.items).toContainEqual(
    expect.objectContaining({ key: 'local_publish', value: 'Saved local publication' }),
  );
  await page.goto(`/projects/${project.projectId}`);
  await expect(
    page.getByRole('heading', { name: 'Memory browser smoke', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /^Memories/ })
    .last()
    .click();

  await linkedRow.getByRole('button', { name: 'Archive memory', exact: true }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Archive memory', exact: true });
  await archiveDialog.getByRole('button', { name: 'Archive memory', exact: true }).click();
  await expect(linkedRow).toHaveCount(0);
  await expect(library.getByRole('status')).toContainText('archived');
  const archivedContext = await requestJson<{ archived: number }>(page, {
    path: `/api/projects/${secondProject.projectId}/shared-memories/context-status`,
    token,
  });
  expect(archivedContext.archived).toBe(1);
  await library.getByRole('button', { name: 'Restore memory', exact: true }).click();
  await expect(linkedRow.getByText('SHARED_MEMORY_CONTEXT_CANARY', { exact: true })).toBeVisible();

  await linkedRow.getByRole('button', { name: 'Remove from this project', exact: true }).click();
  await expect(linkedRow).toHaveCount(0);
  const original = await requestJson<{ items: Array<{ id: string; value: string }> }>(page, {
    path: '/api/shared-memories',
    token,
  });
  expect(original.items.find((item) => item.id === memory.id)?.value).toBe(
    'SHARED_MEMORY_CONTEXT_CANARY',
  );
  const afterUnlink = await requestJson<{
    sharedMemoryIds: string[];
    memories: Array<{ key: string; value: string }>;
  }>(page, { path: `/api/projects/${project.projectId}`, token });
  expect(afterUnlink.sharedMemoryIds).not.toContain(memory.id);
  expect(afterUnlink.memories).toContainEqual(
    expect.objectContaining({
      key: 'browser_import',
      value: 'Imported browser content',
    }),
  );
  await library.getByText('browser_import', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('shared-memories.png'), fullPage: true });

  const replacementEmail = 'memory-replacement@example.com';
  const replacement = await playwrightRequest.newContext({
    baseURL: new URL(page.url()).origin,
    extraHTTPHeaders: { 'X-Tenant-Id': tenantId },
  });
  try {
    const registeredReplacement = await replacement.post('/api/auth/register', {
      data: {
        email: replacementEmail,
        password,
        confirm_password: password,
        name: 'Replacement owner',
        username: 'replacementowner',
      },
    });
    expect(registeredReplacement.ok()).toBeTruthy();
    const setup = await new MongoClient(process.env.MONGO_URI!).connect();
    let replacementId: string;
    try {
      await setup
        .db()
        .collection('users')
        .updateOne(
          { email: replacementEmail, tenantId },
          { $set: { role: 'OWNER', emailVerified: true } },
        );
      const replacementUser = await setup
        .db()
        .collection('users')
        .findOne({ email: replacementEmail, tenantId });
      expect(replacementUser).toBeTruthy();
      replacementId = String(replacementUser!._id);
    } finally {
      await setup.close();
    }
    const replacementLogin = await replacement.post('/api/auth/login', {
      data: { email: replacementEmail, password },
    });
    expect(replacementLogin.ok()).toBeTruthy();
    const replacementAuth = (await replacementLogin.json()) as { token: string };
    const pilot = await requestJson<{ id: string }>(page, { path: '/api/user', token });
    await requestJson(page, {
      path: '/api/memories',
      token,
      method: 'POST',
      body: { key: 'personal_tone', value: 'Remove personal on deletion' },
    });
    await page.goto('/c/new');
    await page.getByRole('button', { name: 'Memories', exact: true }).first().click();
    const personalPanel = page.getByRole('region', { name: 'Memories', exact: true });
    await personalPanel.getByRole('button', { name: 'Publish to library', exact: true }).click();
    const personalPublication = page.getByRole('dialog', {
      name: 'Publish to library',
      exact: true,
    });
    await personalPublication
      .getByRole('button', { name: 'Publish to library', exact: true })
      .click();
    await expect(personalPublication).toBeHidden();
    await expect
      .poll(async () =>
        (
          await requestJson<{ items: Array<{ key: string }> }>(page, {
            path: '/api/shared-memories?search=personal_tone',
            token,
          })
        ).items.map((item) => item.key),
      )
      .toEqual(['personal_tone']);
    const impact = await requestJson<{
      personalCount: number;
      sharedAuthoredCount: number;
      projectsNeedingOwner: Array<{ projectId: string }>;
    }>(page, { path: '/api/shared-memories/deletion-impact', token });
    expect(impact.personalCount).toBe(1);
    expect(impact.sharedAuthoredCount).toBe(5);
    expect(impact.projectsNeedingOwner).toHaveLength(3);
    await requestJson(page, {
      path: `/api/projects/${project.projectId}/shared-memories`,
      token,
      method: 'POST',
      body: { memoryIds: [memory.id] },
    });
    const blocked = await page.request.delete('/api/user/delete', {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(blocked.status()).toBe(409);
    const deleted = await page.request.delete('/api/user/delete', {
      headers: { Authorization: `Bearer ${token}` },
      data: { projectOwnerId: replacementId },
    });
    expect(deleted.status(), await deleted.text()).toBe(200);
    const preserved = await requestJson<{
      user: string;
      sharedMemoryIds: string[];
      memories: Array<{ key: string }>;
    }>(page, { path: `/api/projects/${project.projectId}`, token: replacementAuth.token });
    expect(preserved.user).toBe(replacementId);
    expect(preserved.sharedMemoryIds).toContain(memory.id);
    expect(preserved.memories).toContainEqual(expect.objectContaining({ key: 'browser_import' }));
    const libraryAfterDeletion = await requestJson<{ items: Array<{ id: string }> }>(page, {
      path: '/api/shared-memories',
      token: replacementAuth.token,
    });
    expect(libraryAfterDeletion.items.map((item) => item.id)).toContain(memory.id);
    const staleAuth = await page.request.get('/api/shared-memories', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(staleAuth.status()).toBe(401);

    const authorEmail = 'admin-delete-author@example.com';
    const authorRegistration = await replacement.post('/api/auth/register', {
      data: {
        email: authorEmail,
        password,
        confirm_password: password,
        name: 'Admin deletion author',
        username: 'admindeleteauthor',
      },
    });
    expect(authorRegistration.ok()).toBeTruthy();
    const authorSetup = await new MongoClient(process.env.MONGO_URI!).connect();
    let authorId: string;
    try {
      await authorSetup
        .db()
        .collection('users')
        .updateOne(
          { email: authorEmail, tenantId },
          { $set: { role: 'OWNER', emailVerified: true } },
        );
      const author = await authorSetup
        .db()
        .collection('users')
        .findOne({ email: authorEmail, tenantId });
      expect(author).toBeTruthy();
      authorId = String(author!._id);
    } finally {
      await authorSetup.close();
    }
    const authorLogin = await replacement.post('/api/auth/login', {
      data: { email: authorEmail, password },
    });
    expect(authorLogin.ok()).toBeTruthy();
    const authorAuth = (await authorLogin.json()) as { token: string };
    const adminMemory = await requestJson<{ id: string }>(page, {
      path: '/api/shared-memories',
      token: authorAuth.token,
      method: 'POST',
      body: { key: 'admin_delete_tone', value: 'Preserved after admin deletion' },
    });
    const adminProject = await requestJson<{ projectId: string }>(page, {
      path: '/api/projects',
      token: authorAuth.token,
      method: 'POST',
      body: {
        name: 'Admin deletion continuity',
        memories: [{ key: 'local', value: 'Local continuity' }],
      },
    });
    await requestJson(page, {
      path: `/api/projects/${adminProject.projectId}/shared-memories`,
      token: authorAuth.token,
      method: 'POST',
      body: { memoryIds: [adminMemory.id] },
    });
    const ownerDeletion = await page.request.delete(`/api/admin/users/${authorId}`, {
      headers: { Authorization: `Bearer ${replacementAuth.token}` },
      data: { projectOwnerId: replacementId },
    });
    expect(ownerDeletion.status()).toBe(403);
    const adminDeletion = await page.request.delete(`/api/admin/users/${authorId}`, {
      headers: { Authorization: `Bearer ${administratorToken}` },
      data: { projectOwnerId: replacementId },
    });
    expect(adminDeletion.status(), await adminDeletion.text()).toBe(200);
    const adminPreserved = await requestJson<{ user: string; sharedMemoryIds: string[] }>(page, {
      path: `/api/projects/${adminProject.projectId}`,
      token: replacementAuth.token,
    });
    expect(adminPreserved.user).toBe(replacementId);
    expect(adminPreserved.sharedMemoryIds).toContain(adminMemory.id);
    const verifyAcl = await new MongoClient(process.env.MONGO_URI!).connect();
    try {
      const doc = await verifyAcl
        .db()
        .collection('projects')
        .findOne({ projectId: adminProject.projectId, tenantId });
      expect(doc).toBeTruthy();
      const acl = await verifyAcl
        .db()
        .collection('aclentries')
        .findOne({
          resourceId: doc!._id,
          principalId: new ObjectId(replacementId),
          principalType: 'user',
        });
      expect(acl).toMatchObject({ tenantId, permBits: 15 });
      expect(
        await verifyAcl
          .db()
          .collection('sharedmemories')
          .countDocuments({ _id: new ObjectId(adminMemory.id), tenantId }),
      ).toBe(1);
      expect(
        await verifyAcl
          .db()
          .collection('users')
          .countDocuments({ _id: new ObjectId(authorId), tenantId }),
      ).toBe(0);
      expect(
        await verifyAcl
          .db()
          .collection('memoryentries')
          .countDocuments({ userId: new ObjectId(pilot.id), tenantId }),
      ).toBe(0);
    } finally {
      await verifyAcl.close();
    }
  } finally {
    await replacement.dispose();
  }
});

test('retries only failed import items after real quota exhaustion', async ({ page }) => {
  test.setTimeout(120000);
  applyRuntimeEnv();
  expect(process.env.MONGO_URI).toMatch(/^mongodb:\/\/127\.0\.0\.1:/);
  const tenantId = 'e2e-memory-partial';
  const email = 'memory-partial@example.com';
  const password = 'Local-smoke-only-654321';
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers: { 'X-Tenant-Id': tenantId },
        data: {
          email,
          password,
          confirm_password: password,
          name: 'Partial pilot',
          username: 'partialpilot',
        },
      })
    ).ok(),
  ).toBeTruthy();
  const setup = await new MongoClient(process.env.MONGO_URI!).connect();
  try {
    expect(
      (
        await setup
          .db()
          .collection('users')
          .updateOne({ email, tenantId }, { $set: { role: 'OWNER', emailVerified: true } })
      ).matchedCount,
    ).toBe(1);
  } finally {
    await setup.close();
  }
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers: { 'X-Tenant-Id': tenantId },
        data: { email, password },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto('/c/new');
  const token = await getAccessToken(page);
  const firstValue = 'partial first';
  const probe = await requestJson<{ id: string; updatedAt: string; tokenCount: number }>(page, {
    path: '/api/shared-memories',
    token,
    method: 'POST',
    body: { key: 'quota_probe', value: firstValue },
  });
  await requestJson(page, {
    path: `/api/shared-memories/${probe.id}/archive`,
    token,
    method: 'POST',
    body: { expectedUpdatedAt: probe.updatedAt },
  });
  let remaining = 10000 - probe.tokenCount;
  const fillers: Array<{ id: string; updatedAt: string }> = [];
  while (remaining > 0) {
    const value = remaining === 1 ? 'x' : 'x '.repeat(Math.min(4000, remaining - 1));
    const filler = await requestJson<{ id: string; updatedAt: string; tokenCount: number }>(page, {
      path: '/api/shared-memories',
      token,
      method: 'POST',
      body: { key: `quota_${String.fromCharCode(97 + fillers.length)}`, value },
    });
    expect(filler.tokenCount).toBeGreaterThan(0);
    expect(filler.tokenCount).toBeLessThanOrEqual(remaining);
    fillers.push(filler);
    remaining -= filler.tokenCount;
  }
  const storedUsage = await requestJson<{ items: Array<{ tokenCount: number }> }>(page, {
    path: '/api/shared-memories',
    token,
  });
  expect(storedUsage.items.reduce((total, item) => total + item.tokenCount, 0)).toBe(
    10000 - probe.tokenCount,
  );
  await page.getByRole('button', { name: 'Memories', exact: true }).first().click();
  await page.getByRole('button', { name: 'Organization library', exact: true }).click();
  const library = page.getByRole('region', { name: 'Organization library', exact: true });
  await library.getByRole('textbox', { name: 'Search', exact: true }).fill('partial_');
  await library.getByRole('button', { name: 'Import memories', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import memories', exact: true });
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'partial.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'orqest-memories',
        version: 1,
        items: [
          { ref: 'p1', key: 'partial_one', value: firstValue },
          { ref: 'p2', key: 'partial_two', value: 'partial second' },
        ],
      }),
    ),
  });
  await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(dialog.getByText(firstValue, { exact: true })).toBeVisible();
  const firstRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/shared-memories/import') && request.method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  const firstBody = (await firstRequest).postDataJSON() as { operationId: string };
  await expect(dialog.getByRole('status')).toContainText('Created: 1');
  await expect(dialog.getByRole('status')).toContainText('Failed: 1');
  await expect(dialog.getByText(/Library would exceed token limit/)).toBeVisible();
  for (const filler of fillers)
    await requestJson(page, {
      path: `/api/shared-memories/${filler.id}/archive`,
      token,
      method: 'POST',
      body: { expectedUpdatedAt: filler.updatedAt },
    });
  const retryRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/shared-memories/import') && request.method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  const retryBody = (await retryRequest).postDataJSON() as {
    operationId: string;
    selectedRefs: string[];
  };
  expect(retryBody.operationId).toBe(firstBody.operationId);
  expect(retryBody.selectedRefs).toEqual(['p2']);
  await expect(dialog.getByRole('status')).toContainText('Created: 2');
  await expect(dialog.getByRole('status')).toContainText('Failed: 0');
  const final = await requestJson<{ items: Array<{ key: string }> }>(page, {
    path: '/api/shared-memories?search=partial_',
    token,
  });
  expect(final.items.map((item) => item.key).sort()).toEqual(['partial_one', 'partial_two']);
});

test('passes linked project memory to Assistants V1 and V2 provider requests', async ({ page }) => {
  test.setTimeout(120000);
  applyRuntimeEnv();
  expect(process.env.MONGO_URI).toMatch(/^mongodb:\/\/127\.0\.0\.1:/);
  const tenantId = 'e2e-memory-assistants';
  const email = 'memory-assistants@example.com';
  const password = 'Local-smoke-only-654321';
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers: { 'X-Tenant-Id': tenantId },
        data: {
          email,
          password,
          confirm_password: password,
          name: 'Assistants pilot',
          username: 'assistantspilot',
        },
      })
    ).ok(),
  ).toBeTruthy();
  const setup = await new MongoClient(process.env.MONGO_URI!).connect();
  try {
    expect(
      (
        await setup
          .db()
          .collection('users')
          .updateOne({ email, tenantId }, { $set: { role: 'OWNER', emailVerified: true } })
      ).matchedCount,
    ).toBe(1);
  } finally {
    await setup.close();
  }
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers: { 'X-Tenant-Id': tenantId },
        data: { email, password },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto('/c/new');
  const token = await getAccessToken(page);
  const memory = await requestJson<{ id: string }>(page, {
    path: '/api/shared-memories',
    token,
    method: 'POST',
    body: { key: 'assistant_memory', value: 'ASSISTANT_MEMORY_CANARY' },
  });
  const project = await requestJson<{ projectId: string }>(page, {
    path: '/api/projects',
    token,
    method: 'POST',
    body: { name: 'Assistants context' },
  });
  await requestJson(page, {
    path: `/api/projects/${project.projectId}/shared-memories`,
    token,
    method: 'POST',
    body: { memoryIds: [memory.id] },
  });
  const providerBase = `http://127.0.0.1:${process.env.E2E_ASSISTANTS_PORT ?? '8890'}`;
  for (const version of ['v1', 'v2']) {
    const created = await page.request.post(`/api/assistants/${version}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        endpoint: 'assistants',
        model: 'gpt-4o-mini',
        name: `Memory ${version}`,
        instructions: 'Base assistant instructions',
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const assistant = (await created.json()) as { id: string };
    const chat = await page.request.post(`/api/assistants/${version}/chat`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        endpoint: 'assistants',
        model: 'gpt-4o-mini',
        assistant_id: assistant.id,
        projectId: project.projectId,
        text: `E2E_REPLY:memory_${version}`,
        clientTimestamp: Date.now(),
      },
    });
    expect(chat.status(), await chat.text()).toBe(200);
    const recorded = (await (await page.request.get(`${providerBase}/__e2e/requests`)).json()) as {
      requests: Array<{
        method: string;
        path: string;
        body: { assistant_id?: string; instructions?: string; additional_instructions?: string };
      }>;
    };
    const runs = recorded.requests.filter(
      (request) =>
        request.method === 'POST' &&
        /\/threads\/[^/]+\/runs$/.test(request.path) &&
        request.body.assistant_id === assistant.id,
    );
    expect(runs).toHaveLength(1);
    expect(
      `${runs[0].body.instructions ?? ''}\n${runs[0].body.additional_instructions ?? ''}`,
    ).toContain('ASSISTANT_MEMORY_CANARY');
  }
  const agent = await requestJson<{ id: string }>(page, {
    path: '/api/agents',
    token,
    method: 'POST',
    body: {
      name: 'Configured memory agent',
      description: 'Project memory context smoke',
      instructions: 'Base configured agent instructions',
      provider: MOCK_ENDPOINTS[0].label,
      model: MOCK_ENDPOINTS[0].model,
      tools: [],
      category: 'general',
    },
  });
  const agentChat = await page.request.post('/api/agents/chat', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      endpoint: 'agents',
      agent_id: agent.id,
      projectId: project.projectId,
      text: 'E2E_ASSERT_AGENT_CONTEXT:ASSISTANT_MEMORY_CANARY',
      parentMessageId: '00000000-0000-0000-0000-000000000000',
      generationProtocolVersion: 1,
      clientTimestamp: Date.now(),
    },
  });
  expect(agentChat.status(), await agentChat.text()).toBe(200);
  const admitted = (await agentChat.json()) as { conversationId: string };
  await expect
    .poll(
      async () =>
        JSON.stringify(
          await requestJson(page, { path: `/api/messages/${admitted.conversationId}`, token }),
        ),
      { timeout: 30000 },
    )
    .toContain('E2E agent context assertion passed');
});
