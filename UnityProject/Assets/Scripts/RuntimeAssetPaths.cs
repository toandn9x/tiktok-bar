using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace TikTokLiveGame
{
    public static class RuntimeAssetPaths
    {
        public static string FindFile(params string[] relativeParts)
        {
            return CandidatePaths(relativeParts).FirstOrDefault(File.Exists);
        }

        public static string FindDirectory(params string[] relativeParts)
        {
            return CandidatePaths(relativeParts).FirstOrDefault(Directory.Exists);
        }

        public static IEnumerable<string> FindDirectories(params string[] relativeParts)
        {
            return CandidatePaths(relativeParts).Where(Directory.Exists);
        }

        private static IEnumerable<string> CandidatePaths(string[] relativeParts)
        {
            string dataParent = Directory.GetParent(Application.dataPath)?.FullName;
            string projectParent = string.IsNullOrEmpty(dataParent)
                ? null
                : Directory.GetParent(dataParent)?.FullName;

            string[] roots =
            {
                dataParent,
                projectParent,
                Directory.GetCurrentDirectory(),
                Application.streamingAssetsPath
            };

            string relative = Path.Combine(relativeParts);
            HashSet<string> seen = new(StringComparer.OrdinalIgnoreCase);
            foreach (string root in roots)
            {
                if (string.IsNullOrWhiteSpace(root)) continue;
                string candidate = Path.GetFullPath(Path.Combine(root, relative));
                if (seen.Add(candidate)) yield return candidate;
            }
        }
    }
}
