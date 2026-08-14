using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace TikTokLiveGame
{
    public static class CharacterLibrary
    {
        // Đã bỏ "d" và "k": hai bộ này có chữ vẽ SẴN TRONG ẢNH sprite — "d" mang
        // dòng chữ Trung Quốc 傻逼来了我走了 (là câu chửi thề), "k" mang dòng
        // "open your eyes". Camera nhìn từ phía +Z nên mọi sprite đều bị lật
        // ngang, chữ trong ảnh hiện ra ngược đọc không nổi, trông như lỗi hiển
        // thị. Muốn dùng lại thì phải xoá chữ khỏi chính file ảnh trong
        // Resources/Characters/, không sửa được bằng code.
        private static readonly string[] Names =
        {
            "a", "b", "c", "e", "g", "h", "j",
            "mushroom_dance_01", "mushroom_dance_15", "mushroom_magic_02",
            "hanhan_video_dance"
        };

        private static readonly Dictionary<string, Sprite[]> Cache = new();

        public static (string name, Sprite[] frames) RandomCharacter(string except = null)
        {
            string[] choices = Names.Where(name => name != except).ToArray();
            string name = choices[UnityEngine.Random.Range(0, choices.Length)];
            return (name, Load(name));
        }

        private static Sprite[] Load(string name)
        {
            if (Cache.TryGetValue(name, out Sprite[] cached)) return cached;
            Sprite[] frames = Resources.LoadAll<Sprite>($"Characters/{name}")
                .OrderBy(sprite => sprite.name, StringComparer.Ordinal)
                .ToArray();
            Cache[name] = frames;
            return frames;
        }
    }
}
