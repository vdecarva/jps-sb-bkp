import org.yaml.snakeyaml.Yaml;

var backupTemplate = "c26ac12d-32ab-497e-a05b-43d7d270aa3a"; // ton template addon

function firstNonEmpty(arr) {
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] || "").trim();
    if (s && s !== "null" && s !== "undefined" && s.indexOf("${") !== 0) return s;
  }
  return "";
}

// 1) essayer de choper l'env courant depuis le contexte UI
var currentEnv = firstNonEmpty([
  "${env.envName}",
  "${env.shortdomain}",
  "${envName}"
]);

jelastic.marketplace.console.WriteLog("DEBUG currentEnv=[" + currentEnv + "]");

// 2) si on n'a pas l'env, fallback (ton ancien comportement)
var envInfos = [];
if (currentEnv) {
  var one = jelastic.environment.control.GetEnvInfo(currentEnv, session);
  if (one.result != 0) return one;
  // normaliser au format envInfos[*] proche de GetEnvs()
  envInfos = [{ env: one.env, nodes: one.nodes }];
} else {
  var all = jelastic.environment.control.GetEnvs(appid, session);
  if (all.result != 0) return all;
  envInfos = all.infos;
}

// 3) préparer structures restore (nodes->snapshots)
var listBackups = {};     // "nodeCaption" => { snapshotId: caption }
var nodesHostname = {};   // "nodeCaption" => "nodeCaption"
var ids = [];

for (var i = 0; i < envInfos.length; i++) {
  var envInfo = envInfos[i];
  if (!envInfo || !envInfo.env) continue;

  // IMPORTANT: on veut l'env courant uniquement => si currentEnv set, on ne passe que celui-ci
  var envName = envInfo.env.envName || envInfo.env.shortdomain || "";
  if (currentEnv && envName !== currentEnv) continue;

  // skip stopped
  if (String(envInfo.env.status) !== "1") continue;

  for (var j = 0; j < (envInfo.nodes || []).length; j++) {
    var node = envInfo.nodes[j];
    var addons = node.addons || [];
    var hasAddon = false;

    for (var m = 0; m < addons.length; m++) {
      if (addons[m].appTemplateId == backupTemplate) {
        hasAddon = true;
        break;
      }
    }
    if (!hasAddon) continue;

    // adminUrl -> nodeName + id (comme ton script)
    var admin = String(node.adminUrl || "").replace("https://", "").replace("http://", "");
    admin = admin.replace(/\..*/, "").replace("docker", "node").replace("vds", "node");

    var shortName = admin.substring(admin.indexOf("-") + 1);
    var id = admin.substring(4, admin.indexOf("-"));

    // caption lisible : env / nodeGroup (ou shortname)
    var nodeCaption = envName + " / " + (node.nodeGroup || shortName);

    ids.push({ name: shortName, id: id, caption: nodeCaption });
  }
}

var params = { session: session, path: "/home/plan.json", nodeType: "", nodeGroup: "" };

ids.forEach(function (element) {
  var fileResp = jelastic.environment.file.Read(
    element.name,
    params.session,
    params.path,
    params.nodeType,
    params.nodeGroup,
    element.id
  );

  if (fileResp.result != 0) return;

  var plan = toNative(new Yaml().load(fileResp.body));
  if (!plan || !plan.backup_plan) return;

  plan.backup_plan.forEach(function (bk) {
    if (!listBackups[element.caption]) listBackups[element.caption] = {};
    var display = bk.date.replace("T", " ") + " " + bk.path + " " + bk.size;
    listBackups[element.caption][bk.id] = display;
    nodesHostname[element.caption] = element.caption;
  });
});

// 4) push fields (comme ton restore qui marche)
settings.fields.push(
  { type: "compositefield", hideLabel: true, pack: "center", name: "header_auth",
    items: [{ type: "displayfield", cls: "x-item-disabled", value: "Swissbackup authentication" }] },

  { name: "User", caption: "Swiss Backup username", type: "string", required: true, default: "SBI-" },
  { name: "key", caption: "Password", type: "string", required: false, inputType: "password" },

  { caption: "__________________________________________________________________________________", cls: "x-item-disabled",
    type: "displayfield", name: "sep1", hidden: false },

  { type: "compositefield", hideLabel: true, pack: "center", name: "header_restore",
    items: [{ type: "displayfield", cls: "x-item-disabled", value: "Select the backup you want to restore" }] },

  { caption: "Display backups for", type: "list", name: "nodes",
    values: nodesHostname, required: true, columns: 2 },

  { caption: "Select backup", type: "list", name: "snapshot",
    dependsOn: { nodes: listBackups }, tooltip: "UTC time", required: true },

  { caption: "__________________________________________________________________________________", cls: "x-item-disabled",
    type: "displayfield", name: "sep2", hidden: false },

  { type: "compositefield", hideLabel: true, pack: "center", name: "header_cfg",
    items: [{ type: "displayfield", cls: "x-item-disabled", value: "Restore configuration" }] },

  { type: "radio-fieldset", name: "permissions", required: true, default: "classic",
    values: { classic: "Keep original files permissions", permissions: "Change files ownership" },
    showIf: {
      classic: [
        { name: "destination", caption: "Restore location", type: "string", placeholder: "/tmp/restore/", required: true },
        { type: "displayfield", cls: "warning", hideLabel: true, height: 20, markup: "Existing files will be overwritten" }
      ],
      permissions: [
        { name: "custom", caption: "Restore to this username", type: "string", placeholder: "example: nginx", required: true },
        { name: "destination", caption: "Restore location", type: "string", placeholder: "/tmp/restore/", required: true },
        { type: "displayfield", cls: "warning", hideLabel: true, height: 20, markup: "Existing files will be overwritten" }
      ]
    }
  }
);

return settings;
