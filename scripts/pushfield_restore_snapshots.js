import org.yaml.snakeyaml.Yaml;

var backupTemplate = "c26ac12d-32ab-497e-a05b-43d7d270aa3a";

// Env choisi au form 1
var selectedEnv = String('${settings.envName}').trim();
if (!selectedEnv) {
  settings.fields.push({
    type: "displayfield",
    cls: "warning",
    height: 30,
    hideLabel: true,
    markup: "No environment selected. Please go back."
  });
  return settings;
}

// Récupérer tous les envs, puis filtrer sur selectedEnv
var resp = jelastic.environment.control.GetEnvs(appid, session);
if (resp.result != 0) return resp;

var listBackups = {};    // "env / node" -> { backupId: display }
var nodesHostname = {};  // "env / node" -> "env / node"
var ids = [];

for (var i = 0, envInfo; (envInfo = resp.infos[i]); i++) {
  if (envInfo.env.status != "1") continue;

  var envName = envInfo.env.envName;
  if (envName !== selectedEnv) continue;

  for (var j = 0, node; (node = envInfo.nodes[j]); j++) {
    for (var m = 0, add; (add = node.addons[m]); m++) {
      if (add.appTemplateId == backupTemplate) {
        var admin = node.adminUrl.replace("https://", "").replace("http://", "");
        admin = admin.replace(/\..*/, "").replace("docker", "node").replace("vds", "node");

        var shortName = admin.substring(admin.indexOf("-") + 1);
        var id = admin.substring(4, admin.indexOf("-"));

        var fullName = envName + " / " + shortName;
        ids.push({ name: shortName, id: id, full: fullName });
      }
    }
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
  (plan.backup_plan || []).forEach(function (bk) {
    if (!listBackups[element.full]) listBackups[element.full] = {};
    var display = bk.date.replace("T", " ") + " " + bk.path + " " + bk.size;
    listBackups[element.full][bk.id] = display;
    nodesHostname[element.full] = element.full;
  });
});

// Form 2
settings.fields.push(
  // (optionnel) montrer l'env sélectionné
  {
    type: "displayfield",
    cls: "x-item-disabled",
    name: "env_display",
    hidden: false,
    markup: "Selected environment: <b>" + selectedEnv + "</b>"
  },

  {
    caption: "Display backups for",
    type: "list",
    name: "nodes",
    values: nodesHostname,
    required: true,
    columns: 2,
    tooltip: "Select the container from which you want to restore"
  },
  {
    caption: "Select backup",
    type: "list",
    name: "snapshot",
    dependsOn: { nodes: listBackups },
    tooltip: "UTC time",
    required: true
  },

  {
    caption: "__________________________________________________________________________________",
    cls: "x-item-disabled",
    type: "displayfield",
    name: "sep2",
    hidden: false
  },
  {
    type: "compositefield",
    hideLabel: true,
    pack: "center",
    name: "header_conf",
    items: [{ type: "displayfield", cls: "x-item-disabled", value: "Restore configuration" }]
  },
  {
    type: "radio-fieldset",
    name: "permissions",
    required: true,
    default: "classic",
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
