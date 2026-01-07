import org.yaml.snakeyaml.Yaml;

function firstNonEmpty(arr) {
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] || "").trim();
    if (s && s !== "null" && s !== "undefined" && s.indexOf("${") !== 0) return s;
  }
  return "";
}

var currentEnv = firstNonEmpty(["${env.envName}", "${env.shortdomain}", "${envName}"]);
jelastic.marketplace.console.WriteLog("DEBUG currentEnv=[" + currentEnv + "]");

if (!currentEnv) return { result: 1, error: "Cannot detect current environment." };

var info = api.env.control.GetEnvInfo(currentEnv, session);
if (info.result != 0) return info;

jelastic.marketplace.console.WriteLog("DEBUG nodesCount=" + (info.nodes || []).length);

var listBackups = {};     // "env / nodeGroup" => { backupId: display }
var nodesHostname = {};   // "env / nodeGroup" => "env / nodeGroup"

var params = { session: session, path: "/home/plan.json", nodeType: "", nodeGroup: "" };

for (var i = 0; i < (info.nodes || []).length; i++) {
  var node = info.nodes[i];
  var label = currentEnv + " / " + node.nodeGroup;

  jelastic.marketplace.console.WriteLog(
    "DEBUG tryRead plan.json nodeGroup=" + node.nodeGroup + " nodeid=" + node.id
  );

  // IMPORTANT: FileService.Read attend envName + nodeid
  var r = api.env.file.Read(currentEnv, params.session, params.path, params.nodeType, params.nodeGroup, node.id);
  jelastic.marketplace.console.WriteLog("DEBUG Read result=" + r.result + " for " + label);

  if (r.result != 0) continue; // pas de plan.json sur ce node

  var plan;
  try {
    plan = toNative(new Yaml().load(r.body));
  } catch (e) {
    jelastic.marketplace.console.WriteLog("DEBUG YAML parse failed for " + label + " err=" + e);
    continue;
  }

  if (!plan || !plan.backup_plan || !plan.backup_plan.length) continue;

  nodesHostname[label] = label;
  if (!listBackups[label]) listBackups[label] = {};

  for (var j = 0; j < plan.backup_plan.length; j++) {
    var bk = plan.backup_plan[j];
    var display = String(bk.date || "").replace("T", " ") + " " + (bk.path || "") + " " + (bk.size || "");
    listBackups[label][bk.id] = display;
  }
}

jelastic.marketplace.console.WriteLog("DEBUG nodesHostname keys=" + Object.keys(nodesHostname).length);

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
