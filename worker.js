import * as workerThreads from 'node:worker_threads';
import { randomUUID } from 'node:crypto';

/** @typedef {import('./worker').Queue} Queue */

/**
 * @class Worker
 */
export class Worker {
	#channel = new workerThreads.BroadcastChannel('workerpool');
	/** @type {workerThreads.Worker} */
	#worker = undefined;
	/** @type {NodeJS.Timeout} */
	#timeout = undefined;
	/**
	 * @constructor
	 * @param {string} workerfile Worker script file path.
	 * @param {workerThreads.WorkerOptions?} options Worker options.
	 * @param {number?} transferToAnotherWorkerAfter Transfer job to another worker time.
	 * @param {number?} maxIdle Max idle time.
	 */
	constructor(
		workerfile,
		options,
		transferToAnotherWorkerAfter = 10000,
		maxIdle = 30000,
	) {
		this.id = randomUUID().split('-')[0];
		this.#worker = new workerThreads.Worker(workerfile, options);
		this.#timeout = setTimeout(() => {
			if (!this.queues.length) {
				this.#worker.terminate();
				this.#channel.postMessage({
					event: 2,
					workerId: this.id,
				});
			}
		}, maxIdle || 30000);
		this._transferToAnotherWorkerTime = transferToAnotherWorkerAfter || 10_000;

		/** @type {Queue[]} @description Job Queues. */
		this.queues = [];

		this.#worker.on('message', (m) => {
			const qIndex = this.queues.findIndex((q) => q.id === m.id);
			if (this.queues[qIndex].timeout)
				clearTimeout(this.queues[qIndex].timeout);

			if (m.type === 0 || m.type === 1) {
				this.queues[qIndex].callback(
					m.type === 1 ? m.data : new Error("The function doesn't exist!"),
				);
			} else if (m.type === 2) {
				this.queues[qIndex].callback(m.data);
			}

			if (this.queues.length >= qIndex + 1) {
				this.queues.shift();
				if (this.queues.length) this.#process(0);
			}

			if (!this.queues.length)
				this.#timeout = setTimeout(() => {
					if (!this.queues.length) {
						this.#worker.terminate();
						this.#channel.postMessage({
							event: 2,
							workerId: this.id,
						});
					}
				}, maxIdle || 30000);
		});
	}

	async #process(queueIndex) {
		if (!this.queues[queueIndex].timeout)
			this.queues[queueIndex].timeout = setTimeout(() => {
				this.#channel.postMessage({
					data: this.queues.filter((q) => q.id !== this.queues[queueIndex].id),
					event: 1,
					workerId: this.id,
				});
				this.queues = [this.queues[queueIndex]];
			}, this._transferToAnotherWorkerTime);

		this.#worker.postMessage({
			id: this.queues[queueIndex].id,
			data: this.queues[queueIndex].data,
		});
	}

	/**
	 * Send data to the thread.
	 * @param {*} cloneableData Any cloneable data.
	 * @return {Promise<string>}
	 */
	input(cloneableData) {
		if (this.queues.length >= this._maxJobs) {
			// tell workerpool to switch this queue.
			// this.#channel.postMessage({
			//   data: cloneableData,
			//   type: 3,
			//   workerId: this.id,
			//   id,
			// });

			// console.log(id);

			return 'SWITCH';
		}

		const id = randomUUID().split('-')[0];
		try {
			if (this.#timeout) clearTimeout(this.#timeout);
			this.queues.push({
				id,
				data: cloneableData,
			});
			if (this.queues[0].id === id) this.#process(0);
			return id;
		} catch {
			this.queues = this.queues.filter((q) => q.id !== id);
			return undefined;
		}
	}

	/**
	 * Terminate the worker.
	 * @param {boolean?} force Force exit the worker?
	 * @return {Promise<void>}
	 */
	async exit(force = false) {
		if (force && this.queues.length) {
			// cancel current queue.
			if (this.#timeout) clearTimeout(this.#timeout);
			if (this.queues[0].timeout) clearTimeout(this.queues[0].timeout);

			// tell workerpool to switch current queues.
			this.#channel.postMessage({
				event: 1,
				workerId: this.id,
				data: this.queues,
			});
			this.queues = [];

			this.#worker.terminate();
			// tell workerpool to create new one worker.
			this.#channel.postMessage({
				event: 2,
				workerId: this.id,
			});
		} else if (!this.queues.length) {
			if (this.#timeout) clearTimeout(this.#timeout);
			this.#worker.terminate();
			this.#worker.removeAllListeners('exit');
			// tell workerpool to create new one worker.
			this.#channel.postMessage({
				event: 2,
				workerId: this.id,
			});
		} else {
			console.warn('Are you sure want terminate the worker?');
			return;
		}
	}
}
