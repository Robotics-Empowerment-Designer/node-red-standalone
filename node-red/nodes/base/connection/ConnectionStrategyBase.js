class ConnectionStrategyBase {
    constructor(connectionType) {
        if (
            connectionType === undefined ||
            connectionType === null ||
            connectionType === ""
        ) {
            throw new Error("Connection type must be defined.");
        }

        this.connectionType = connectionType;
    }

    on(event, callback) {
        throw new Error("'On' called from base class, use a derived class.");
    }

    emit(event, data) {
        throw new Error("'Emit' called from base class, use a derived class.");
    }
}

module.exports = ConnectionStrategyBase;
