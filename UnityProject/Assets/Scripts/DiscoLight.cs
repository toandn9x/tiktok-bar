using UnityEngine;

namespace TikTokLiveGame
{
    public sealed class DiscoLight : MonoBehaviour
    {
        public int index;

        private Light spot;
        private Color baseColor;

        private void Awake()
        {
            spot = GetComponent<Light>();
            Color[] colors =
            {
                new(1f, 0.08f, 0.2f),
                new(0.1f, 0.75f, 1f),
                new(0.8f, 0.12f, 1f),
                new(1f, 0.55f, 0.06f)
            };
            baseColor = colors[Mathf.Abs(index) % colors.Length];
        }

        private void Update()
        {
            if (spot == null) return;

            float phase = index * 1.7f;
            float pulse = Mathf.Max(0f, Mathf.Sin(Time.time * 2.6f + phase));
            spot.color = baseColor;
            spot.intensity = 0.45f + pulse * 2.4f;
            transform.rotation = Quaternion.Euler(
                48f + Mathf.Sin(Time.time * 0.8f + phase) * 13f,
                180f + Mathf.Sin(Time.time * 0.55f + phase) * 55f,
                0f
            );
        }
    }
}
