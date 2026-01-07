import org.yaml.snakeyaml.Yaml;

/*
 * settings_restore_complete.js
 *
 * This script is intended to be used as the `onBeforeInit` handler for the
 * restoration form in a Jelastic/SwissBackup add‑on.  It collects all
 * environments and containers where the SwissBackup add‑on is installed,
 * reads the `/home/plan.json` file on each of those nodes to enumerate
 * available backups, and then populates the `settings.fields` array
 * with the dynamic form fields needed for restoration.  By pushing
 * directly into `settings.fields` rather than returning a new `formCfg`,
 * we preserve compatibility with manifests that declare an empty `fields`
 * array.  The final returned `settings` object will be merged into
 * the manifest’s `settings.swiss-backup-restore` entry.
 */

// Template ID of the SwissBackup add‑on; used to identify nodes where the
// add‑on is installed.  Update this ID to match the one used in your
// environment if it differs.
var backupTemplate = "c26ac12d-32ab-497e-a05b-43d7d270aa3a";

// Retrieve all accessible environments for this user/app.  If the call
// fails, propagate the error to the UI.
var resp = jelastic.environment.control.GetEnvs(appid, session);
if (resp.result != 0) {
    return resp;
}

// listBackups maps "env / container" => { backupId: description, … }.
var listBackups = {};
// nodesHostname maps "env / container" => "env / container", used
// directly as the list of options for the container selector.
var nodesHostname = {};
// ids collects the raw node names and IDs for each container with the
// backup add‑on; later we read plan.json on each to find backups.
var ids = [];

// Iterate through environments and nodes to find those with the backup
// add‑on installed.  The `env.env.status` check skips stopped/sleeping
// environments.
for (var i = 0, envInfo; (envInfo = resp.infos[i]); i++) {
    if (envInfo.env.status == "1") {
        var envName = envInfo.env.envName;
        for (var j = 0, node; (node = envInfo.nodes[j]); j++) {
            for (var m = 0, add; (add = node.addons[m]); m++) {
                if (add.appTemplateId == backupTemplate) {
                    // Convert admin URL to the container short name and ID
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
}

// Parameters for reading plan.json from a node.  These values remain the
// same for all nodes; only the node name and ID change in each call.
var params = {
    session: session,
    path: "/home/plan.json",
    nodeType: "",
    nodeGroup: "",
};

// Iterate through each identified node, read its plan.json, and build
// listBackups and nodesHostname structures.  If a node lacks a plan.json,
// it will be excluded from the restore list.
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
        // No plan.json or error reading it; skip this node
        delete nodesHostname[element.full];
    } else {
        var plan = toNative(new Yaml().load(fileResp.body));
        // For each backup entry in the plan, record it under the node’s full name
        plan.backup_plan.forEach(function (bk) {
            if (!listBackups[element.full]) {
                listBackups[element.full] = {};
            }
            // Display string includes date/time, path and size.  Replace 'T'
            // with space for readability.  Feel free to adjust this format.
            var display = bk.date.replace('T', ' ') + " " + bk.path + " " + bk.size;
            listBackups[element.full][bk.id] = display;
            // Ensure the node appears in the dropdown
            nodesHostname[element.full] = element.full;
        });
    }
});

// Assign our lookup objects to variables used in the dependsOn definition.
var nodes = nodesHostname;
var snapshots = listBackups;

// Populate the form by pushing fields onto settings.fields.  Because the
// manifest declares `fields: []`, settings.fields exists as an array.
settings.fields.push(

    {
        type: "compositefield",
        hideLabel: true,
        pack: "center",
        name: "header",
        items: [
            {
                type: "displayfield",
                cls: "x-item-disabled",
                value: "Swissbackup authentication",
            },
        ],
    },
    // User field for Swiss Backup username
    {
        name: "User",
        caption: "Swiss Backup username",
        type: "string",
        required: true,
        default: "SBI-",
    },
    // Password/key field
    {
        name: "key",
        caption: "Password",
        type: "string",
        required: false,
        inputType: "password",
    },
    // Separator line
    {
        caption: "__________________________________________________________________________________",
        cls: "x-item-disabled",
        type: "displayfield",
        name: "separator",
        hidden: false,
    },
    // Header for restoration
    {
        type: "compositefield",
        hideLabel: true,
        pack: "center",
        name: "header",
        items: [
            {
                type: "displayfield",
                cls: "x-item-disabled",
                value: "Select the backup you want to restore",
            },
        ],
    },
    // Drop‑down list of environments/containers with backups
    {
        caption: "Display backups for",
        type: "list",
        name: "nodes",
        values: nodes,
        required: true,
        columns: 2,
        tooltip: "Select the container from which you want to restore",
    },
    // Drop‑down list of backups, dependent on the selected node
    {
        caption: "Select backup",
        type: "list",
        name: "snapshot",
        dependsOn: { nodes: snapshots },
        tooltip: "UTC time",
        required: true,
    },
    // Second header for configuration
    {
        caption: "__________________________________________________________________________________",
        cls: "x-item-disabled",
        type: "displayfield",
        name: "separator2",
        hidden: false,
    },
    {
        type: "compositefield",
        hideLabel: true,
        pack: "center",
        name: "header2",
        items: [
            {
                type: "displayfield",
                cls: "x-item-disabled",
                value: "Restore configuration",
            },
        ],
    },
    // Permissions radio group with showIf definitions for destination/custom
    {
        type: "radio-fieldset",
        name: "permissions",
        required: true,
        default: "classic",
        values: {
            classic: "Keep original files permissions",
            permissions: "Change files ownership",
        },
        showIf: {
            classic: [
                {
                    name: "destination",
                    caption: "Restore location",
                    type: "string",
                    placeholder: "/tmp/restore/",
                    required: true,
                },
                {
                    type: "displayfield",
                    cls: "warning",
                    hideLabel: true,
                    height: 20,
                    markup: "Existing files will be overwritten",
                },
            ],
            permissions: [
                {
                    name: "custom",
                    caption: "Restore to this username",
                    type: "string",
                    placeholder: "example: nginx",
                    required: true,
                },
                {
                    name: "destination",
                    caption: "Restore location",
                    type: "string",
                    placeholder: "/tmp/restore/",
                    required: true,
                },
                {
                    type: "displayfield",
                    cls: "warning",
                    hideLabel: true,
                    height: 20,
                    markup: "Existing files will be overwritten",
                },
            ],
        },
    }
);

// Return the modified settings object; the engine will merge it into the
// manifest’s settings entry for swiss-backup-restore.
return settings;
