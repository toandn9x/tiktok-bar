function normalizeUser(data = {}) {
    const user = data.user || data;
    const profilePicture = user.profilePicture || {};
    const avatarSources = [
        profilePicture.urls,
        profilePicture.urlList,
        user.avatarThumb?.urlList,
        user.avatarMedium?.urlList,
        user.avatarLarge?.urlList,
        user.profilePictureUrls
    ];
    const candidates = avatarSources
        .flatMap(source => Array.isArray(source) ? source : [source])
        .filter(url => typeof url === 'string' && /^https?:\/\//i.test(url));

    // UnityWebRequestTexture chi giai ma duoc JPEG/PNG, khong doc duoc WebP.
    // TikTok tra ve 6 URL cho moi avatar, URL dau tien luon la .webp nen lay
    // bua la Unity tai ve roi bo, nhan vat mai mai dung avatar NPC du phong.
    // Trong 6 URL do luon co vai ban .jpeg da ky hop le — phai chon dung ban do.
    // Doi duoi tren URL khong duoc: chu ky x-signature se vo, may chu tra 403.
    // normalize-tikfinity-event.js co cung logic nay, sua thi sua ca hai.
    const avatar = candidates.find(url => /\.(?:jpe?g|png)(?:[?~]|$)/i.test(url)) ||
        candidates[0] ||
        user.profilePictureUrl ||
        '';
    const fallbackId = user.uniqueId || user.nickname || `guest-${Date.now()}`;

    return {
        userId: String(user.userId || fallbackId),
        uniqueId: String(user.uniqueId || fallbackId),
        nickname: String(user.nickname || user.uniqueId || 'TikTok user'),
        avatar: String(avatar)
    };
}

function eventId(data = {}) {
    return String(data.event?.msgId || data.common?.msgId || data.msgId || '');
}

function normalizeChat(data) {
    return {
        type: 'chat',
        eventId: eventId(data),
        ...normalizeUser(data),
        // tiktok-live-connector v2 dung proto v3, trong do truong noi dung chat
        // da doi ten tu `comment` (v1/v2) thanh `content`. Doc thieu `content`
        // thi moi tin nhan that deu ve rong, khong luat chat nao khop duoc.
        comment: String(data.content ?? data.comment ?? '')
    };
}

function normalizeMember(data) {
    return {
        type: 'member',
        eventId: eventId(data),
        ...normalizeUser(data)
    };
}

function normalizeGift(data) {
    // Proto v3 goi khoi chi tiet qua la `gift`; ban cu goi la `giftDetails`
    // hoac `extendedGiftInfo`. Trong v3 ten qua nam o `gift.name` chu khong
    // phai `giftName`, va loai qua nam o `gift.type`.
    const details = data.gift || data.giftDetails || data.extendedGiftInfo || {};
    const repeatCount = Math.max(1, Number(data.repeatCount) || 1);
    const diamondCount = Math.max(
        0,
        Number(details.diamondCount ?? data.diamondCount) || 0
    );

    return {
        type: 'gift',
        eventId: eventId(data),
        ...normalizeUser(data),
        giftId: String(data.giftId || details.id || ''),
        giftName: String(details.name || details.giftName || data.giftName || 'Gift'),
        giftType: Number(details.type ?? details.giftType ?? data.giftType) || 0,
        repeatCount,
        repeatEnd: Boolean(data.repeatEnd),
        diamondCount: diamondCount * repeatCount
    };
}

function normalizeLike(data) {
    return {
        type: 'like',
        eventId: eventId(data),
        ...normalizeUser(data),
        // Proto v3 doi ten `likeCount` -> `count` va `totalLikeCount` -> `total`
        likeCount: Math.max(1, Number(data.count ?? data.likeCount) || 1),
        totalLikeCount: Math.max(0, Number(data.total ?? data.totalLikeCount) || 0)
    };
}

function normalizeSocial(type, data) {
    return {
        type,
        eventId: eventId(data),
        ...normalizeUser(data)
    };
}

function isPendingGiftStreak(event) {
    return event.giftType === 1 && !event.repeatEnd;
}

module.exports = {
    normalizeUser,
    normalizeChat,
    normalizeMember,
    normalizeGift,
    normalizeLike,
    normalizeSocial,
    isPendingGiftStreak
};
