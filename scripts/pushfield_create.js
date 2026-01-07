var resp = api.env.control.GetEnvs();
if (resp.result !== 0) return resp;

/**
 * Build env list + nodeGroup list in the same style as the other script:
 * - envs: [ {caption, value}, ... ]
 * - nodesByEnv: { "<envName>": [ {caption, value}, ... ] }
 */
var envs = [];
var nodesByEnv = {};
var envSeen = {};

(resp.infos || []).forEach(function (envInfo) {
  var env = envInfo.env || {};
  if (env.status != 1) return;

  var envName = env.envName;
  var caption = (env.displayName ? env.displayName : envName) + " (" + envName + ")";

  if (!envSeen[envName]) {
    envSeen[envName] = true;
    envs.push({ caption: caption, value: envName });
  }

  if (!nodesByEnv[envName]) nodesByEnv[envName] = [];

  // Keep one option per nodeGroup (cp, sqldb, storage, ...)
  var groupSeen = {};

  (envInfo.nodes || []).forEach(function (node) {
    var group = node.nodeGroup;
    if (!group || groupSeen[group]) return;
    groupSeen[group] = true;

    var nodeCaption = (node.displayName || node.name || group) + " (" + group + ")";
    nodesByEnv[envName].push({ caption: nodeCaption, value: group });
  });
});

/**
 * FORM - built via push() like your reference
 */
var settings = {
  result: 0,
  settings: {
    formId: "swiss-backup-create",
    formCfg: {
      fields: []
    }
  }
};

function pushSeparator() {
  settings.settings.formCfg.fields.push({
    caption: "__________________________________________________________________________________",
    cls: "x-item-disabled",
    type: "displayfield",
    name: "sep_" + Math.random().toString(16).slice(2),
    hidden: false
  });
}

function pushTitle(html) {
  settings.settings.formCfg.fields.push({
    type: "compositefield",
    hideLabel: true,
    pack: "center",
    name: "title_" + Math.random().toString(16).slice(2),
    items: [{
      type: "displayfield",
      cls: "x-item-disabled",
      value: html
    }]
  });
}

// Common fields
settings.settings.formCfg.fields.push(
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
  }
);

pushSeparator();
pushTitle("<h3>Backup configuration</h3>");

// Env + nodeGroup (dependsOn)
if (!envs.length) {
  settings.settings.formCfg.fields.push({
    type: "displayfield",
    cls: "warning",
    height: 30,
    hideLabel: true,
    markup: "No running environments found."
  });
} else {
  settings.settings.formCfg.fields.push(
    {
      name: "envName",
      caption: "Environment",
      type: "list",
      values: envs,
      required: true,
      editable: false
    },
    {
      name: "nodeGroup",
      caption: "Node group",
      type: "list",
      required: true,
      editable: false,
      dependsOn: {
        envName: nodesByEnv
      }
    }
  );
}

// Choice (full/folder) with showIf blocks
settings.settings.formCfg.fields.push({
  name: "choice",
  type: "radio-fieldset",
  values: [
    { value: "full", caption: "Back up all files" },
    { value: "folder", caption: "Back up specific folders" }
  ],
  default: "full",
  showIf: {
    full: [
      {
        type: "displayfield",
        cls: "x-item-disabled",
        markup:
          "Some system files will be excluded. See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> for more detail."
      },
      {
        type: "displayfield",
        cls: "warning",
        height: 20,
        hideLabel: true,
        markup:
          "DB server requires to be automatically backed up into a file with another tool before installation."
      }
    ],
    folder: [
      {
        name: "path",
        caption: "Folders to back up",
        regex: "[^\\s/ *]",
        regexText: "Use Snapshot of the whole container button for backup / ",
        type: "string",
        placeholder: "path/to/folder1/, path/to/folder2/"
      },
      {
        type: "displayfield",
        cls: "warning",
        height: 20,
        hideLabel: true,
        markup:
          "DB server requires to be automatically backed up into a file with another tool before installation."
      }
    ]
  }
});

// Retention composite
settings.settings.formCfg.fields.push({
  type: "compositefield",
  name: "retention",
  caption: "Retention period",
  tooltip:
    "See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> section backup retention",
  hideLabel: false,
  items: [
    { type: "displayfield", height: 5, hideLabel: true, markup: "Years" },
    { width: 37, name: "year", regex: "^[0-1]$", regexText: "0-1", type: "string", default: "0", required: true },

    { type: "displayfield", height: 5, hideLabel: true, markup: "Months" },
    { width: 37, name: "month", regex: "^(1[0-2]|[0-9])$", regexText: "0-12", type: "string", default: "0", required: true },

    { type: "displayfield", height: 5, hideLabel: true, markup: "Days" },
    { width: 37, name: "day", regex: "^[0-9]$|^[0-9][0-9]$", regexText: "0-99", type: "string", default: "0", required: true }
  ]
});

// Frequency
settings.settings.formCfg.fields.push({
  type: "list",
  name: "sauvegarde",
  caption: "Backup frequency",
  tooltip:
    "See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> section backup frequency",
  values: [
    { caption: "Daily", value: "daily" },
    { caption: "Hourly", value: "hourly" }
  ],
  editable: false,
  default: "daily",
  required: true
});

return settings;
