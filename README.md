<h2 align="middle">Delayed Async Task</h2>

The `DelayedAsyncTask` class provides a modern substitute for JavaScript's built-in `setTimeout` function, specifically tailored for asynchronous tasks (callbacks returning a Promise). This **one-time** scheduler is designed to handle the delayed execution of a single asynchronous task, offering advanced capabilities beyond basic delay.

Key features include:

* __Status Communication__: Easily check the current status of the scheduled task.
* __Graceful Termination__: Await the completion of an ongoing execution, ensuring deterministic termination when needed.

This class is ideal for scenarios where precise control over the execution and termination of asynchronous tasks is required. If you need to manage **multiple** asynchronous tasks, potentially in large numbers, consider the [delayed-async-tasks-manager](https://www.npmjs.com/package/delayed-async-tasks-manager) package, which extends the functionality of this package.

## Table of Contents

* [Key Features](#key-features)
* [API](#api)
* [Execution Status Getters](#execution-status-getters)
* [Graceful and Deterministic Termination](#graceful-termination)
* [Zero Over-Engineering, No External Dependencies](#no-external-dependencies)
* [Non-Persistent Scheduling](#non-persistent)
* [Error Handling](#error-handling)
* [Use-case Example](#use-case-example)
* [Breaking Change in Version 2.0.0](#breaking-change-2)
* [License](#license)

## Key Features :sparkles:<a id="key-features"></a>

* __Modern Substitute for Javascript's 'setTimeout'__: Specifically designed for scheduling asynchronous tasks.
* __Execution Status Getters :bar_chart:__: Allows users to check the task's execution status, helping to prevent potential race conditions.
* __Graceful and Deterministic Termination :hourglass:__: The `awaitCompletionIfCurrentlyExecuting` method resolves once the currently executing task finishes, or resolves immediately if the task is not executing.
* __Robust Error Handling :warning:__: If the task throws an uncaught error, the error is captured and accessible via the `uncaughtRejection` getter.
* __Comprehensive Documentation :books:__: The class is thoroughly documented, enabling IDEs to provide helpful tooltips that enhance the coding experience.
* __Fully Tested :test_tube:__: Extensively covered by unit tests.
* __No External Runtime Dependencies__: Lightweight component, only development dependencies are used.
* Non-Durable Scheduling: Scheduling stops if the application crashes or goes down.
* ES2020 Compatibility.
* TypeScript support.

## API :globe_with_meridians:<a id="api"></a>

The `DelayedAsyncTask` class provides the following methods:

* __tryAbort__: Attempts to abort a pending task execution, if one exists.
* __awaitCompletionIfCurrentlyExecuting__: This method resolves once the currently executing task completes, or resolves immediately if the task is not currently in-progress.

If needed, refer to the code documentation for a more comprehensive description of each method.

## Execution Status Getters :mag:<a id="execution-status-getters"></a>

The `DelayedAsyncTask` class provides five getter methods to communicate the task's status to users:

* `isPending`: Indicates that the execution has not started yet.
* `isAborted`: Indicates that the task was aborted by the `tryAbort` method.
* `isExecuting`: Indicates that the task is currently executing.
* `isCompleted`: Indicates that the task has completed.
* `isUncaughtRejectionOccurred`: Indicates that the task threw an uncaught error. The error can be accessed using the `uncaughtRejection` getter.

## Graceful and Deterministic Termination :hourglass:<a id="graceful-termination"></a>

In the context of asynchronous tasks and schedulers, graceful and deterministic termination is **often overlooked**. `DelayedAsyncTask` provides an out-of-the-box mechanism to await the completion of an asynchronous task that has already started but not yet finished, via the `awaitCompletionIfCurrentlyExecuting` method.

Without deterministic termination, leftover references from incomplete executions can cause issues such as unexpected behavior during unit tests. A clean state is essential for each test, as ongoing tasks from a previous test can interfere with subsequent ones.

This feature is crucial whenever your component has a `stop` or `terminate` method. Consider the following example:
```ts
class Component {
  private _timeout: NodeJS.Timeout;

  public start(): void {
    this._timeout = setTimeout(this._prolongedTask.bind(this), 8000);
  }

  public async stop(): Promise<void> {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
      // The dangling promise of _prolongedTask might still be running in the
      // background, leading to non-deterministic termination and potential
      // race conditions or unexpected behavior.
    }
  }

  private async _prolongedTask(): Promise<void> {
    // Perform your task here.
  }
}
```
While it is possible to manually address this issue by **avoiding dangling promises** and introducing more state properties, doing so can compromise the **Single Responsibility Principle** of your component. It can also decrease readability and likely introduce code duplication, as this need is frequent.  
The above example can be fixed using the `DelayedAsyncTask` class as follows:
```ts
import { DelayedAsyncTask } from 'delayed-async-task';

class Component {
  private readonly _delayedTask: AsyncDelayedTask;

  public start(): void {
    this._delayedTask = new AsyncDelayedTask(
      this._prolongedTask.bind(this),
      8000
    );
  }

  public async stop(): Promise<void> {
    if (!this._delayedTask.tryAbort()) {
      await this._delayedTask.awaitCompletionIfCurrentlyExecuting();
    }
  }

  private async _prolongedTask(): Promise<void> {
    // Perform your task here.
  }
}
```

Another scenario where this feature is highly recommended is when a schedule might be aborted, such as in an abort-and-reschedule situation. If the task is currently executing, you may not be able to abort it. In such cases, you can ignore the reschedule request, await the current execution to complete, or implement any other business logic that suits your requirements.

## Zero Over-Engineering, No External Dependencies<a id="no-external-dependencies"></a>

This component provides a lightweight, dependency-free solution. It is designed to be simple and efficient, ensuring minimal overhead. Additionally, it can serve as a building block for more advanced implementations, such as a Delayed Async Tasks Manager, if needed.

## Non-Persistent Scheduling<a id="non-persistent"></a>

This component features non-durable scheduling, which means that if the app crashes or goes down, scheduling stops.

If you need to guarantee durability over a multi-node deployment, consider using this scheduler as a building block or use other custom-made solutions for that purpose.

## Error Handling :warning:<a id="error-handling"></a>

Unlike `setTimeout` in Node.js, where errors from rejected promises propagate to the event loop and trigger an `uncaughtRejection` event, this package offers robust error handling:

* Errors thrown during task's execution are captured, and accessible via the `uncaughtRejection` getter.
* Use the `isUncaughtRejectionOccurred` getter to determine if an uncaught error occurred during execution.

Ideally, a delayed task should handle its own errors and **avoid** throwing uncaught exceptions.

## Use-case Example :man_technologist:<a id="use-case-example"></a>

Consider a Background Updates Manager. For simplicity, we assume that updates occur only following an on-demand request by the admin, triggered by the execution of the `scheduleNextJob` method. Additionally, assume that only one future background update task can be scheduled at any given time. This means that scheduling a new task will abort any previously scheduled task that has not yet started.

Please note that this example is overly simplified. Real-world usage examples can be more complex, often involving durability and synchronization with external resources, as most modern applications are stateless.

```ts
import { DelayedAsyncTask } from 'delayed-async-task';

class BackgroundUpdatesManager {
  private _delayedBackgroundTask: DelayedAsyncTask?;

  public async scheduleNextJob(nextExecutionDate: Date): Promise<void> {
    // This method may override a previous schduled date, thus we need to abort
    // such a previous-schedule if possible.
    await this._abortIfPossibleOrAwaitCompletion();

    const msTillNextExecution = nextExecutionDate.getTime() - Date.now();
    this._delayedBackgroundTask = new DelayedAsyncTask(
      this._installNewestUpdates.bind(this),
      msTillNextExecution
    );
  }

  private async _abortIfPossibleOrAwaitCompletion(): Promise<void> {
    if (!this._delayedBackgroundTask) {
      return; // No previous execution exists.
    }

    if (this._delayedBackgroundTask.tryAbort()) {
      logger.info(`Aborted a previously scheduled background updates task`);
      return;
    }
        
    if (this._delayedBackgroundTask.isExecuting) {
      logger.info('Waiting for a previously scheduled background updates task to finish execution...');
      await this._delayedBackgroundTask.awaitCompletionIfCurrentlyExecuting();
    }

    const uncaughtError = this._delayedBackgroundTask.uncaughtRejection;
    if (uncaughtError) {
      logger.error(
        `Previous background updates execution failed with uncaught error: ${uncaughtError.message}`
      );
      return;
    }

    // At this stage, necessarily this._delayedBackgroundTask.isCompleted === true
    // as all other options were eliminated.
    logger.info('Previously scheduled background updates task has finished successfully');
  }
    
  private async _installNewestUpdates(): Promise<void> {
    // Potentially a prolonged operation:
    // * Checks for the newest-uninstalled updates.
    // * Downloads them.
    // * Installs them.
  }
}
```

## Breaking Change in Version 2.0.0 :boom:<a id="breaking-change-2"></a>

In version 2.0.0, the target compatibility has been upgraded from ES6 to ES2020. This change was made to leverage the widespread adoption of ES2020, in particular its native support for async/await.

## License :scroll:<a id="license"></a>

[MIT](LICENSE)
