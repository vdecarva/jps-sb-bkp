import org.yaml.snakeyaml.Yaml;

var backupTemplates = "c26ac12d-32ab-497e-a05b-43d7d270aa3a";

function firstNonEmpty(arr) {
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] || "").trim();
    if (s && s !== "null" && s !== "undefined" && s.indexOf("${") !== 0) return s;
  }
  return "";
}

function nodeHasBackupAddon(node) {
  var addons = node.addons || [];
  for (var i = 0; i < addons.length; i++) {
    if (backupTemplates[addons[i].appTemplateId]) return true;
  }
  return false;
}

var currentEnv = firstNonEmpty(["${env.envName}", "${env.shortdomain}", "${envName}"]);
jelastic.marketplace.console.WriteLog("DEBUG currentEnv=[" + currentEnv + "]");

if (!currentEnv) return { result: 1, error: "Cannot detect current environment." };

var info = api.env.control.GetEnvInfo(currentEnv, session);
if (info.result != 0) return info;

jelastic.marketplace.console.WriteLog("DEBUG nodesCount=" + (info.nodes || []).length);

var listBackups = {};
var nodesHostname = {};
var candidates = [];

for (var i = 0; i < (info.nodes || []).length; i++) {
  var node = info.nodes[i];

  jelastic.marketplace.console.WriteLog(
    "DEBUG nodeGroup=" + node.nodeGroup +
    " nodeid=" + node.id +
    " addons=" + (node.addons ? node.addons.length : 0)
  );

  if (!nodeHasBackupAddon(node)) continue;

  jelastic.marketplace.console.WriteLog("DEBUG addon matched on nodeid=" + node.id + " group=" + node.nodeGroup);

  // node.name pour FileService.Read = envName (dans Jelastic), nodeid = node.id
  // tu peux aussi utiliser node.envName, mais ici on reste simple :
  candidates.push({
    env: currentEnv,
    nodeid: node.id,
    label: currentEnv + " / " + node.nodeGroup
  });
}

var params = { session: session, path: "/home/plan.json", nodeType: "", nodeGroup: "" };

candidates.forEach(function (c) {
  var r = api.env.file.Read(c.env, params.session, params.path, params.nodeType, params.nodeGroup, c.nodeid);
  jelastic.marketplace.console.WriteLog("DEBUG Read plan.json env=" + c.env + " nodeid=" + c.nodeid + " result=" + r.result);

  if (r.result != 0) return;

  var plan = toNative(new Yaml().load(r.body));
  if (!plan || !plan.backup_plan) return;

  plan.backup_plan.forEach(function (bk) {
    if (!listBackups[c.label]) listBackups[c.label] = {};
    var display = bk.date.replace("T", " ") + " " + bk.path + " " + bk.size;
    listBackups[c.label][bk.id] = display;
    nodesHostname[c.label] = c.label;
  });
});

// DEBUG final
jelastic.marketplace.console.WriteLog("DEBUG nodesHostname keys=" + Object.keys(nodesHostname).length);

// Push fields (tu gardes les tiens)
settings.fields.push(
  { type:"compositefield", hideLabel:true, pack:"center", name:"header_auth",
    items:[{ type:"displayfield", cls:"x-item-disabled", value:"Swissbackup authentication" }] },
  { name:"User", caption:"Swiss Backup username", type:"string", required:true, default:"SBI-" },
  { name:"key", caption:"Password", type:"string", required:false, inputType:"password" },
  { caption:"__________________________________________________________________________________", cls:"x-item-disabled", type:"displayfield", name:"sep1", hidden:false },
  { type:"compositefield", hideLabel:true, pack:"center", name:"header_restore",
    items:[{ type:"displayfield", cls:"x-item-disabled", value:"Select the backup you want to restore" }] },
  { caption:"Display backups for", type:"list", name:"nodes", values:nodesHostname, required:true, columns:2 },
  { caption:"Select backup", type:"list", name:"snapshot", dependsOn:{ nodes:listBackups }, tooltip:"UTC time", required:true }
);

return settings;
