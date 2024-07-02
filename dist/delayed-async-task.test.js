"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const delayed_async_task_1 = require("./delayed-async-task");
/**
 * resolveFast
 *
 * The one-and-only purpose of this function, is triggerring an event-loop iteration.
 * It is relevant whenever a test needs to simulate tasks from the Node.js' micro-tasks queue.
 */
const resolveFast = () => __awaiter(void 0, void 0, void 0, function* () { expect(14).toBeGreaterThan(3); });
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
        test('should indicate correct state when task executes successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            let taskCompletedSuccessfully = false;
            let completeTask;
            const task = () => __awaiter(void 0, void 0, void 0, function* () {
                return new Promise(res => {
                    completeTask = () => {
                        res();
                        taskCompletedSuccessfully = true;
                    };
                    // The task returns a promise in 'pending' state. It will be fulfilled
                    // only by manually invoking `completeTask`.
                });
            });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
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
            yield Promise.race([
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
            yield delayedTask.awaitCompletionIfCurrentlyExecuting();
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
        }));
    });
    describe('Negative path tests', () => {
        test('should successfully abort execution when the abort attempt precedes the scheduled time', () => __awaiter(void 0, void 0, void 0, function* () {
            let didTaskExecute = false;
            const task = () => __awaiter(void 0, void 0, void 0, function* () { didTaskExecute = true; });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
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
            yield delayedTask.awaitCompletionIfCurrentlyExecuting();
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
        }));
        test('should fail aborting task when execution is already ongoing', () => __awaiter(void 0, void 0, void 0, function* () {
            let completeTask;
            const task = () => __awaiter(void 0, void 0, void 0, function* () {
                return new Promise(res => {
                    completeTask = res;
                    // The task returns a promise in 'pending' state. It will be fulfilled
                    // only by manually invoking `completeTask`.
                });
            });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            // The time has come, `setTimeout` will trigger the task's execution.
            jest.runOnlyPendingTimers();
            // Trigger an event loop, only resolveFast will resolved as we haven't
            // decided to complete the task yet.
            yield Promise.race([
                delayedTask.awaitCompletionIfCurrentlyExecuting(),
                resolveFast()
            ]);
            // Cannot abort a task which already began execution.
            expect(delayedTask.tryAbort()).toBe(false);
            completeTask();
            yield delayedTask.awaitCompletionIfCurrentlyExecuting();
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
        }));
        test('should capture uncaught exception when thrown during execution', () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("בוקה ומבוקה! ולב נמס! ופק ברכיים");
            const task = () => __awaiter(void 0, void 0, void 0, function* () { throw error; });
            expect(setTimeoutSpy).toHaveBeenCalledTimes(0);
            const delayedTask = new delayed_async_task_1.DelayedAsyncTask(task, MOCK_MS_DELAY_TILL_EXECUTION);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // Scheduled immediately on instantiation.
            expect(delayedTask.isPending).toBe(true);
            // All other getters should be false.
            expect(delayedTask.isAborted).toBe(false);
            expect(delayedTask.isExecuting).toBe(false);
            expect(delayedTask.isCompleted).toBe(false);
            expect(delayedTask.isUncaughtRejectionOccurred).toBe(false);
            expect(delayedTask.uncaughtRejection).toBe(undefined);
            jest.runOnlyPendingTimers();
            yield delayedTask.awaitCompletionIfCurrentlyExecuting();
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
        }));
    });
});
//# sourceMappingURL=delayed-async-task.test.js.map