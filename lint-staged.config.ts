export default {
  '*': 'oxfmt --check --no-error-on-unmatched-pattern',
  '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}':
    'oxlint --deny-warnings --report-unused-disable-directives --no-error-on-unmatched-pattern',
  '{apps/demo,packages/primitives,packages/components,packages/blocks}/**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}':
    () => 'pnpm run doctor --staged',
}
