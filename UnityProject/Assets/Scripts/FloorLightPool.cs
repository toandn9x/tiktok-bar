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

        /// <summary>Bật để vẽ vòng gobo đứt nét thay vì vùng sáng đặc.</summary>
        public bool ring;
        /// <summary>Tốc độ quay của các đoạn đứt nét, vòng/giây.</summary>
        public float spinSpeed = 0.18f;

        // Quỹ đạo quét của vòng gobo trên mặt sàn. Hai trục dùng tần số lệch
        // nhau nên vệt sáng đi theo hình Lissajous, không lặp lại chu kỳ ngắn
        // và không bao giờ trùng nhịp với vòng khác.
        public float wanderX = 3.2f;
        public float wanderZ = 2.6f;
        public float wanderSpeedX = 0.21f;
        public float wanderSpeedZ = 0.13f;

        private static readonly int ColorId = Shader.PropertyToID("_Color");
        private static readonly int ModeId = Shader.PropertyToID("_Mode");
        private static readonly int SpinId = Shader.PropertyToID("_Spin");

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

        // Phải đặt ở Start chứ không phải Awake. AddComponent<T>() của Unity gọi
        // Awake() ngay lập tức, tức là TRƯỚC khi scene builder kịp gán `ring`.
        // Đặt ở Awake thì `ring` còn là false và dòng này ghi đè _Mode = 0,
        // xoá mất chế độ vòng gobo mà builder vừa bật trên vật liệu.
        private void Start()
        {
            material?.SetFloat(ModeId, ring ? 1f : 0f);
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

            // Vòng gobo quay chậm, đổi chiều theo chỉ số cho đỡ đều tăm tắp.
            if (ring) material.SetFloat(SpinId, Time.time * spinSpeed * (index % 2 == 0 ? 1f : -1f));

            if (ring)
            {
                // Vòng gobo nằm ngang nên quét được cả hai trục của mặt sàn,
                // giống đèn moving head thật đang rà khắp sàn nhảy.
                transform.position = origin + new Vector3(
                    Mathf.Sin(Time.time * wanderSpeedX + phase) * wanderX,
                    0f,
                    Mathf.Sin(Time.time * wanderSpeedZ + phase * 1.7f) * wanderZ);
            }
            else
            {
                // Vệt sáng hắt lên tường chỉ trượt ngang, giữ nguyên độ cao để
                // luôn nằm đúng dải sàn vẽ trong ảnh nền.
                transform.position = origin + new Vector3(
                    Mathf.Sin(Time.time * 0.68f + phase) * sway,
                    0f,
                    0f);
            }

            float breathe = 1f + Mathf.Sin(Time.time * 1.1f + phase) * 0.08f;
            transform.localScale = new Vector3(baseScale.x * breathe, baseScale.y * breathe, 1f);
        }
    }
}
