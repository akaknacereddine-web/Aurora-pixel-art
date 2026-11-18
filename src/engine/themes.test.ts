import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRelativeLuminance,
  resolveWebsiteThemeTokens,
  WEBSITE_THEMES,
} from './themes';

test('all 6 curated website themes exist with distinct backgrounds and valid contrast', () => {
  assert.equal(WEBSITE_THEMES.length, 6);
  const ids = WEBSITE_THEMES.map((t) => t.id);
  assert.deepEqual(ids, [
    'aurora-blues',
    'light-ice-blues',
    'warm-browns',
    'forest-greens',
    'deep-plum',
    'neutral-slate',
  ]);

  const lightTheme = WEBSITE_THEMES.find((t) => t.id === 'light-ice-blues');
  assert.ok(lightTheme);
  assert.ok(getRelativeLuminance(lightTheme.tokens.bgApp) > 0.7);
  assert.ok(getRelativeLuminance(lightTheme.tokens.textPrimary) < 0.08);
});

test('resolveWebsiteThemeTokens derives readable contrast for custom light and dark themes', () => {
  const customLight = resolveWebsiteThemeTokens({
    presetId: 'aurora-blues',
    isCustom: true,
    customColors: {
      bgApp: '#E0F2FE',
      accent: '#0369A1',
    },
  });
  // Light background defaults to dark primary ink and darker stepped panel
  assert.ok(getRelativeLuminance(customLight.textPrimary) < 0.1);
  assert.ok(getRelativeLuminance(customLight.bgPanel) < getRelativeLuminance(customLight.bgApp));
  // Dark accent gets crisp white CTA contrast ink
  assert.equal(customLight.accentContrast, '#FFFFFF');

  const customWarmDark = resolveWebsiteThemeTokens({
    presetId: 'warm-browns',
    isCustom: true,
    customColors: {
      bgApp: '#231610',
      accent: '#FBBF24',
    },
  });
  assert.ok(getRelativeLuminance(customWarmDark.textPrimary) > 0.8);
  assert.equal(customWarmDark.accentContrast, '#081222');
});
