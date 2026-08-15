using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace TikTokLiveGame
{
    public sealed class AvatarService : MonoBehaviour
    {
        private readonly Dictionary<string, CacheEntry> cache = new();
        private readonly LinkedList<string> cacheRecency = new();
        private readonly Dictionary<string, List<Action<Sprite>>> waiting = new();
        private readonly Queue<string> queue = new();
        private int activeDownloads;
        private const int MaximumConcurrent = 4;
        // PlayerManager giữ tối đa 400 người. Phần đệm 50 avatar bảo đảm cache
        // chỉ loại tài nguyên của user đã rời sàn hoặc avatar cũ đã được thay.
        private const int MaximumCached = 450;
        public static AvatarService Instance { get; private set; }

        private void Awake()
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public void Load(string url, Action<Sprite> callback)
        {
            if (string.IsNullOrWhiteSpace(url) || (!url.StartsWith("https://") && !url.StartsWith("http://"))) return;
            if (cache.TryGetValue(url, out CacheEntry cached))
            {
                Touch(cached);
                callback?.Invoke(cached.Sprite);
                return;
            }
            if (waiting.TryGetValue(url, out List<Action<Sprite>> callbacks))
            {
                callbacks.Add(callback);
                return;
            }
            waiting[url] = new List<Action<Sprite>> { callback };
            queue.Enqueue(url);
            Pump();
        }

        private void Pump()
        {
            while (activeDownloads < MaximumConcurrent && queue.Count > 0)
            {
                activeDownloads++;
                StartCoroutine(Download(queue.Dequeue()));
            }
        }

        private IEnumerator Download(string url)
        {
            Sprite result = null;
            using UnityWebRequest request = UnityWebRequestTexture.GetTexture(url, true);
            request.timeout = 10;
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success)
            {
                Texture2D texture = DownloadHandlerTexture.GetContent(request);
                texture.wrapMode = TextureWrapMode.Clamp;
                texture.filterMode = FilterMode.Bilinear;
                int side = Mathf.Min(texture.width, texture.height);
                Rect rect = new((texture.width - side) * 0.5f, (texture.height - side) * 0.5f, side, side);
                result = Sprite.Create(texture, rect, new Vector2(0.5f, 0.5f), side);
                AddToCache(url, result);
            }
            if (waiting.Remove(url, out List<Action<Sprite>> callbacks))
                foreach (Action<Sprite> callback in callbacks) callback?.Invoke(result);
            activeDownloads--;
            Pump();
        }

        private void AddToCache(string url, Sprite sprite)
        {
            LinkedListNode<string> node = cacheRecency.AddLast(url);
            cache[url] = new CacheEntry(sprite, node);
            while (cache.Count > MaximumCached && cacheRecency.First != null)
            {
                string oldestUrl = cacheRecency.First.Value;
                cacheRecency.RemoveFirst();
                if (!cache.Remove(oldestUrl, out CacheEntry oldest)) continue;
                Texture2D texture = oldest.Sprite != null ? oldest.Sprite.texture : null;
                if (oldest.Sprite != null) Destroy(oldest.Sprite);
                if (texture != null) Destroy(texture);
            }
        }

        private void Touch(CacheEntry entry)
        {
            cacheRecency.Remove(entry.Node);
            cacheRecency.AddLast(entry.Node);
        }

        private void OnDestroy()
        {
            foreach (CacheEntry entry in cache.Values)
            {
                Texture2D texture = entry.Sprite != null ? entry.Sprite.texture : null;
                if (entry.Sprite != null) Destroy(entry.Sprite);
                if (texture != null) Destroy(texture);
            }
            cache.Clear();
            cacheRecency.Clear();
            if (Instance == this) Instance = null;
        }

        private sealed class CacheEntry
        {
            public Sprite Sprite { get; }
            public LinkedListNode<string> Node { get; }

            public CacheEntry(Sprite sprite, LinkedListNode<string> node)
            {
                Sprite = sprite;
                Node = node;
            }
        }
    }
}
