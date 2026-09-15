const {
  withAppDelegate,
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");
module.exports = function withRecordingBackupExclusion(config) {
  config = withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (!application) throw new Error("Missing Android application");
    application.$["android:allowBackup"] = "false";
    application.$["android:fullBackupContent"] = "@xml/recording_backup_rules";
    application.$["android:dataExtractionRules"] =
      "@xml/recording_extraction_rules";
    return result;
  });
  config = withDangerousMod(config, [
    "android",
    async (result) => {
      const directory = path.join(
        result.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      await fs.mkdir(directory, { recursive: true });
      const exclusions = [
        "root",
        "file",
        "database",
        "sharedpref",
        "external",
        "device_root",
        "device_file",
        "device_database",
        "device_sharedpref",
      ]
        .map((domain) => `<exclude domain="${domain}" path="." />`)
        .join("\n");
      await fs.writeFile(
        path.join(directory, "recording_backup_rules.xml"),
        `<full-backup-content>\n${exclusions}\n</full-backup-content>\n`,
      );
      await fs.writeFile(
        path.join(directory, "recording_extraction_rules.xml"),
        `<data-extraction-rules><cloud-backup>\n${exclusions}\n</cloud-backup><device-transfer>\n${exclusions}\n</device-transfer><cross-platform-transfer>\n${exclusions}\n</cross-platform-transfer></data-extraction-rules>\n`,
      );
      return result;
    },
  ]);
  return withAppDelegate(config, (result) => {
    if (!result.modResults.contents.includes("import Foundation")) {
      result.modResults.contents =
        "import Foundation\n" + result.modResults.contents;
    }
    if (result.modResults.language !== "swift")
      throw new Error("Recording backup exclusion requires Swift AppDelegate");
    const marker =
      "// Hackathon: exclude private app documents from OS backup.";
    if (!result.modResults.contents.includes(marker)) {
      const target =
        "return super.application(application, didFinishLaunchingWithOptions: launchOptions)";
      if (!result.modResults.contents.includes(target))
        throw new Error(
          "AppDelegate launch hook changed; verify backup exclusion before recording",
        );
      result.modResults.contents = result.modResults.contents.replace(
        target,
        `${marker}\n    if var documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {\n      let markerURL = documents.appendingPathComponent(".recording-backup-ready")\n      try? FileManager.default.removeItem(at: markerURL)\n      var values = URLResourceValues()\n      values.isExcludedFromBackup = true\n      do {\n        try documents.setResourceValues(values)\n        if try documents.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true {\n          try Data("ready".utf8).write(to: markerURL, options: .atomic)\n        }\n      } catch {\n        NSLog("Recording backup exclusion could not be configured")\n      }\n    }\n    ${target}`,
      );
    }
    return result;
  });
};
