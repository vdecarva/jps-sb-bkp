/*
 * backup_settings.js – paramètres pour l’installation d’un backup SwissBackup.
 * Ce script est exécuté avant l’installation (onBeforeInit).
 * Il liste tous les environnements actifs et leurs groupes de nœuds sans
 * vérifier si l’add‑on est déjà installé, puis construit un formulaire
 * d’installation similaire à celui du settings.js original, limité au mode “backup”.
 */

// Récupérer tous les environnements de l’utilisateur
var resp = api.env.control.GetEnvs();
if (resp.result !== 0) return resp;

var envs = [];
var nodes = {};

// Construire la liste des environnements et des groupes de nœuds
resp.infos.forEach(function (envInfo) {
    var env = envInfo.env;
    if (env.status == 1) {
        var envName = env.envName;
        var caption = (env.displayName ? env.displayName : envName) + " (" + envName + ")";
        envs.push({ value: envName, caption: caption });
        nodes[envName] = [];
        var groupsSeen = {};
        envInfo.nodes.forEach(function (node) {
            var group = node.nodeGroup;
            // Un groupe par environnement pour éviter les doublons (cp, sqldb, etc.)
            if (!groupsSeen[group]) {
                var groupCaption = (node.displayName || node.name) + " (" + group + ")";
                nodes[envName].push({ value: group, caption: groupCaption });
                groupsSeen[group] = true;
            }
        });
    }
});

// Si aucun environnement n'est actif, retourner un formulaire vide
if (envs.length === 0) {
    return { result: 0, settings: { formCfg: { fields: [] } } };
}

// Définir la configuration du formulaire d’installation
var settings = {
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
                        value: "<h3>Backup configuration</h3>"
                    }
                ]
            },
            {
                // Sélection de l’environnement
                name: "envName",
                caption: "Environment",
                type: "list",
                values: envs,
                default: envs[0].value,
                required: true,
                editable: false
            },
            {
                // Sélection du groupe de nœuds en fonction de l’environnement
                name: "nodeGroup",
                caption: "Node group",
                type: "list",
                values: nodes[envs[0].value],
                default: nodes[envs[0].value][0].value,
                required: true,
                editable: false,
                dependsOn: {
                    envName: nodes
                }
            },
            {
                // Choix du type de backup : complet ou dossiers spécifiques
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
                            markup: "Some system files will be excluded. See our FAQ <a target='_blank' href='https://faq.infomaniak.com/2420'>Add-on SwissBackup</a> for more detail."
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
                // Période de rétention : années, mois, jours
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
                // Fréquence de sauvegarde : quotidienne ou horaire
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
};

// Renvoyer le formulaire sans lecture des plan.json
return {
    result: 0,
    settings: settings
};
