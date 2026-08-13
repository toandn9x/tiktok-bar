'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sessions = require('../src/sessions');
const logger = require('../src/logger');

function tempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('bỏ qua phiên quá ngắn hoặc không có sự kiện nào', () => {
    const store = path.join(tempDir('sess-'), 'sessions.json');
    sessions.load(store);
    const now = Date.now();

    assert.equal(sessions.record({ startedAt: now, endedAt: now + 1000, events: 50 }), null,
        'phiên dưới 5 giây phải bị bỏ qua');
    assert.equal(sessions.record({ startedAt: now, endedAt: now + 60000, events: 0 }), null,
        'phiên không có sự kiện phải bị bỏ qua');
    assert.equal(sessions.all().length, 0);
});

test('chốt phiên rồi gộp theo ngày để vẽ biểu đồ', async () => {
    const store = path.join(tempDir('sess-'), 'sessions.json');
    sessions.load(store);
    const day = new Date('2026-03-04T20:00:00').getTime();

    sessions.record({
        id: 'a', provider: 'eulerstream', username: 'kenh1',
        startedAt: day, endedAt: day + 600000,
        events: 120, members: 8, chats: 40, gifts: 6, diamonds: 900, likes: 66,
        topGifters: [{ nickname: 'Tèo', uniqueId: 'teo', diamonds: 700 }]
    });
    sessions.record({
        id: 'b', provider: 'tikfinity', username: 'kenh1',
        startedAt: day + 3600000, endedAt: day + 4200000,
        events: 80, gifts: 4, diamonds: 100
    });

    assert.equal(sessions.all().length, 2);

    const daily = sessions.daily(30);
    assert.equal(daily.length, 1, 'hai phiên cùng ngày phải gộp thành một cột');
    assert.equal(daily[0].day, '2026-03-04');
    assert.equal(daily[0].sessions, 2);
    assert.equal(daily[0].diamonds, 1000);
    assert.equal(daily[0].events, 200);

    // Phải ghi thật xuống đĩa để tắt server không mất lịch sử.
    await sessions.flush();
    const saved = JSON.parse(fs.readFileSync(store, 'utf8'));
    assert.equal(saved.length, 2);
    assert.equal(saved[0].topGifters[0].nickname, 'Tèo');
});

test('cắt bớt và làm sạch dữ liệu phiên không đáng tin', () => {
    const entry = sessions.sanitizeRecord({
        startedAt: 1000, endedAt: 2000,
        events: -50, diamonds: 'abc',
        username: 'x'.repeat(200),
        topGifters: Array.from({ length: 20 }, (_, i) => ({ nickname: 'u' + i, diamonds: i }))
    });
    assert.equal(entry.events, 0, 'số âm phải bị kẹp về 0');
    assert.equal(entry.diamonds, 0, 'chuỗi không phải số phải thành 0');
    assert.equal(entry.username.length, 32, 'username phải bị cắt ngắn');
    assert.equal(entry.topGifters.length, 5, 'chỉ giữ tối đa 5 người tặng nhiều nhất');
});

test('logger ghi ra file theo ngày và giữ được bộ đệm đọc nhanh', async () => {
    const dir = tempDir('logs-');
    logger.configure(dir);
    logger.info('bridge', 'khởi động xong');
    logger.error('eulerstream', 'không kết nối được', 'chi tiết lỗi');
    await logger.flush();

    const recent = logger.recent(10);
    assert.ok(recent.length >= 2);
    const last = recent[recent.length - 1];
    assert.equal(last.level, 'error');
    assert.equal(last.scope, 'eulerstream');

    const files = fs.readdirSync(dir).filter(name => name.endsWith('.log'));
    assert.equal(files.length, 1, 'mỗi ngày đúng một file log');
    assert.match(files[0], /^\d{4}-\d{2}-\d{2}\.log$/);
});

test('dịch lỗi EulerStream sang hướng dẫn xử lý cụ thể', () => {
    assert.match(logger.explainEulerError('Request failed with status code 401'), /API key/i);
    assert.match(logger.explainEulerError('429 Too Many Requests'), /quota/i);
    assert.match(logger.explainEulerError('getaddrinfo ENOTFOUND tiktok.eulerstream.com'), /mạng|tường lửa/i);
    assert.match(logger.explainEulerError('user is not live'), /LIVE|username/i);
    assert.equal(logger.explainEulerError('một lỗi lạ hoắc'), '', 'lỗi không nhận ra thì không bịa hướng dẫn');
});

test('thư mục log hỏng không được làm sập bridge', () => {
    const file = path.join(tempDir('logs-'), 'chan-duong');
    fs.writeFileSync(file, 'day la file chu khong phai thu muc');
    // configure() trỏ vào một file -> mkdir thất bại, nhưng phải nuốt lỗi.
    assert.doesNotThrow(() => logger.configure(path.join(file, 'logs')));
    assert.doesNotThrow(() => logger.warn('bridge', 'vẫn phải chạy tiếp'));
});
