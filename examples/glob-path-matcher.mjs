import { compileGlob, evaluateRules, matchGlob, serializePattern } from '../cubes/glob-path-matcher/src/index.js';

const matcher = compileGlob('src/**/test?.js', { caseMode: 'insensitive' });
console.log(matchGlob(matcher, 'src/unit/Test1.JS'));

console.log(evaluateRules([
  { pattern: '**/*.js', action: 'include' },
  { pattern: 'secret/**', action: 'exclude' },
], 'src/app.js'));

console.log(serializePattern(matcher));
