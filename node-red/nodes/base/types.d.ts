// types.d.ts
import { Node, NodeDef, NodeMessageInFlow } from "node-red";

//////////////// RUNTIME NODE TYPES ////////////////

//// BASE ////
export interface JoinBaseRuntimeDef extends Node {
    inputSet: number;
    currentInput: any[];
}

export interface StartBaseRuntimeDef extends Node {
    config: StartBaseEditorDef,
}

export interface StartConfigBaseRuntimeDef extends Node {
}

export interface WaitBaseRuntimeDef extends Node {
    timeout: NodeJS.Timeout,
}

//// END BASE ////

//////////////// END RUNTIME NODE TYPES ////////////////



//////////////// EDITOR NODE TYPES ////////////////

//// BASE ////

/**
 * @param outputMessage - Determines if either the first or last message received should be outputted, AFTER at least one message of every single node that's connected to this node has been received.
 */
export interface JoinBaseEditorDef extends NodeDef {
    outputMessage: "first" | "last"
}

/**
 * @param loop - If true the started flow will restart from this start node after it has reached a stop node. Be aware that this could lead to multiple active nodes in the flow (because of multiple stop nodes).
 */
export interface StartBaseEditorDef extends NodeDef {
    loop: boolean,
}

export interface StartConfigBaseEditorDef extends NodeDef {
    robots: {
        pepper: Robot[],
        pepper_android: Robot[],
        temi: Robot[],
        sawyer: Robot[],
    },
    isConfigDirty: boolean,
}

/**
 * @param time - The time in milliseconds to wait before sending the message.
 */
export interface WaitBaseEditorDef extends NodeDef {
    time: number,
}

//// END BASE ////

//////////////// END EDITOR NODE TYPES ////////////////



//////////////// CUSTOM INTERAL TYPES ////////////////

/** 
 * @typedef {Object} Robot
 * @property {string} robotName - The name and identifier of the robot defined in the sidebar of Node-RED.
 * @property {"pepper" | "pepper_android" | "temi" | "sawyer"} robotType - The type of robot.
 * @property {string} robotIp - The IP address of the robot or the middleware/MQTT broker (depends on the robotType).
 * @property {string} robotPort - The port of the robot or the middleware/MQTT broker (depends on the robotType).
 */
interface Robot {
    robotName: string;
    robotType: "pepper" | "pepper_android" | "temi" | "sawyer";
    robotIp: string;
    robotPort: string;
}
