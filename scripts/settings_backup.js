import org.yaml.snakeyaml.Yaml;

/*
 * This script is invoked before the SwissBackup add‑on is installed.  It enumerates all running
 * environments and their nodes without filtering on existing add‑ons, so the user can choose
 * where to schedule backups.  It then builds a configuration form that asks for SwissBackup
 * credentials, the environment and node to back up, backup mode (full or specific folders),
 * retention period, and backup frequency.
 */

// Retrieve all environments accessible to the user
var resp = api.env.control.GetEnvs();
if (resp.result !== 0) return resp;

var envOptions = {};
var nodeOptions = {};

// Iterate through each environment and collect node groups
resp.infos.forEach(function (envInfo) {
    var env = envInfo.env;
    // Only list running environments
    if (env.status == 1) {
        var envName = env.envName;
        var displayName = env.displayName ? env.displayName + " (" + envName + ")" : envName;
        envOptions[envName] = displayName;
        nodeOptions[envName] = {};
        envInfo.nodes.forEach(function (node) {
            var group = node.nodeGroup;
            var caption = (node.displayName || node.name) + ' (' + group + ')';
            nodeOptions[envName][group] = caption;
        });
    }
});

return {
    result: 0,
    settings: {
        formId: "swiss-backup-install",
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
                            value: "<h3>Backup installation</h3>",
                        }
                    ]
                },
                {
                    name: "envName",
                    caption: "Environment",
                    type: "list",
                    values: envOptions,
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
                        envName: nodeOptions
                    }
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
