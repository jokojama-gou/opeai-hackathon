import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'json-schema-to-typescript';
const schema = JSON.parse(await readFile(new URL('../contracts/mvp-v1.schema.json', import.meta.url), 'utf8'));
const output = await compile(schema, 'MvpFixture', { unreachableDefinitions: true, bannerComment: '/* Generated from contracts/mvp-v1.schema.json. Do not edit by hand. */' });
await writeFile(new URL('../packages/api-ts/src/schema.ts', import.meta.url), output);
const derived = JSON.parse(await readFile(new URL('../contracts/derived-v1.schema.json', import.meta.url), 'utf8'));
await writeFile(new URL('../packages/api-ts/src/derived-schema.ts', import.meta.url), await compile(derived, 'DerivedContracts', { unreachableDefinitions: true, bannerComment: '/* Generated from contracts/derived-v1.schema.json. Do not edit by hand. */' }));
