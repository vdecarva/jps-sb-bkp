import org.yaml.snakeyaml.Yaml;

// Only list nodes in the current environment that have the backup add‑on installed.  This
// script is invoked before scheduling a backup and does not handle restoration.
var envs = api.env.control.GetEnvs();
jelastic.marketplace.console.WriteLog("envs output:", envs);
if (envs.result !== 0) return envs;
var resp = jelastic.environment.control.GetEnvInfo(appid, session);
if (resp.result != 0) return resp;

// Swiss Backup add‑on template ID used to identify nodes that have the add‑on installed.
var backupTemplate = "c3c375b4-83c6-434c-b8af-8ea6651e246d";

// Build a map of node names for the form.  Keys and values are identical for display
// purposes.  Only nodes with the backup add‑on are included.
var nodesHostname = {};
resp.nodes.forEach(function (node) {
    node.addons.forEach(function (add) {
        if (add.appTemplateId == backupTemplate) {
            var conteneur = node.adminUrl.replace("https://", "").replace(/\..*/, "").replace("docker", "node").replace("vds", "node");
            var nodeName = conteneur.substring(conteneur.indexOf('-') + 1);
            nodesHostname[nodeName] = nodeName;
        }
    });
});

// Return a form dedicated to backup configuration.  Users choose their SwissBackup
// credentials, select which node to back up, decide whether to back up everything or
// specific folders, configure retention, and set the backup frequency.
return {
    result: 0,
    settings: {
        formId: "swiss-backup-schedule",
        formCfg: {
            fields: [
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
                    name: "separator",
                    hidden: false
                },
                {
                    type: "compositefield",
                    hideLabel: true,
                    pack: "center",
                    name: "header",
                    items: [
                        {
                            type: "displayfield",
                            cls: "x-item-disabled",
                            value: "<h3>Backup configuration</h3>",
                        }
                    ]
                },
                {
                    name: "node",
                    caption: "Node",
                    type: "list",
                    values: nodesHostname,
                    required: true,
                    editable: false
                },
                {
                    name: "choice",
                    type: "radio-fieldset",
                    values: {
                        "full": "Back up all files",
                        "folder": "Back up specific folders"
                    },
                    default: "full",
                    showIf: {
                        "full": [
                            {
                                type: "displayfield",
                                cls: "x-item-disabled",
                                markup: "Some system files will be excluded. See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> for more detail.",
                                name: "info_full",
                                hidden: false
                            },
                            {
                                type: "displayfield",
                                cls: "warning",
                                height: 20,
                                hideLabel: true,
                                markup: "DB server requires to be automatically backed up into a file with another tool before installation."
                            }
                        ],
                        "folder": [
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
                                markup: "DB server requires to be automatically backed up into a file with another tool before installation."
                            }
                        ]
                    }
                },
                {
                    type: "compositefield",
                    name: "retention",
                    caption: "Retention period",
                    tooltip: "See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> section backup retention",
                    hideLabel: false,
                    items: [
                        {
                            type: "displayfield",
                            height: 5,
                            hideLabel: true,
                            markup: "Years"
                        },
                        {
                            width: 37,
                            name: "year",
                            regex: "^[0-1]$",
                            regexText: "0-1",
                            type: "string",
                            default: "0",
                            required: true
                        },
                        {
                            type: "displayfield",
                            height: 5,
                            hideLabel: true,
                            markup: "Months"
                        },
                        {
                            width: 37,
                            name: "month",
                            regex: "^(1[0-2]|[0-9])$",
                            regexText: "0-12",
                            type: "string",
                            default: "0",
                            required: true
                        },
                        {
                            type: "displayfield",
                            height: 5,
                            hideLabel: true,
                            markup: "Days"
                        },
                        {
                            width: 37,
                            name: "day",
                            regex: "^[0-9]$|^[0-9][0-9]$",
                            regexText: "0-99",
                            type: "string",
                            default: "0",
                            required: true
                        }
                    ]
                },
                {
                    type: "list",
                    name: "sauvegarde",
                    caption: "Backup frequency",
                    tooltip: "See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> section backup frequency",
                    values: {
                        "daily": "Daily",
                        "hourly": "Hourly"
                    },
                    editable: false,
                    default: "daily",
                    required: true
                }
            ]
        }
    }
};
