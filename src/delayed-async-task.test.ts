import { DelayedAsyncTask } from './delayed-async-task';
  
type PromiseResolveCallbackType = (value?: unknown) => void;

/**
 * resolveFast
 * 
 * The one-and-only purpose of this function, is triggerring an event-loop iteration.
 * It is relevant whenever a test needs to simulate tasks from the Node.js' micro-tasks queue.
 */
const resolveFast = async () => { expect(14).toBeGreaterThan(3); };

const MOCK_MS_DELAY_TILL_EXECUTION = 83564;

describe('DelayedAsyncTask tests', () => {
    let setTimeoutSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    });
  
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });
  
    describe('Happy path tests', () => {
        test('should indicate correct state when task executes successfully', async () => {
            let taskCompletedSuccessfully = false;
            let completeTask: () => void;
            const task = async (): Promise<void> => new Promise(res => {
                completeTask = (): void => {
                    res();
                    taskCompletedSuccessfully = true;
                };
                // The task returns a promise in 'pending' state. It will be fulfilled
                // only by manually invoking `completeTask`.
            });
  
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            expect(taskCompletedSuccessfully).toBe(false);

            expect(delayedTask.isPending).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);

            // The time has come, `setTimeout` will trigger the task's execution.
            jest.runOnlyPendingTimers();
            // Trigger an event loop, only resolveFast will resolved as we haven't
            // decided to complete the task yet.
            await Promise.race([
                delayedTask.awaitCompletionIfCurrentlyExecuting(),
                resolveFast()
            ]);

            // Execution indicator should be on.
            expect(delayedTask.isExecuting).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            expect(taskCompletedSuccessfully).toBe(false);

            // Now, we simulate the task's completion (its promise will be fulfilled).
            completeTask();
            await delayedTask.awaitCompletionIfCurrentlyExecuting();
            expect(taskCompletedSuccessfully).toBe(true);

            expect(delayedTask.isCompleted).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
  
            // Remains unchanged:
            // A single DelayedAsyncTask instance triggers only 1 `setTimeout` call, in the c'tor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });
    });
  
    describe('Negative path tests', () => {
        test('should successfully abort execution when the abort attempt precedes the scheduled time', async () => {
            let didTaskExecute = false;
            const task = async (): Promise<void> => { didTaskExecute = true; };
  
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
  
            expect(delayedTask.isPending).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
  
            expect(delayedTask.tryAbort()).toBe(true);

            // No pending timer should exist, thus nothing should happen:
            jest.runOnlyPendingTimers();
            // Should resolve immediately as no task is executing:
            await delayedTask.awaitCompletionIfCurrentlyExecuting();
  
            expect(didTaskExecute).toBe(false);

            expect(delayedTask.isAborted).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
  
            // Remains unchanged:
            // A single DelayedAsyncTask instance triggers only 1 `setTimeout` call, in the c'tor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });

        test('should fail aborting task when execution is already ongoing', async () => {
            let completeTask: PromiseResolveCallbackType;
            const task = async (): Promise<void> => new Promise(res => {
                completeTask = res;
                // The task returns a promise in 'pending' state. It will be fulfilled
                // only by manually invoking `completeTask`.
            });
  
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.

            // The time has come, `setTimeout` will trigger the task's execution.
            jest.runOnlyPendingTimers();
            // Trigger an event loop, only resolveFast will resolved as we haven't
            // decided to complete the task yet.
            await Promise.race([
                delayedTask.awaitCompletionIfCurrentlyExecuting(),
                resolveFast()
            ]);
  
            // Cannot abort a task which already began execution.
            expect(delayedTask.tryAbort()).toBe(false);

            completeTask();
            await delayedTask.awaitCompletionIfCurrentlyExecuting();

            expect(delayedTask.isCompleted).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
  
            // Remains unchanged:
            // A single DelayedAsyncTask instance triggers only 1 `setTimeout` call, in the c'tor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });

        test('should capture uncaught exception when thrown during execution', async () => {
            const error = new Error("בוקה ומבוקה! ולב נמס! ופק ברכיים");
            const task = async (): Promise<void> => { throw error; };

            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.

            expect(delayedTask.isPending).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);

            jest.runOnlyPendingTimers();
            await delayedTask.awaitCompletionIfCurrentlyExecuting();

            expect(delayedTask.isUncaughtRejectionOccurred).toBe(true);
            expect(delayedTask.uncaughtRejection).toBe(error);
            // All other getters should be false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);

            // Remains unchanged:
            // A single DelayedAsyncTask instance triggers only 1 `setTimeout` call, in the c'tor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });
    });
});
    