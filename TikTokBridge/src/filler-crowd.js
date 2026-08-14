'use strict';

/**
 * Nhân vật nền cho sàn nhảy.
 *
 * Sinh ra một nhóm nhân vật có tên và avatar để phòng đỡ trống khi live thật
 * còn ít người tương tác. Mọi sự kiện phát ra đều mang cờ `synthetic: true`
 * nên bị loại khỏi metrics, bảng Top tặng quà và lịch sử phiên — báo cáo
 * doanh thu vẫn chỉ phản ánh người thật.
 *
 * Chỉ phát các hành động thuần hình ảnh (nhảy, đi vòng, đổi nhân vật). Không
 * bao giờ sinh gift hay like giả, vì hai thứ đó hiện lên HUD và sẽ khiến người
 * xem thật tưởng phòng đang có giao dịch.
 */

const NAMES = [
    'Bảo Bảo', 'Tí Nị', 'Mèo Mun', 'Bún Bò', 'Kẹo Dẻo', 'Bơ Sữa',
    'Cà Rốt', 'Xù Xì', 'Nhóc Bi', 'Tủn Tỉn', 'Mập Ú', 'Bi Bo',
    'Chuối Sấy', 'Đậu Hũ', 'Sữa Chua', 'Bánh Bao', 'Hạt Dẻ', 'Kem Bơ',
    'Mochi', 'Pudding', 'Xoài Non', 'Dứa Ngọt', 'Nhãn Lồng', 'Vải Thiều',
    'Lu Lu', 'Bột Mì', 'Chè Bưởi', 'Trà Sữa', 'Bắp Nướng', 'Khoai Lang'
];

// Chỉ hành động hình ảnh. Trọng số cho nhảy chiếm đa số cho tự nhiên.
const ACTIONS = [
    'dance', 'dance', 'dance', 'dance',
    'walk', 'walk',
    'change'
];

const MIN_INTERVAL_MS = 500;
const MAX_INTERVAL_MS = 120000;
const MAX_COUNT = 60;

function clampCount(value, fallback = 12) {
    const count = Math.floor(Number(value));
    if (!Number.isFinite(count)) return fallback;
    return Math.min(MAX_COUNT, Math.max(0, count));
}

function clampInterval(value, fallback = 4000) {
    const ms = Math.floor(Number(value));
    if (!Number.isFinite(ms)) return fallback;
    return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, ms));
}

/**
 * @param {object} options
 * @param {(event: object) => void} options.emit   Đẩy một sự kiện vào pipeline.
 * @param {() => number} [options.now]
 */
function createFillerCrowd({ emit, now = () => Date.now() }) {
    let members = [];
    let timer = null;
    let intervalMs = 4000;

    function eventId(kind, id) {
        return `filler-${kind}-${id}-${now()}-${Math.random()}`;
    }

    function makeMember(index) {
        const name = NAMES[index % NAMES.length];
        // Trùng tên thì thêm số cho khỏi lẫn khi vượt quá số tên có sẵn.
        const suffix = index >= NAMES.length ? ` ${Math.floor(index / NAMES.length) + 1}` : '';
        return {
            userId: `filler-${index}`,
            uniqueId: `filler_${index}`,
            nickname: `${name}${suffix}`,
            // Để trống thì Unity tự gán một trong 16 avatar NPC dựng sẵn,
            // chọn ổn định theo userId nên mỗi nhân vật luôn ra cùng một ảnh.
            avatar: ''
        };
    }

    function tick() {
        if (members.length === 0) return;
        const member = members[Math.floor(Math.random() * members.length)];
        const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
        const comment = action === 'dance' ? 'dance' : action === 'walk' ? 'đi vòng' : 'đổi nv';
        emit({
            type: 'chat',
            eventId: eventId(action, member.userId),
            ...member,
            comment,
            synthetic: true
        });
    }

    return {
        /** Sinh `count` nhân vật nền và bắt đầu cho họ hoạt động mỗi `intervalMs`. */
        spawn(count, requestedIntervalMs) {
            this.clear();
            const total = clampCount(count);
            intervalMs = clampInterval(requestedIntervalMs, intervalMs);
            members = Array.from({ length: total }, (_, index) => makeMember(index));

            for (const member of members) {
                emit({
                    type: 'member',
                    eventId: eventId('join', member.userId),
                    ...member,
                    synthetic: true
                });
            }
            if (total > 0) timer = setInterval(tick, intervalMs);
            return { count: total, intervalMs };
        },

        /** Đổi chu kỳ mà không phải sinh lại cả nhóm. */
        setInterval(requestedIntervalMs) {
            intervalMs = clampInterval(requestedIntervalMs, intervalMs);
            if (timer) {
                clearInterval(timer);
                timer = setInterval(tick, intervalMs);
            }
            return intervalMs;
        },

        /** Dừng hoạt động và quên hết nhân vật nền. */
        clear() {
            if (timer) clearInterval(timer);
            timer = null;
            members = [];
        },

        /** Danh sách userId đang giữ, để bên ngoài dọn khỏi phiên nếu cần. */
        userIds() {
            return members.map(member => member.userId);
        },

        state() {
            return { count: members.length, intervalMs, running: timer !== null };
        }
    };
}

module.exports = { createFillerCrowd, clampCount, clampInterval, MAX_COUNT, MIN_INTERVAL_MS, MAX_INTERVAL_MS };
