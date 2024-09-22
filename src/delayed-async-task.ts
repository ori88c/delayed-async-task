type DelayedAsyncTaskStatus = 
    "PENDING" |
    "EXECUTING" |
    "COMPLETED_SUCCESSFULLY" |
    "ABORTED_BEFORE_EXECUTION" |
    "FAILED_DUE_TO_UNCAUGHT_REJECTION";

/**
 * DelayedAsyncTask
 * 
 * A one-time task scheduler for asynchronous tasks, designed to schedule a single delayed execution.
 * 
 * Key features:
 * - Status getters to communicate the execution's state.
 * - Ability to abort a pending execution.
 * - Gracefully await the completion of an ongoing execution, if required.
 * - Safeguards against uncaught errors: an uncaught error is captured and accessible via the
 *   `uncaughtRejection` getter.
 * 
 * This is a modern substitute for JavaScript's built-in `setTimeout` function, specifically for
 * asynchronous tasks (callbacks that return a Promise). Unlike `setTimeout`, this scheduler provides
 * a mechanism to communicate the task's status, which can be:
 * - Pending: has not started yet.
 * - Aborted: via the `tryAbort` method.
 * - Currently executing.
 * - Completed successfully.
 * - Failed due to an uncaught rejection.
 * 
 * Additionally, `setTimeout` does not offer an out-of-the-box mechanism to await the completion of
 * an asynchronous task that has already started. Graceful termination is often required to ensure a
 * clean state, such as between unit tests where we want to avoid any tasks from previous tests
 * running in the background.
 * 
 * A concrete real-world usage example of a Background Updates Manager is provided in the README file.
 */
export class DelayedAsyncTask<UncaughtRejectionErrorType = Error> {
    private _status: DelayedAsyncTaskStatus = "PENDING";
    private _timeout: ReturnType<typeof setTimeout>;
    private _uncaughtRejection: UncaughtRejectionErrorType;
    private _currentlyExecutingTaskPromise: Promise<void>;

    private readonly _task: () => Promise<void>;

    /**
     * constructor
     * 
     * Schedules the provided task to start execution after the specified delay.
     * 
     * @param task The async function to execute.
     * @param delayTillExecutionMs The delay in milliseconds before the task starts execution.
     */
    constructor(task: () => Promise<void>, delayTillExecutionMs: number) {
        this._task = task;

        // The `setTimeout` callback is deliberately non-async, to prevent a dangling promise.
        // Instead, a class property promise is assigned, which can be awaited to enable graceful termination.
        this._timeout = setTimeout(
            (): void => {
                this._timeout = undefined;
                this._status = "EXECUTING";
                this._currentlyExecutingTaskPromise = this._handleTaskExecution();
            },
            delayTillExecutionMs
        );
    }
    
    /**
     * isPending
     * 
     * @returns `true` if the scheduled task is currently pending execution (i.e., not aborted and not
     *          in progress), `false` otherwise.
     */
    public get isPending(): boolean {
        return this._status === "PENDING";
    }

    /**
     * isExecuting
     * 
     * @returns `true` if the scheduled task is currently executing (i.e., in progress), `false` otherwise.
     */
    public get isExecuting(): boolean {
        return this._status === "EXECUTING";
    }

    /**
     * isAborted
     * 
     * @returns `true` if the scheduled task was aborted before it began executing, `false` otherwise.
     */
    public get isAborted(): boolean {
        return this._status === "ABORTED_BEFORE_EXECUTION";
    }

    /**
     * isCompleted
     * 
     * @returns `true` if the scheduled task has finished its execution without throwing an uncaught error,
     *          `false` otherwise.
     */
    public get isCompleted(): boolean {
        return this._status === "COMPLETED_SUCCESSFULLY";
    }

    /**
     * isUncaughtRejectionOccurred
     * 
     * @returns `true` if the scheduled task threw an uncaught error, `false` otherwise.
     */
    public get isUncaughtRejectionOccurred(): boolean {
        return this._status === "FAILED_DUE_TO_UNCAUGHT_REJECTION";
    }

    /**
     * uncaughtRejection
     * 
     * Ideally, delayed tasks should never throw an uncaught exception. However, this component provides
     * a comprehensive solution for handling such edge cases.
     * 
     * @returns An uncaught error thrown by the task during its execution, or `undefined` if no uncaught
     *          error was thrown (either because execution did not take place yet, was aborted, or completed
     *          successfully).
     */
    public get uncaughtRejection(): UncaughtRejectionErrorType | undefined {
        return this._uncaughtRejection;
    }
    
    /**
     * tryAbort
     * 
     * This method attempts to abort a pending task execution, if one exists. If the schedule was already
     * aborted, or the task is currently in progress, or it has already completed, this method does nothing.
     * 
     * @returns `true` if a pending execution was aborted, `false` otherwise.
     */
    public tryAbort(): boolean {
        if (this._status === "PENDING") {
            clearTimeout(this._timeout);
            this._timeout = undefined;
            this._status = "ABORTED_BEFORE_EXECUTION";
            return true;
        }

        return false;
    }

    /**
     * awaitCompletionIfCurrentlyExecuting
     * 
     * This method resolves once the currently executing task completes, or resolves immediately if the
     * task is not currently in-progress.
     * 
     * This capability addresses the need for graceful and deterministic termination:
     * Users may need the ability to wait for a currently ongoing execution. For example, to schedule a
     * new non-overlapping task or to perform operations while ensuring the scheduled task does not execute
     * concurrently.
     * 
     * Graceful termination should be considered in the following scenarios:
     * - If your component has a `terminate` or `stop` method.
     * - If there might be an attempt to abort a schedule. Such an attempt may fail if the task has already
     *   begun execution. In this case, you may want to communicate this failure to users or log the incident.
     * 
     * @returns A promise that resolves once the currently executing task finishes, or resolves immediately
     *          if no task was in progress.
     */
    public awaitCompletionIfCurrentlyExecuting(): Promise<void> {
        return this._currentlyExecutingTaskPromise ?? Promise.resolve();
    }
    
    private async _handleTaskExecution(): Promise<void> {
        try {
            await this._task();
            this._status = "COMPLETED_SUCCESSFULLY";
        } catch (err) {
            this._status = "FAILED_DUE_TO_UNCAUGHT_REJECTION";
            this._uncaughtRejection = err;
        } finally {
            this._currentlyExecutingTaskPromise = undefined;
        }
    }
}
