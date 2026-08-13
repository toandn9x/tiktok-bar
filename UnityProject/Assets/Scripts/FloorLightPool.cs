using UnityEngine;

namespace TikTokLiveGame
{
    /// <summary>
    /// Vung sang gia lap tren san. Ve bang shader blend cong nen chi lam sang
    /// them anh nen chu khong che, khac voi mot mat san duc thuc su.
    /// </summary>
    public sealed class FloorLightPool : MonoBehaviour
    {
        public int index;
        public Color baseColor = Color.white;
        public float baseIntensity = 0.6f;
        public float sway = 1.6f;

        private static readonly int ColorId = Shader.PropertyToID("_Color");

        private Material material;
        private Vector3 origin;
        private Vector3 baseScale;

        private void Awake()
        {
            Renderer poolRenderer = GetComponent<Renderer>();
            if (poolRenderer != null) material = poolRenderer.material;
            origin = transform.position;
            baseScale = transform.localScale;
        }

        private void Update()
        {
            if (material == null) return;

            float phase = index * 1.37f;
            float beat = ClubBeatClock.Beat;
            float pulse = Mathf.Exp(-(beat - Mathf.Floor(beat)) * 5.5f);
            float intensity = baseIntensity * (0.42f + pulse * 0.9f);

            Color tint = baseColor * intensity;
            tint.a = Mathf.Clamp01(intensity);
            material.SetColor(ColorId, tint);

            // Truot ngang nhe cho giong den quet, khong doi vi tri doc de
            // vung sang luon nam dung dai san ve trong anh nen.
            transform.position = origin + new Vector3(
                Mathf.Sin(Time.time * 0.68f + phase) * sway,
                0f,
                0f);

            float breathe = 1f + Mathf.Sin(Time.time * 1.1f + phase) * 0.08f;
            transform.localScale = new Vector3(baseScale.x * breathe, baseScale.y * breathe, 1f);
        }
    }
}
