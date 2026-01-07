var backupTemplate = "c26ac12d-32ab-497e-a05b-43d7d270aa3a";

var resp = jelastic.environment.control.GetEnvs(appid, session);
if (resp.result != 0) return resp;

var envOptions = {}; // envName -> caption

for (var i = 0, envInfo; (envInfo = resp.infos[i]); i++) {
  if (envInfo.env.status != "1") continue;

  var envName = envInfo.env.envName;
  var hasAddon = false;

  for (var j = 0, node; (node = envInfo.nodes[j]); j++) {
    for (var m = 0, add; (add = node.addons[m]); m++) {
      if (add.appTemplateId == backupTemplate) {
        hasAddon = true;
        break;
      }
    }
    if (hasAddon) break;
  }

  if (hasAddon) {
    // caption simple, tu peux mettre displayName si dispo
    envOptions[envName] = envName;
  }
}

settings.fields.push(
  {
    type: "compositefield",
    hideLabel: true,
    pack: "center",
    name: "header_auth",
    items: [{ type: "displayfield", cls: "x-item-disabled", value: "Swissbackup authentication" }]
  },
  {
    name: "User",
    caption: "Swiss Backup username",
    type: "string",
    required: true,
    default: "SBI-"
  },
  {
    name: "key",
    caption: "Password",
    type: "string",
    required: false,
    inputType: "password"
  },
  {
    caption: "__________________________________________________________________________________",
    cls: "x-item-disabled",
    type: "displayfield",
    name: "sep1",
    hidden: false
  },
  {
    type: "compositefield",
    hideLabel: true,
    pack: "center",
    name: "header_env",
    items: [{ type: "displayfield", cls: "x-item-disabled", value: "Select environment to restore from" }]
  },
  {
    name: "envName",
    caption: "Environment",
    type: "list",
    required: true,
    editable: false,
    values: envOptions
  }
);

return settings;
