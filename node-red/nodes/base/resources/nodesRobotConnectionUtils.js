const ROBOT_TYPES = Object.freeze({
    PEPPER: "pepper",
    PEPPER_ANDROID: "pepper_android",
});

const ROBOT_TYPE_CATEGORY_NUMBERS = Object.freeze({
    // used in frontend/editor to group up (sub-categorize) nodes by robot type
    PEPPER_ANDROID: "1️⃣",
    PEPPER: "22️⃣",
});

async function createConnectionSelection(node) {
    new Promise((resolve, reject) => {
        $.ajax({
            url: "simple-robot-connection-list/",
            type: "GET",
            success: function (data, textStatus, jqXHR) {
                const nodeRobotType = node._def.contribRobotType;

                if (!nodeRobotType)
                    throw new Error("Missing contribRobotType in node definition (.js file).");

                const selectOptions = [];
                for (const robotType in data) {
                    // if (data.hasOwnProperty(robotType)) { // TODO: check if this is necessary
                    if (robotType !== nodeRobotType) continue;
                    const robotNames = data[robotType];
                    for (const robotName of robotNames) {
                        const selectOption = {
                            value: robotType + "___" + robotName,
                            label: robotName,
                        };
                        selectOptions.push(selectOption);
                    }
                    // }
                }

                resolve(selectOptions);
                return;
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log(
                    "Error while getting robot connections for type " +
                        node._def.contribRobotType +
                        ". Message: " +
                        errorThrown
                );
                reject(errorThrown);
            },
        });
    }).then((selectOptions) => {
        _createConnectionSelect(node, "selectedRobotConnection", selectOptions);
    });
}

function _createConnectionSelect(node, inputName, selectOptions) {
    const isSelectedRobotAvailable = // we also want do display the select dialog if the selected robot is not available
        selectOptions.some((option) => option.value === node.selectedRobotConnection) ||
        node.selectedRobotConnection === "";

    if (selectOptions.length > 1 || !isSelectedRobotAvailable) {
        let optionsArray = [];

        if (node.selectedRobotConnection !== "" && !isSelectedRobotAvailable) {
            const safeRobotConnectionValue = escapeHtml(node.selectedRobotConnection) ?? "";
            const safeRobotConnectionLabel = safeRobotConnectionValue.split("___")[1] ?? "";
            optionsArray.push({
                value: safeRobotConnectionValue,
                label: "OFFLINE - " + safeRobotConnectionLabel,
            });
        }

        optionsArray = [
            ...optionsArray,
            ...selectOptions.sort((a, b) => a.label.localeCompare(b.label)),
        ];

        // we only want to show a select dialog if there are multiple robot connections available
        node.selectOptions = [
            {
                value: node._noRobotSelected,
                label: "-- Select a robot --",
            },
            ...optionsArray,
        ];

        $(`#node-input-${inputName}`).typedInput({
            types: [
                {
                    value: "selectedRobotConnection",
                    options: node.selectOptions || [
                        {
                            value: node._noRobotSelected,
                            label: "-- No suitable robot found --",
                        },
                    ],
                },
            ],
        });
        $("#robot-connections-container").show();
    } else if (selectOptions.length === 1) {
        node.robotConnections = selectOptions[0].label;
        $("#robot-connections-container").hide();
    } else {
        $("#robot-connections-container").hide();
    }
}
