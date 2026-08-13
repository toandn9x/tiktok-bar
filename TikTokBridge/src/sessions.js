'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const MAX_RECORDS = 500;
const MIN_DURATION_MS = 5000; // Bỏ qua phiên bấm nhầm, kết nối rồi ngắt ngay.

let storePath = null;
let records = [];
let writeQueue = Promise.resolve();

function localDay(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function sanitizeRecord(input = {}) {
    const startedAt = Number(input.startedAt) || 0;
    const endedAt = Number(input.endedAt) || 0;
    const count = value => Math.max(0, Math.floor(Number(value) || 0));
    return {
        id: String(input.id || `${startedAt}`).slice(0, 64),
        provider: String(input.provider || 'unknown').slice(0, 24),
        username: String(input.username || '').slice(0, 32),
        startedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - startedAt),
        events: count(input.events),
        members: count(input.members),
        chats: count(input.chats),
        gifts: count(input.gifts),
        diamonds: count(input.diamonds),
        likes: count(input.likes),
        topGifters: (Array.isArray(input.topGifters) ? input.topGifters : [])
            .slice(0, 5)
            .map(gifter => ({
                nickname: String(gifter.nickname || '').slice(0, 60),
                uniqueId: String(gifter.uniqueId || '').slice(0, 40),
                diamonds: count(gifter.diamonds)
            }))
    };
}

function load(filePath) {
    storePath = filePath;
    try {
        fs.mkdirSync(path.dirname(storePath), { recursive: true });
    } catch {
        // Ghi lịch sử là tính năng phụ, không được phép chặn bridge khởi động.
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        records = (Array.isArray(parsed) ? parsed : []).map(sanitizeRecord);
    } catch {
        records = [];
    }
    return records.length;
}

function persist() {
    if (!storePath) return writeQueue;
    const snapshot = `${JSON.stringify(records, null, 2)}\n`;
    // Nối đuôi nhau để hai lần chốt phiên sát nhau không ghi đè lẫn nhau.
    writeQueue = writeQueue
        .then(() => fsp.writeFile(storePath, snapshot, 'utf8'))
        .catch(error => {
            console.warn(`Không lưu được lịch sử phiên: ${error.message}`);
        });
    return writeQueue;
}

/**
 * Chốt một phiên vào lịch sử. Trả về bản ghi đã lưu, hoặc null nếu phiên bị
 * bỏ qua vì quá ngắn hoặc rỗng.
 */
function record(input) {
    const entry = sanitizeRecord(input);
    if (!entry.startedAt || !entry.endedAt) return null;
    if (entry.durationMs < MIN_DURATION_MS || entry.events === 0) return null;

    records.push(entry);
    while (records.length > MAX_RECORDS) records.shift();
    persist();
    return entry;
}

function all() {
    return records;
}

/** Gộp theo ngày để vẽ biểu đồ. Trả về mảng đã sắp xếp tăng dần theo ngày. */
function daily(days = 30) {
    const totals = new Map();
    for (const entry of records) {
        const day = localDay(entry.startedAt);
        if (!day) continue;
        const bucket = totals.get(day) || {
            day, sessions: 0, events: 0, members: 0,
            chats: 0, gifts: 0, diamonds: 0, likes: 0, durationMs: 0
        };
        bucket.sessions += 1;
        bucket.events += entry.events;
        bucket.members += entry.members;
        bucket.chats += entry.chats;
        bucket.gifts += entry.gifts;
        bucket.diamonds += entry.diamonds;
        bucket.likes += entry.likes;
        bucket.durationMs += entry.durationMs;
        totals.set(day, bucket);
    }
    return [...totals.values()]
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-Math.max(1, Math.min(365, days)));
}

/** Chờ mọi lượt ghi đang chờ hoàn tất. Bắt buộc gọi trước khi thoát tiến trình. */
function flush() {
    return writeQueue;
}

module.exports = { load, record, all, daily, localDay, sanitizeRecord, flush };
