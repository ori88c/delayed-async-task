"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const delayed_async_task_1 = require("./delayed-async-task");
/**
 * resolveFast
 *
 * The one-and-only purpose of this function, is triggerring an event-loop iteration.
 * It is relevant whenever a test needs to simulate tasks from the Node.js' micro-tasks queue.
 */
const resolveFast = async () => { expect(14).toBeGreaterThan(3); };
const MOCK_MS_DELAY_TILL_EXECUTION = 83564;
describe('DelayedAsyncTask tests', () => {
    let setTimeoutSpy;
    beforeEach(() => {
        jest.useFakeTimers();
        setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    });
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });
    describe('Happy path tests', () => {
        test('should reflect correct state after successful task execution', async () => {
            let isCompleted = false;
            let completeTask;
            // We create unresolved promises, simulating an async work in progress.
            // They will be resolved later, once we want to simulate a successful completion
            // of the async work.
            const task = async () => new Promise(res => {
                completeTask = () => {
                    res();
                    isCompleted = true;
                };
            });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            expect(isCompleted).toBe(false);
            expect(delayedTask.isPending).toBe(true);
            // All other state getters should return false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            // The time has come, `setTimeout` will trigger the execution.
            jest.runOnlyPendingTimers();
            // Trigger an event loop. Among the provided promises, only `resolveFast`
            // will resolve, since the task hasn't been completed yet.
            const awaitCompletionPromise = delayedTask.awaitCompletionIfCurrentlyExecuting();
            await Promise.race([
                awaitCompletionPromise,
                resolveFast()
            ]);
            expect(delayedTask.isExecuting).toBe(true);
            // All other state getters should return false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            expect(isCompleted).toBe(false);
            // Now, we simulate the task's completion (its promise will be fulfilled).
            completeTask();
            await awaitCompletionPromise;
            expect(isCompleted).toBe(true);
            expect(delayedTask.isCompleted).toBe(true);
            // All other state getters should return false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            // Unchanged behavior:
            // A single `DelayedAsyncTask` instance triggers exactly one `setTimeout` call in the constructor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });
    });
    describe('Negative path tests', () => {
        test('should successfully abort execution when attempted before the scheduled time', async () => {
            let didTaskExecute = false;
            const task = () => new Promise(res => {
                didTaskExecute = true;
                res();
            });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            expect(delayedTask.isPending).toBe(true);
            // All other state getters should return false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            expect(delayedTask.tryAbort()).toBe(true);
            // No pending timer should exist, thus nothing should happen:
            jest.runOnlyPendingTimers();
            // Should resolve immediately since no task is executing:
            await delayedTask.awaitCompletionIfCurrentlyExecuting();
            expect(didTaskExecute).toBe(false);
            expect(delayedTask.isAborted).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            // Unchanged behavior:
            // A single `DelayedAsyncTask` instance triggers exactly one `setTimeout` call in the constructor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });
        test('should fail to abort the task when execution is already ongoing', async () => {
            let completeTask;
            // We create unresolved promises, simulating an async work in progress.
            // They will be resolved later, once we want to simulate a successful completion
            // of the async work.
            const task = async () => new Promise(res => {
                completeTask = res;
            });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            // The time has come, `setTimeout` will trigger the task's execution.
            jest.runOnlyPendingTimers();
            // Trigger an event loop. Among the provided promises, only `resolveFast`
            // will resolve, since the task hasn't been completed yet.
            const awaitCompletionPromise = delayedTask.awaitCompletionIfCurrentlyExecuting();
            await Promise.race([
                awaitCompletionPromise,
                resolveFast()
            ]);
            // Cannot abort a task which already began execution.
            expect(delayedTask.tryAbort()).toBe(false);
            completeTask();
            await awaitCompletionPromise;
            expect(delayedTask.isCompleted).toBe(true);
            // All other state getters should return false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            // Unchanged behavior:
            // A single `DelayedAsyncTask` instance triggers exactly one `setTimeout` call in the constructor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });
        test('should capture uncaught exceptions thrown during execution', async () => {
            const error = new Error("בוקה ומבוקה! ולב נמס! ופק ברכיים");
            const task = async () => { throw error; };
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            expect(delayedTask.isPending).toBe(true);
            // All other state getters should return false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            jest.runOnlyPendingTimers();
            await delayedTask.awaitCompletionIfCurrentlyExecuting();
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(true);
            expect(delayedTask.uncaughtRejection).toBe(error);
            // All other state getters should return false.
            expect(delayedTask.isPending).toBe(false);
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            // Unchanged behavior:
            // A single `DelayedAsyncTask` instance triggers exactly one `setTimeout` call in the constructor.
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=delayed-async-task.test.js.map