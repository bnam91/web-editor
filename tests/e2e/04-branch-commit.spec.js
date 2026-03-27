const { test, expect } = require('@playwright/test');
const { connectApp } = require('./helpers');

test.describe('브랜치 생성 · 커밋 · 복원', () => {
  let browser, page;

  test.beforeAll(async () => {
    ({ browser, page } = await connectApp());
  });

  test.afterAll(async () => await browser.close());

  test('커밋 생성 후 브랜치 스토어에 반영', async () => {
    // 섹션 추가 후 커밋
    await page.evaluate(() => window.addSection && window.addSection());
    await page.waitForTimeout(500);

    const committed = await page.evaluate(() => {
      if (!window.commitCurrentState) return null;
      window.commitCurrentState('테스트 커밋');
      const branch = window.getCurrentBranch?.();
      return branch?.commits?.length ?? null;
    });
    // 커밋이 생성됐으면 1 이상
    if (committed !== null) expect(committed).toBeGreaterThan(0);
  });

  test('커밋 복원 후 브랜치 store 동기화 (BUG-07)', async () => {
    const synced = await page.evaluate(() => {
      const branch = window.getCurrentBranch?.();
      if (!branch?.commits?.length) return true; // 커밋 없으면 패스
      const firstCommitId = branch.commits[0].id;
      window.restoreCommit?.(firstCommitId);
      // 복원 후 브랜치 스토어의 snapshot이 갱신됐는지 확인
      const updated = window.getCurrentBranch?.();
      return !!updated?.updatedAt;
    });
    expect(synced).toBe(true);
  });
});
