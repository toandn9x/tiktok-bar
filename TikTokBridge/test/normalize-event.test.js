const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeChat,
    normalizeMember,
    normalizeGift,
    normalizeLike,
    isPendingGiftStreak
} = require('../src/tiktok/normalize-event');
const { normalizeTikFinityMessage } = require('../src/tiktok/normalize-tikfinity-event');

test('normalizes v2 nested chat user data', () => {
    const event = normalizeChat({
        event: { msgId: 'chat-1' },
        user: {
            userId: '42',
            uniqueId: 'viewer',
            nickname: 'Viewer',
            profilePicture: { urls: ['https://example.com/avatar.jpg'] }
        },
        comment: 'nhảy'
    });

    assert.equal(event.userId, '42');
    assert.equal(event.nickname, 'Viewer');
    assert.equal(event.avatar, 'https://example.com/avatar.jpg');
    assert.equal(event.comment, 'nhảy');
});

test('normalizes avatar URLs from legacy and raw TikTok user shapes', () => {
    const legacy = normalizeMember({
        userId: 'legacy-1',
        uniqueId: 'legacy_viewer',
        nickname: 'Legacy Viewer',
        profilePictureUrl: 'https://example.com/legacy.jpg'
    });
    const raw = normalizeMember({
        user: {
            userId: 'raw-1',
            uniqueId: 'raw_viewer',
            nickname: 'Raw Viewer',
            avatarThumb: { urlList: ['https://example.com/raw.jpg'] }
        }
    });

    assert.equal(legacy.avatar, 'https://example.com/legacy.jpg');
    assert.equal(raw.avatar, 'https://example.com/raw.jpg');
});

test('normalizes gift value and detects unfinished streaks', () => {
    const pending = normalizeGift({
        user: { userId: '7', uniqueId: 'gifter' },
        giftId: 5655,
        repeatCount: 3,
        repeatEnd: 0,
        giftDetails: {
            giftName: 'Rose',
            giftType: 1,
            diamondCount: 1
        }
    });

    assert.equal(pending.diamondCount, 3);
    assert.equal(isPendingGiftStreak(pending), true);

    const finished = { ...pending, repeatEnd: true };
    assert.equal(isPendingGiftStreak(finished), false);
});

test('normalizes TikFinity chat and gift envelopes', () => {
    const [chat] = normalizeTikFinityMessage(JSON.stringify({
        event: 'chat',
        data: {
            msgId: 'tf-chat-1',
            user: { userId: '21', uniqueId: 'viewer21', nickname: 'Viewer 21' },
            comment: 'hey'
        }
    }));
    const [gift] = normalizeTikFinityMessage({
        event: 'gift',
        data: {
            eventId: 'tf-gift-1',
            userId: '21',
            uniqueId: 'viewer21',
            nickname: 'Viewer 21',
            gift: {
                id: 5655,
                name: 'Rose',
                diamondCount: 1,
                giftImage: { url: ['https://example.com/rose.png'] }
            },
            repeatCount: 3
        }
    });

    assert.equal(chat.type, 'chat');
    assert.equal(chat.comment, 'hey');
    assert.equal(gift.type, 'gift');
    assert.equal(gift.giftName, 'Rose');
    assert.equal(gift.diamondCount, 3);
    assert.equal(gift.unitDiamondCount, 1);
    assert.equal(gift.giftPictureUrl, 'https://example.com/rose.png');
    assert.equal(gift.repeatEnd, true);
});

test('prefers TikFinity JPEG avatar variant that Unity can decode', () => {
    const [chat] = normalizeTikFinityMessage({
        event: 'chat',
        data: {
            userId: '22',
            uniqueId: 'viewer22',
            nickname: 'Viewer 22',
            profilePictureUrl: 'https://example.com/avatar.webp?token=1',
            userDetails: {
                profilePictureUrls: [
                    'https://example.com/avatar.webp?token=2',
                    'https://example.com/avatar.jpeg?token=3'
                ]
            },
            comment: 'hey'
        }
    });

    assert.equal(chat.avatar, 'https://example.com/avatar.jpeg?token=3');
});

test('doc duoc su kien dang proto v3 cua tiktok-live-connector v2', () => {
    // v3 doi ten truong so voi v1/v2. Doc thieu la moi tin nhan that ve rong,
    // khong luat chat nao khop duoc — da tung xay ra tren live that.
    const chat = normalizeChat({
        common: { msgId: 'm1' },
        user: { userId: '7', uniqueId: 'teo', nickname: 'Tèo' },
        content: 'nhảy'              // v3 dung `content`, khong phai `comment`
    });
    assert.equal(chat.comment, 'nhảy');
    assert.equal(chat.eventId, 'm1');

    const like = normalizeLike({
        common: { msgId: 'm2' },
        user: { userId: '8' },
        count: 15,                   // v3: `count` thay cho `likeCount`
        total: '240'                 // v3: `total` thay cho `totalLikeCount`
    });
    assert.equal(like.likeCount, 15);
    assert.equal(like.totalLikeCount, 240);

    const gift = normalizeGift({
        common: { msgId: 'm3' },
        user: { userId: '9' },
        giftId: '5655',
        repeatCount: 3,
        repeatEnd: 1,
        gift: { id: '5655', name: 'Rose', type: 1, diamondCount: 5 }  // v3: khoi `gift`
    });
    assert.equal(gift.giftName, 'Rose');
    assert.equal(gift.giftType, 1);
    assert.equal(gift.diamondCount, 15, '5 kim cuong x 3 lan');
});

test('van doc duoc dang cu de khong vo nguoi dung cai ban truoc', () => {
    assert.equal(normalizeChat({ comment: 'hey', user: {} }).comment, 'hey');
    assert.equal(normalizeLike({ likeCount: 4, user: {} }).likeCount, 4);
    const old = normalizeGift({ giftDetails: { giftName: 'Hoa', diamondCount: 2 }, repeatCount: 1, user: {} });
    assert.equal(old.giftName, 'Hoa');
    assert.equal(old.diamondCount, 2);
});

test('chon avatar JPEG ma Unity giai ma duoc, khong lay WebP', () => {
    // TikTok tra 6 URL cho moi avatar, URL dau tien luon la .webp.
    // UnityWebRequestTexture khong doc duoc WebP nen phai chon ban .jpeg.
    const chat = normalizeChat({
        common: { msgId: 'm9' },
        content: 'hey',
        user: {
            userId: '5', uniqueId: 'v5', nickname: 'V5',
            avatarThumb: {
                urlList: [
                    'https://p16.tiktokcdn.com/a~tplv-tiktok-shrink:72:72.webp?x-signature=aaa',
                    'https://p19.tiktokcdn.com/a~tplv-tiktok-shrink:72:72.webp?x-signature=bbb',
                    'https://p16.tiktokcdn.com/a~tplv-tiktok-shrink:72:72.jpeg?x-signature=ccc'
                ]
            }
        }
    });
    assert.match(chat.avatar, /\.jpeg\?/, 'phai chon ban JPEG');
    assert.equal(chat.avatar, 'https://p16.tiktokcdn.com/a~tplv-tiktok-shrink:72:72.jpeg?x-signature=ccc');
});

test('chi co WebP thi van lay, tha co avatar mo con hon khong co', () => {
    const chat = normalizeChat({
        content: 'hey',
        user: { userId: '6', avatarThumb: { urlList: ['https://p16.tiktokcdn.com/b.webp?s=1'] } }
    });
    assert.equal(chat.avatar, 'https://p16.tiktokcdn.com/b.webp?s=1');
});
