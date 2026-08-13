using UnityEngine;

namespace TikTokLiveGame
{
    public sealed class ClubLaserBeam : MonoBehaviour
    {
        // Vùng quét của tia, do CreateLaserShow() đặt trước khi gọi Initialize().
        // Giá trị mặc định là dàn tia chính, đủ dùng nếu tạo thêm tia ở nơi khác.
        public float spreadX = 11.5f;
        public float targetYBase = -16.5f;
        public float targetYRange = 12.5f;
        public float targetZNear = -12.2f;
        public float targetZFar = -5.5f;
        public float sweepSpeed = 1f;

        private LineRenderer line;
        private Vector3 origin;
        private float phase;
        private float baseStartWidth;
        private float baseEndWidth;

        public void Initialize(LineRenderer targetLine, Vector3 beamOrigin, float beamPhase)
        {
            line = targetLine;
            origin = beamOrigin;
            phase = beamPhase;
            baseStartWidth = line.startWidth;
            baseEndWidth = line.endWidth;
            UpdateBeam();
        }

        private void Update() => UpdateBeam();

        private void UpdateBeam()
        {
            if (line == null) return;
            float time = Time.time * sweepSpeed;
            float beat = ClubBeatClock.Beat;
            float pulse = 0.68f + Mathf.Exp(-(beat - Mathf.Floor(beat)) * 7f) * 0.72f;
            Vector3 target = new(
                Mathf.Sin(time * 1.15f + phase) * spreadX,
                targetYBase + Mathf.Abs(Mathf.Sin(time * 0.61f + phase * 0.7f)) * targetYRange,
                Mathf.Lerp(targetZNear, targetZFar, Mathf.Sin(time * 0.75f + phase * 1.31f) * 0.5f + 0.5f)
            );
            line.startWidth = baseStartWidth * pulse;
            line.endWidth = baseEndWidth * pulse;
            line.SetPosition(0, origin);
            line.SetPosition(1, target);
        }
    }
}
