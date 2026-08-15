const test = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeMasterConfig,
    resolveMasterRule,
    applyRule,
    applyBuiltInChatCommand,
    masterTestDiamonds
} = require('../src/master/rules');

const master = sanitizeMasterConfig({
    joinMode: 'keyword_only',
    giftAlwaysJoins: true,
    rules: [
        { id: 'hey', source: 'chat', trigger: 'hey', action: 'join' },
        { id: 'rose', source: 'gift', trigger: 'Rose, Hoa hồng', action: 'camera', durationMs: 4000 },
        { id: 'rosa', source: 'gift', giftId: '777', trigger: 'Rosa', action: 'medal', label: 'CÁNH VIP' }
    ]
});

test('matches Vietnamese aliases without accents or case sensitivity', () => {
    const rule = resolveMasterRule(master, { type: 'gift', giftName: 'HOA HỒNG' });
    assert.equal(rule.id, 'rose');
    const event = applyRule({ type: 'gift', giftName: 'HOA HỒNG' }, rule);
    assert.equal(event.action, 'camera');
    assert.equal(event.durationMs, 4000);
});

test('gift id wins even when localized gift name changes', () => {
    const rule = resolveMasterRule(master, { type: 'gift', giftId: '777', giftName: 'Localized name' });
    assert.equal(rule.id, 'rosa');
    assert.equal(applyRule({ type: 'gift' }, rule).label, 'CÁNH VIP');
});

test('gift id rule wins over an earlier matching name rule', () => {
    const config = sanitizeMasterConfig({
        rules: [
            { id: 'generic-name', source: 'gift', trigger: 'Rose', action: 'dance' },
            { id: 'learned-id', source: 'gift', trigger: 'Rose', giftId: '5655', action: 'camera' }
        ]
    });
    assert.equal(resolveMasterRule(config, { type: 'gift', giftId: '5655', giftName: 'Rose' }).id, 'learned-id');
});

test('chat hey maps to join', () => {
    const rule = resolveMasterRule(master, { type: 'chat', comment: 'hey' });
    assert.equal(rule.action, 'join');
});

test('jump and nhảy comments trigger a short built-in jump without a gift rule', () => {
    assert.equal(applyBuiltInChatCommand({ type: 'chat', comment: 'jump' }).action, 'jump');
    const event = applyBuiltInChatCommand({ type: 'chat', comment: 'NHẢY' });
    assert.equal(event.action, 'jump');
    assert.equal(event.durationMs, 950);
    assert.equal(applyBuiltInChatCommand({ type: 'gift', giftName: 'Jump' }).action, undefined);
});

test('luat trong bang Master thang lenh chat dung san', () => {
    // Truoc day applyBuiltInChatCommand ghi de vo dieu kien, nen ai go "nhay"
    // cung bi doi thanh jump du da cau hinh han luat dance cho tu do.
    const config = sanitizeMasterConfig({
        rules: [{ id: 'r-dance', enabled: true, source: 'chat', trigger: 'nhảy, dance', match: 'exact', action: 'dance', durationMs: 3000 }]
    });
    const event = { type: 'chat', comment: 'nhảy', userId: 'u1' };
    const rule = resolveMasterRule(config, event);
    assert.equal(rule.action, 'dance', 'luat phai khop truoc da');

    const final = applyBuiltInChatCommand(applyRule(event, rule));
    assert.equal(final.action, 'dance', 'lenh dung san khong duoc ghi de luat nguoi dung');
    assert.equal(final.durationMs, 3000, 'phai giu thoi luong cua luat');
});

test('Master Test dùng đúng diamond hiển thị của luật gift', () => {
    assert.equal(masterTestDiamonds({ displayDiamonds: 1 }), 1);
    assert.equal(masterTestDiamonds({ displayDiamonds: 349 }), 349);
    assert.equal(masterTestDiamonds({ displayDiamonds: 0 }), 1);
    assert.equal(masterTestDiamonds({ displayDiamonds: 99999999 }), 1000000);
});

test('lenh dung san van chay khi khong co luat nao khop', () => {
    const empty = sanitizeMasterConfig({ rules: [] });
    for (const text of ['jump', 'nhảy', 'nhay']) {
        const event = { type: 'chat', comment: text, userId: 'u1' };
        const final = applyBuiltInChatCommand(applyRule(event, resolveMasterRule(empty, event)));
        assert.equal(final.action, 'jump', `"${text}" phai roi ve lenh dung san`);
        assert.equal(final.durationMs, 950);
    }
});

test('gap chu đ ve d de nguoi xem go khong dau van khop', () => {
    // đ (U+0111) la chu cai rieng, NFD khong tach ra duoc. Khong gap tay thi
    // nguoi xem go "di vong" se khong khop trigger "Đi vòng" — ma go khong dau
    // moi la cach go chinh tren dien thoai.
    const config = sanitizeMasterConfig({
        rules: [
            { id: 'r-walk', enabled: true, source: 'chat', trigger: 'Đi vòng', match: 'exact', action: 'walk' },
            { id: 'r-chg',  enabled: true, source: 'chat', trigger: 'Đổi nv',  match: 'exact', action: 'change' }
        ]
    });

    for (const text of ['Đi vòng', 'đi vòng', 'di vong', 'Di vong', 'di vòng', 'đi vong']) {
        const rule = resolveMasterRule(config, { type: 'chat', comment: text });
        assert.equal(rule?.action, 'walk', `"${text}" phai khop luat đi vòng`);
    }
    for (const text of ['Đổi nv', 'doi nv', 'Doi nv', 'đoi nv']) {
        const rule = resolveMasterRule(config, { type: 'chat', comment: text });
        assert.equal(rule?.action, 'change', `"${text}" phai khop luat đổi nv`);
    }
});

test('gap đ khong lam khop bua cac tu khac', () => {
    const config = sanitizeMasterConfig({
        rules: [{ id: 'r', enabled: true, source: 'chat', trigger: 'đi vòng', match: 'exact', action: 'walk' }]
    });
    for (const text of ['di', 'vong', 'di vong nha', 'xin chao']) {
        assert.equal(resolveMasterRule(config, { type: 'chat', comment: text }), null,
            `"${text}" khong duoc khop`);
    }
});
