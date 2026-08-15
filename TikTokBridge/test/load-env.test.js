'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv, loadEnvFile } = require('../src/load-env');

test('đọc .env có comment, export và giá trị được quote', () => {
    assert.deepEqual(parseEnv(`
        # comment
        HOST=127.0.0.1
        export PORT = 3000
        EULER_API_KEY="key=#giu-nguyen"
        ALLOW_LAN=1 # ghi chu
    `), {
        HOST: '127.0.0.1',
        PORT: '3000',
        EULER_API_KEY: 'key=#giu-nguyen',
        ALLOW_LAN: '1'
    });
});

test('.env không ghi đè biến môi trường đã được hệ điều hành đặt', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toandn-env-'));
    const file = path.join(directory, '.env');
    fs.writeFileSync(file, 'HOST=0.0.0.0\nPORT=3000\n', 'utf8');
    const environment = { HOST: '127.0.0.1' };
    try {
        assert.equal(loadEnvFile(file, environment), true);
        assert.deepEqual(environment, { HOST: '127.0.0.1', PORT: '3000' });
        assert.equal(loadEnvFile(path.join(directory, 'missing.env'), environment), false);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
