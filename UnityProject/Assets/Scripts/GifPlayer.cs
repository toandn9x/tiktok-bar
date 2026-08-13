using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TikTokLiveGame
{
    public sealed class GifPlayer : MonoBehaviour
    {
        public string FrameDirectory;
        public float FrameRate = 24f;
        public int BufferAhead = 60;
        public int BufferBehind = 5;

        private string[] frameFiles = Array.Empty<string>();
        private readonly Dictionary<int, Texture2D> frameCache = new();
        private Renderer targetRenderer;
        private Material runtimeMaterial;
        private bool isReady = false;
        private int currentFrame = 0;
        private float frameTimer = 0f;

        private void Start()
        {
            targetRenderer = GetComponent<Renderer>();
            
            // Cài đặt material hỗ trợ trong suốt (Transparent Unlit)
            Shader transparentShader = Shader.Find("Unlit/Transparent");
            if (transparentShader == null) transparentShader = Shader.Find("Sprites/Default");
            
            runtimeMaterial = new Material(transparentShader);
            targetRenderer.sharedMaterial = runtimeMaterial;

            StartCoroutine(LoadFramesAsync());
        }

        private IEnumerator LoadFramesAsync()
        {
            if (!Directory.Exists(FrameDirectory))
            {
                Debug.LogWarning($"GifPlayer: Directory not found - {FrameDirectory}");
                yield break;
            }

            frameFiles = Directory.GetFiles(FrameDirectory, "*.png");
            Array.Sort(frameFiles); // Ensure correct order

            if (frameFiles.Length == 0)
            {
                Debug.LogWarning("GifPlayer: No PNG frames found in " + FrameDirectory);
                yield break;
            }

            int initialBufferSize = Mathf.Min(Mathf.Max(8, BufferAhead), frameFiles.Length);
            for (int i = 0; i < initialBufferSize; i++)
            {
                LoadFrame(i);
                if (i % 4 == 0) yield return null;
            }

            if (frameCache.TryGetValue(0, out Texture2D firstFrame))
                runtimeMaterial.mainTexture = firstFrame;
            isReady = true;
            StartCoroutine(StreamFramesAsync());
            Debug.Log($"GifPlayer: Streaming {frameFiles.Length} frames with a {initialBufferSize}-frame buffer.");
        }

        private IEnumerator StreamFramesAsync()
        {
            while (enabled && frameFiles.Length > 0)
            {
                int loadIndex = -1;
                int ahead = Mathf.Min(Mathf.Max(8, BufferAhead), frameFiles.Length);
                for (int offset = 0; offset < ahead; offset++)
                {
                    int index = WrapIndex(currentFrame + offset);
                    if (!frameCache.ContainsKey(index))
                    {
                        loadIndex = index;
                        break;
                    }
                }

                if (loadIndex >= 0) LoadFrame(loadIndex);
                PruneCache(ahead);
                yield return null;
            }
        }

        private void LoadFrame(int index)
        {
            if (index < 0 || index >= frameFiles.Length || frameCache.ContainsKey(index)) return;
            try
            {
                byte[] fileData = File.ReadAllBytes(frameFiles[index]);
                Texture2D texture = new Texture2D(2, 2, TextureFormat.RGBA32, false)
                {
                    filterMode = FilterMode.Bilinear,
                    wrapMode = TextureWrapMode.Clamp
                };
                if (!texture.LoadImage(fileData))
                {
                    Destroy(texture);
                    return;
                }
                texture.Apply(false, true);
                frameCache[index] = texture;
            }
            catch (Exception exception)
            {
                Debug.LogWarning($"GifPlayer: Could not load frame {index}: {exception.Message}");
            }
        }

        private void PruneCache(int ahead)
        {
            int behind = Mathf.Max(1, BufferBehind);
            List<int> expired = null;
            foreach (int index in frameCache.Keys)
            {
                bool keep = false;
                for (int offset = -behind; offset < ahead; offset++)
                {
                    if (WrapIndex(currentFrame + offset) != index) continue;
                    keep = true;
                    break;
                }
                if (keep) continue;
                expired ??= new List<int>();
                expired.Add(index);
            }

            if (expired == null) return;
            foreach (int index in expired)
            {
                Destroy(frameCache[index]);
                frameCache.Remove(index);
            }
        }

        private int WrapIndex(int index)
        {
            int count = frameFiles.Length;
            return count == 0 ? 0 : (index % count + count) % count;
        }

        private void Update()
        {
            if (!isReady || frameFiles.Length == 0) return;

            frameTimer += Time.deltaTime;
            float timePerFrame = 1f / FrameRate;

            while (frameTimer >= timePerFrame)
            {
                frameTimer -= timePerFrame;
                currentFrame = (currentFrame + 1) % frameFiles.Length;
                if (frameCache.TryGetValue(currentFrame, out Texture2D texture))
                    runtimeMaterial.mainTexture = texture;
            }
        }
        
        private void OnDestroy()
        {
            StopAllCoroutines();
            foreach (Texture2D texture in frameCache.Values)
                if (texture != null) Destroy(texture);
            frameCache.Clear();
            if (runtimeMaterial != null) Destroy(runtimeMaterial);
        }
    }
}
