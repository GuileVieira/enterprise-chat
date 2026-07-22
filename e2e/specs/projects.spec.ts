import { expect, test } from '@playwright/test';

test.describe('Projects suite', () => {
  test('Projects page loads', async ({ page }) => {
    await page.goto('http://localhost:3080/projects', { timeout: 5000 });
    // Wait for the page to render either the empty state or the list
    await page.waitForSelector('text=Projects', { timeout: 5000 });
    const heading = await page.textContent('h1');
    expect(heading).toContain('Projects');
  });

  test('Create project flow', async ({ page }) => {
    await page.goto('http://localhost:3080/projects', { timeout: 5000 });
    await page.waitForSelector('text=New Project', { timeout: 5000 });

    // Click new project button
    await page.click('text=New Project');

    // Wait for form to render
    await page.waitForSelector('input[placeholder*="Project name"]', { timeout: 5000 });

    // Fill in the form
    await page.fill('input[placeholder*="Project name"]', 'E2E Test Project');
    await page.fill('textarea[placeholder*="Description"]', 'A project created by E2E test');

    // Submit
    await page.click('text=Create');

    // Should redirect to project detail page
    await page.waitForURL(/\/projects\/.+/, { timeout: 5000 });

    // Verify project name is displayed
    const projectName = await page.textContent('h1');
    expect(projectName).toContain('E2E Test Project');
  });

  test('Project detail tabs', async ({ page }) => {
    await page.goto('http://localhost:3080/projects', { timeout: 5000 });
    await page.waitForSelector('text=New Project', { timeout: 5000 });

    // Create a project first
    await page.click('text=New Project');
    await page.waitForSelector('input[placeholder*="Project name"]', { timeout: 5000 });
    await page.fill('input[placeholder*="Project name"]', 'Tab Test Project');
    await page.click('text=Create');
    await page.waitForURL(/\/projects\/.+/, { timeout: 5000 });

    // Check tabs exist
    await page.waitForSelector('text=Conversations', { timeout: 5000 });
    await page.waitForSelector('text=Prompts', { timeout: 5000 });
    await page.waitForSelector('text=Memories', { timeout: 5000 });
    await page.waitForSelector('text=Files', { timeout: 5000 });
    await page.waitForSelector('text=Settings', { timeout: 5000 });

    // Switch to Settings tab
    await page.click('text=Settings');
    await page.waitForSelector('text=Instructions', { timeout: 5000 });
  });
});
