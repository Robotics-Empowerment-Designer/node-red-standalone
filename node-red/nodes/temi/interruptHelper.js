let isInterrupted = false;
let resumeCallback = null;
let cancelSignal = false;

function interruptHandling(node){
    function checkInterruptionStatus(){
        // checks the flow variable that is responsible for interruption
        const flow = node.context().flow;
        return flow.get("interrupting_flow") === true;
    }

    //check for cancellation signal
    function checkCancelSignal(){
        const global = node.context().global;
        return global.get("cancel_flow_signal") === true;
    }

    function waitIfInterrupted(){
        // updating the interruption status based on the flow variable
        isInterrupted = checkInterruptionStatus();

        if(!isInterrupted){
            return Promise.resolve(false); // no interruption
        }
        return new Promise((resolve) =>{
            resumeCallback = () => resolve(true);
        });
    }

    function cleanup(){
        isInterrupted = false;
        resumeCallback = null;
        cancelSignal = false;        
    }

    // continuously monitor the interruption state
    setInterval(() =>{
        if(!checkInterruptionStatus() && isInterrupted){
            isInterrupted = false;
            if(resumeCallback){
                resumeCallback();
                resumeCallback = null;
            }
        }
    }, 200); // checking every 200 ms

    return{waitIfInterrupted, cleanup, checkCancelSignal};

}

module.exports = {interruptHandling};