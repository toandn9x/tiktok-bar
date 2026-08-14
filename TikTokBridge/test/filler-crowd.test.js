'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFillerCrowd, clampCount, clampInterval, MAX_COUNT } = require('../src/filler-crowd');
const { sanitizeGameEvent } = require('../src/security');

function collector() {
    const events = [];
    return { events, emit: event => events.push(event) };
}

test('sinh đủ số nhân vật, mỗi người có tên và userId riêng', () => {
    const { events, emit } = collector();
    const crowd = createFillerCrowd({ emit });
    const result = crowd.spawn(8, 4000);
    crowd.clear();

    assert.equal(result.count, 8);
    assert.equal(events.length, 8, 'mỗi nhân vật một sự kiện member');
    assert.ok(events.every(e => e.type === 'member'));

    const ids = new Set(events.map(e => e.userId));
    assert.equal(ids.size, 8, 'userId phải khác nhau hết');
    assert.ok(events.every(e => e.nickname && e.nickname.trim().length > 0), 'ai cũng phải có tên');
});

test('mọi sự kiện nhân vật nền đều mang cờ synthetic', () => {
    const { events, emit } = collector();
    const crowd = createFillerCrowd({ emit });
    crowd.spawn(5, 4000);
    crowd.clear();
    assert.ok(events.every(e => e.synthetic === true), 'thiếu cờ là sẽ lọt vào thống kê');
});

test('cờ synthetic sống sót qua bộ lọc bảo mật', () => {
    // Nếu sanitizeGameEvent nuốt mất cờ này thì nhân vật nền sẽ bị tính vào
    // metrics, Top tặng quà và lịch sử phiên — làm sai báo cáo doanh thu.
    const safe = sanitizeGameEvent({
        type: 'chat', userId: 'filler-1', nickname: 'Bảo Bảo',
        comment: 'dance', synthetic: true
    });
    assert.equal(safe.synthetic, true);

    const real = sanitizeGameEvent({ type: 'chat', userId: 'u1', nickname: 'Người thật', comment: 'hey' });
    assert.equal(real.synthetic, false, 'người thật không được nhiễm cờ synthetic');
});

test('không bao giờ phát gift hay like giả', () => {
    const { events, emit } = collector();
    const crowd = createFillerCrowd({ emit });
    crowd.spawn(6, 500);

    // Chạy ticker thủ công nhiều lần thay vì chờ đồng hồ thật
    for (let i = 0; i < 300; i += 1) crowd.setInterval(500);
    crowd.clear();

    const kinds = new Set(events.map(e => e.type));
    assert.ok(!kinds.has('gift'), 'gift giả sẽ hiện lên HUD và bảng Top tặng quà');
    assert.ok(!kinds.has('like'), 'like giả sẽ làm sai số like của phiên');
});

test('ticker chỉ phát hành động hình ảnh', async () => {
    const { events, emit } = collector();
    const crowd = createFillerCrowd({ emit });
    crowd.spawn(4, 500);
    await new Promise(resolve => setTimeout(resolve, 1300));
    crowd.clear();

    const ticks = events.filter(e => e.type === 'chat');
    assert.ok(ticks.length >= 1, 'phải có ít nhất một hành động sau 1.3 giây với chu kỳ 0.5s');
    const allowed = new Set(['dance', 'đi vòng', 'đổi nv']);
    assert.ok(ticks.every(e => allowed.has(e.comment)), 'chỉ được nhảy, đi vòng, đổi nhân vật');
});

test('clear dừng hẳn ticker, không còn sự kiện nào nữa', async () => {
    const { events, emit } = collector();
    const crowd = createFillerCrowd({ emit });
    crowd.spawn(4, 500);
    crowd.clear();
    const afterClear = events.length;

    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(events.length, afterClear, 'clear rồi mà vẫn phát thì đã rò đồng hồ');
    assert.deepEqual(crowd.state(), { count: 0, intervalMs: 500, running: false });
    assert.deepEqual(crowd.userIds(), []);
});

test('spawn lại thì thay nhóm cũ chứ không cộng dồn', () => {
    const { emit } = collector();
    const crowd = createFillerCrowd({ emit });
    crowd.spawn(10, 4000);
    crowd.spawn(3, 4000);
    assert.equal(crowd.state().count, 3);
    assert.equal(crowd.userIds().length, 3);
    crowd.clear();
});

test('kẹp số lượng và chu kỳ về khoảng an toàn', () => {
    assert.equal(clampCount(-5), 0);
    assert.equal(clampCount(9999), MAX_COUNT);
    assert.equal(clampCount('abc', 12), 12, 'giá trị rác thì dùng mặc định');

    assert.equal(clampInterval(10), 500, 'chu kỳ quá ngắn sẽ làm ngập pipeline');
    assert.equal(clampInterval(999999), 120000);
    assert.equal(clampInterval('abc', 4000), 4000);
});
