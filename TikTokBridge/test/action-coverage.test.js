'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const glob = require('node:fs');

const ROOT = path.join(__dirname, '..');
const UNITY_SCRIPTS = path.join(ROOT, '..', 'UnityProject', 'Assets', 'Scripts');

function actionsInRulesJs() {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'master', 'rules.js'), 'utf8');
    const block = /const ACTIONS = new Set\(\[([\s\S]*?)\]\)/.exec(source)[1];
    return new Set([...block.matchAll(/'([a-z]+)'/g)].map(m => m[1]));
}

function actionsInControlHtml() {
    const source = fs.readFileSync(path.join(ROOT, 'public', 'control.html'), 'utf8');
    const block = /<select data-field="action">([\s\S]*?)<\/select>/.exec(source)[1];
    return new Set([...block.matchAll(/<option value="([a-z]+)"/g)].map(m => m[1]));
}

/** Mọi chuỗi action mà code Unity thật sự so sánh. */
function actionsHandledByUnity() {
    const found = new Set();
    for (const file of glob.readdirSync(UNITY_SCRIPTS)) {
        if (!file.endsWith('.cs')) continue;
        const source = fs.readFileSync(path.join(UNITY_SCRIPTS, file), 'utf8');
        for (const m of source.matchAll(/(?:data|liveEvent)\.action\s*(?:==|is)\s*(.+?)[;)\{]/g)) {
            for (const s of m[1].matchAll(/"([a-z]+)"/g)) found.add(s[1]);
        }
    }
    return found;
}

test('bảng Master cho chọn đúng những hành động Unity xử lý', () => {
    const rules = actionsInRulesJs();
    const unity = actionsHandledByUnity();

    const missing = [...unity].filter(a => !rules.has(a));
    assert.deepEqual(missing, [],
        `Unity xử lý nhưng Master Rules không chọn được: ${missing.join(', ')}`);
});

test('danh sách trong control.html khớp danh sách hợp lệ của server', () => {
    const rules = actionsInRulesJs();
    const html = actionsInControlHtml();

    const onlyHtml = [...html].filter(a => !rules.has(a));
    const onlyRules = [...rules].filter(a => !html.has(a));

    assert.deepEqual(onlyHtml, [], `control.html có mà server từ chối: ${onlyHtml.join(', ')}`);
    assert.deepEqual(onlyRules, [], `server nhận mà control.html thiếu: ${onlyRules.join(', ')}`);
});

test('mọi hành động chọn được đều sống sót qua sanitizeMasterConfig', () => {
    const { sanitizeMasterConfig } = require('../src/master/rules');
    const actions = [...actionsInRulesJs()];
    const config = sanitizeMasterConfig({
        rules: actions.map((action, index) => ({
            id: `r${index}`, source: 'chat', trigger: `t${index}`, action
        }))
    });
    assert.deepEqual(config.rules.map(r => r.action), actions,
        'có hành động bị sanitizer đổi về mặc định');
});
