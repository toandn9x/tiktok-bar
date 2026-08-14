const crypto = require('node:crypto');

const SOURCES = new Set(['chat', 'gift']);
// Phải khớp đúng các nhánh action mà PlayerManager.ApplyAction xử lý bên Unity,
// và khớp danh sách <option> trong control.html. Thiếu ở đây thì hành động đó
// vẫn chạy được nhưng không ai chọn được từ bảng Master.
const ACTIONS = new Set([
    'join', 'drop', 'dance', 'jump', 'walk', 'change', 'grow',
    'camera', 'medal', 'vip', 'topdj', 'fireworks'
]);

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase('vi')
        // \u0111 (U+0111) la mot chu cai rieng chu khong phai d + dau, nen NFD khong
        // tach ra duoc va no song sot qua buoc bo dau o tren. Khong gap ve d
        // thi nguoi xem go "di vong" se KHONG khop trigger "\u0110i v\u00f2ng" \u2014 ma go
        // khong dau moi la cach go chinh tren dien thoai.
        .replace(/\u0111/g, 'd');
}

function splitTriggers(value) {
    return String(value || '').split(',').map(normalizeText).filter(Boolean).slice(0, 20);
}

function sanitizeRule(input = {}) {
    const generatedId = crypto.randomUUID();
    return {
        id: String(input.id || generatedId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || generatedId,
        enabled: input.enabled !== false,
        source: SOURCES.has(input.source) ? input.source : 'gift',
        trigger: String(input.trigger || '').trim().slice(0, 300),
        giftId: String(input.giftId || '').trim().slice(0, 80),
        match: input.match === 'contains' ? 'contains' : 'exact',
        action: ACTIONS.has(input.action) ? input.action : 'dance',
        displayDiamonds: Math.max(0, Math.min(1000000, Number(input.displayDiamonds) || 0)),
        durationMs: Math.max(0, Math.min(300000, Number(input.durationMs) || 0)),
        label: String(input.label || '').trim().slice(0, 80),
        variant: ['aura', 'neon', 'fire', 'royal'].includes(input.variant) ? input.variant : '',
        fireworkBursts: Math.max(0, Math.min(12, Number(input.fireworkBursts) || 0))
    };
}

function sanitizeMasterConfig(input = {}) {
    return {
        joinMode: input.joinMode === 'all_interactions' ? 'all_interactions' : 'keyword_only',
        giftAlwaysJoins: input.giftAlwaysJoins !== false,
        rules: Array.isArray(input.rules) ? input.rules.slice(0, 100).map(sanitizeRule) : []
    };
}

function matchesRule(rule, event) {
    if (!rule.enabled || rule.source !== event.type) return false;
    if (rule.source === 'gift' && rule.giftId && String(event.giftId || '') === rule.giftId) return true;
    const value = normalizeText(rule.source === 'chat' ? event.comment : event.giftName);
    if (!value) return false;
    return splitTriggers(rule.trigger).some(trigger => rule.match === 'contains' ? value.includes(trigger) : value === trigger);
}

function resolveMasterRule(config, event) {
    if (event.type === 'gift' && event.giftId) {
        const byId = (config.rules || []).find(rule =>
            rule.enabled && rule.source === 'gift' && rule.giftId === String(event.giftId));
        if (byId) return byId;
    }
    return (config.rules || []).find(rule => matchesRule(rule, event)) || null;
}

function applyRule(event, rule) {
    if (!rule) return { ...event };
    return {
        ...event,
        action: rule.action,
        durationMs: rule.durationMs,
        label: rule.label,
        variant: rule.variant,
        fireworkBursts: rule.fireworkBursts,
        masterRuleId: rule.id
    };
}

/**
 * Lệnh chat dựng sẵn, chỉ là phương án dự phòng khi người dùng chưa cấu hình gì.
 *
 * Luật trong bảng Master phải THẮNG lệnh dựng sẵn. Trước đây hàm này ghi đè vô
 * điều kiện, nên ai gõ "nhảy" cũng bị đổi thành `jump` (bật tại chỗ 0,95 giây)
 * dù người dùng đã cấu hình hẳn luật `dance` cho đúng từ đó — nhìn như luật
 * không chạy, mà thật ra chạy rồi rồi bị ghi đè ngay sau đó.
 */
function applyBuiltInChatCommand(event) {
    if (event.type !== 'chat') return event;
    if (event.masterRuleId) return event;
    const command = normalizeText(event.comment);
    if (command !== 'jump' && command !== 'nhay') return event;
    return { ...event, action: 'jump', durationMs: 950, masterRuleId: '' };
}

module.exports = { normalizeText, sanitizeMasterConfig, resolveMasterRule, applyRule, applyBuiltInChatCommand };
