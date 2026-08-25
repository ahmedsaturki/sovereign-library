import { canonicalStringify, normalize } from '../cubes/canonical-json/src/index.js';

const value = { z: 1, nested: { b: true, a: 'x' }, negativeZero: -0 };

console.log(normalize(value));
console.log(canonicalStringify(value));
