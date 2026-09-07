#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Sovereign Library contributors
import { cli } from '../src/index.js';

cli(process.argv.slice(2)).catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
