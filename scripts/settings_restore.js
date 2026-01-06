import org.yaml.snakeyaml.Yaml;

/*
 * restore_settings.js – formulaire pour la restauration SwissBackup.
 * Ce script est déclenché par le bouton “Restore” et affiche la liste des
 * sauvegardes disponibles sur les nœuds où l’add‑on est installé.  Le nom
 * de l’environnement est inclus dans la liste pour que l’utilisateur voie le scope.
 */

var backupTemplate = "c3c375b4-83c6-434c-b8af-8ea6651e246d";

// Récupérer tous les environnements
var resp = jelastic.environment.control.GetEnvs(appid, session);
if (resp.result != 0) return resp;

// Structures pour stocker les nœuds et les backups
var listBackups = {};
var nodesHostname = {};
var ids = [];

// Parcourir les environnements et collecter les nœuds équipés de l’add‑on
for (var i = 0, envInfo; envInfo = resp.infos[i]; i++) {
    if (envInfo.env.status == "1") {
        var envName = envInfo.env.envName;
        for (var j = 0, node; node = envInfo.nodes[j]; j++) {
            for (var m = 0, add; add = node.addons[m]; m++) {
                if (add.appTemplateId == backupTemplate) {
                    // Construire le nom du conteneur et l’identifiant comme dans settings.js
                    var admin = node.adminUrl.replace("https://", "").replace("http://", "");
                    admin = admin.replace(/\..*/, "").replace("docker", "node").replace("vds", "node");
                    var shortName = admin.substring(admin.indexOf('-') + 1);
                    var id = admin.substring(4, admin.indexOf('-'));
                    // Préfixer par l’environnement pour l’affichage
                    var fullName = envName + " / " + shortName;
                    ids.push({ name: shortName, id: id, full: fullName });
                }
            }
        }
    }
}

// Lire plan.json sur chaque nœud collecté et construire les listes de backups
var params = {
    session: session,
    path: "/home/plan.json",
    nodeType: "",
    nodeGroup: ""
};
var latest = 0;
ids.forEach(function (element) {
    var fileResp = jelastic.environment.file.Read(
        element.name,
        params.session,
        params.path,
        params.nodeType,
        params.nodeGroup,
        element.id
    );
    if (fileResp.result != 0) {
        // Pas de plan => nœud exclu
        delete nodesHostname[element.full];
    } else {
        var plan = toNative(new Yaml().load(fileResp.body));
        if (plan.last_update > latest) latest = plan.last_update;
        plan.backup_plan.forEach(function (bk) {
            // Clé basée sur envName/nœud pour lier le backup à la sélection
            if (!listBackups[element.full]) {
                listBackups[element.full] = {};
            }
            var display = bk.date.replace('T', ' ') + " " + bk.path + " " + bk.size;
            listBackups[element.full][bk.id] = display;
            nodesHostname[element.full] = element.full;
        });
    }
});

// Retourner le formulaire de restauration
return {
    result: 0,
    "settings": {
        "formId": "swiss-backup-restore",
        "formCfg": {
            "fields": [
                {
                    "name": "User",
                    "caption": "Swiss Backup username",
                    "type": "string",
                    "required": true,
                    "default": "SBI-"
                },
                {
                    "name": "key",
                    "caption": "Password",
                    "type": "string",
                    "required": false,
                    "inputType": "password"
                },
                {
                    "caption": "__________________________________________________________________________________",
                    "cls": "x-item-disabled",
                    "type": "displayfield",
                    "name": "separator",
                    "hidden": false
                },
                {
                    "type": "compositefield",
                    "hideLabel": true,
                    "pack": "center",
                    "name": "header",
                    "items": [
                        {
                            "type": "displayfield",
                            "cls": "x-item-disabled",
                            "value": "<h3>Select the backup you want to restore</h3>"
                        }
                    ]
                },
                {
                    "type": "list",
                    "caption": "Display backups for",
                    "tooltip": "List of environments and nodes with backups",
                    "name": "nodes",
                    "hidden": false,
                    "values": nodesHostname,
                    "columns": 2
                },
                {
                    "caption": "Select backup",
                    "tooltip": "UTC time",
                    "type": "list",
                    "name": "snapshot",
                    "required": true,
                    "dependsOn": {
                        "nodes": listBackups
                    }
                },
                {
                    "caption": "__________________________________________________________________________________",
                    "cls": "x-item-disabled",
                    "type": "displayfield",
                    "name": "snapshot",
                    "hidden": true
                },
                {
                    "type": "compositefield",
                    "hideLabel": true,
                    "pack": "center",
                    "name": "header2",
                    "items": [
                        {
                            "type": "displayfield",
                            "cls": "x-item-disabled",
                            "value": "<h3>Restore configuration</h3>"
                        }
                    ]
                },
                {
                    "type": "radio-fieldset",
                    "name": "permissions",
                    "hidden": false,
                    "required": true,
                    "default": "classic",
                    "values": {
                        "classic": "Keep original files permissions",
                        "permissions": "Change files ownership"
                    },
                    "showIf": {
                        "classic": [
                            {
                                "name": "destination",
                                "caption": "Restore location",
                                "regex": "[^s/ *]",
                                "regexText": "please indicate other folder than / ",
                                "type": "string",
                                "required": true,
                                "placeholder": "/tmp/restore/"
                            },
                            {
                                "type": "displayfield",
                                "cls": "warning",
                                "height": 20,
                                "hideLabel": true,
                                "markup": "Existing files will be overwritten"
                            }
                        ],
                        "permissions": [
                            {
                                "name": "custom",
                                "caption": "Restore to this username",
                                "type": "string",
                                "required": true,
                                "placeholder": "example: nginx"
                            },
                            {
                                "name": "destination",
                                "caption": "Restore location",
                                "regex": "[^s/ *]",
                                "regexText": "please indicate other folder than / ",
                                "type": "string",
                                "required": true,
                                "placeholder": "/tmp/restore/"
                            },
                            {
                                "type": "displayfield",
                                "cls": "warning",
                                "height": 20,
                                "hideLabel": true,
                                "markup": "Existing files will be overwritten"
                            }
                        ]
                    }
                }
            ]
        }
    }
};
