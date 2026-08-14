using System;
using System.Collections;
using UnityEngine;

namespace TikTokLiveGame
{
    public sealed class VisualCaptureHarness : MonoBehaviour
    {
        public static void InstallIfRequested(GameObject root)
        {
            string[] arguments = Environment.GetCommandLineArgs();
            int index = Array.IndexOf(arguments, "-capturePath");
            if (index < 0 || index + 1 >= arguments.Length) return;
            VisualCaptureHarness harness = root.AddComponent<VisualCaptureHarness>();

            // -captureWide: chi cho dam dong vao san roi cho camera ve goc tu do
            // moi chup. Kich ban Capture() mac dinh luon ban qua, ma qua lon cho
            // focus toi 12 giay nen khong bao gio chup duoc goc toan canh.
            int wide = Array.IndexOf(arguments, "-captureWide");
            int countIndex = Array.IndexOf(arguments, "-captureCount");
            int count = countIndex >= 0 && countIndex + 1 < arguments.Length &&
                int.TryParse(arguments[countIndex + 1], out int parsed) ? parsed : 60;

            harness.StartCoroutine(wide >= 0
                ? harness.CaptureWide(arguments[index + 1], count)
                : harness.Capture(arguments[index + 1]));
        }

        /// <summary>
        /// Anh toan canh o goc tu do: khong ban qua, khong bam ai. Cho hang doi
        /// camera chao mung rut het roi moi chup.
        /// </summary>
        private IEnumerator CaptureWide(string path, int count)
        {
            yield return new WaitForSecondsRealtime(1.5f);
            TikTokWebSocketClient client = FindFirstObjectByType<TikTokWebSocketClient>();
            client?.StartDemo(count);
            yield return new WaitForSecondsRealtime(6f);
            client?.StopDemo();
            // Hang doi chao mung toi da 3 luot, moi luot 2-3 giay, cong them
            // focus cua nhung cu qua ngau nhien do demo ban ra khi dang chay.
            yield return new WaitForSecondsRealtime(9f);
            ScreenCapture.CaptureScreenshot(path);
            Debug.Log($"Wide capture saved to {path}");
            yield return new WaitForSecondsRealtime(2f);
            Application.Quit();
        }

        private IEnumerator Capture(string path)
        {
            yield return new WaitForSecondsRealtime(1.5f);
            TikTokWebSocketClient client = FindFirstObjectByType<TikTokWebSocketClient>();
            client?.StartDemo(40);
            yield return new WaitForSecondsRealtime(5f);
            client?.StopDemo();
            client?.DemoGift(300, 7);
            client?.DemoGift(200, 8);
            client?.DemoGift(100, 9);
            yield return new WaitForSecondsRealtime(9f);
            FindFirstObjectByType<GiftEffectManager>()?.PartyBurst();
            yield return new WaitForSecondsRealtime(0.8f);
            ScreenCapture.CaptureScreenshot(path + ".stage.png");
            yield return new WaitForSecondsRealtime(0.5f);
            client?.DemoGift(100, 7);
            yield return new WaitForSecondsRealtime(4f);
            ScreenCapture.CaptureScreenshot(path);
            Debug.Log($"Visual capture saved to {path}");
            yield return new WaitForSecondsRealtime(2f);
            Application.Quit();
        }
    }
}
