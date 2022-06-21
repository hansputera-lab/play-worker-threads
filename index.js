import { BroadcastChannel } from 'node:worker_threads';
import { Worker } from './worker.js';

/** @typedef {import('./index').WorkerPoolOptions} WorkerPoolOptions */

/**
 * @class WorkerPool
 */
export class WorkerPool {
	#channel = new BroadcastChannel('workerpool');

	/**
	 * @constructor
	 * @param {WorkerPoolOptions} options WorkerPool options.
	 */
	constructor(options) {
		if (typeof options !== 'object' || Array.isArray(options)) {
			throw new TypeError('Invalid options!');
		}

		if (typeof options.minWorkers !== 'number') options.minWorkers = 3;
		if (typeof options.maxWorkers !== 'number') options.maxWorkers = 10;
		if (typeof options.maxIdleTime !== 'number') options.maxIdleTime = 30_000;
		if (typeof options.switchQueueTime !== 'number')
			options.switchQueueTime = 10_000;
		if (typeof options.maxJobsPerWorker !== 'number')
			options.maxJobsPerWorker = 150;

		this.options = options;
		/** @type {Worker[]} */
		this.workers = new Array(options.minWorkers)
			.fill(undefined)
			.map(
				() =>
					new Worker(
						options.workerFile,
						options.workerOptions,
						options.switchQueueTime,
						options.maxIdleTime,
					),
			);

		this.#channel.onmessage = async (m) => {
			if (m.data && m.data.event && m.data.workerId) {
				switch (m.data.event) {
					case 1: // SWITCH QUEUE
						m.data.data.forEach((queue) => {
							this.#findAWorker().input(queue.data);
						});
						break;
					case 2: // CREATE WORKER
						this.createWorker();
						this.deleteWorker(m.data.workerId);
						break;
					default:
						console.log('[WORKERPOOL]: Unknown signal from', m.data.workerId);
						break;
				}
			}
		};
	}

	/**
	 * Find a worker.
	 * @return {Worker}
	 */
	#findAWorker() {
		let worker = this.workers.reduce((prev, curr) =>
			prev.queues.length < curr.queues.length ? prev : curr,
		);

		return worker;
	}

	/**
	 * Create new worker.
	 * @return {Promise<Worker>}
	 */
	async createWorker() {
		if (this.workers.length >= this.options.maxWorkers) return undefined;
		this.workers.push(
			new Worker(
				this.options.workerFile,
				this.options.workerOptions,
				this.options.switchQueueTime,
				this.options.maxIdleTime,
			),
		);

		return this.workers.at(-1);
	}

	/**
	 * Delete a worker from list.
	 * @param {string} id Worker Identifier.
	 * @return {Promise<boolean>}
	 */
	async deleteWorker(id) {
		const worker = this.workers.find((w) => w.id === id);
		if (worker) {
			worker.exit(true);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * @param {string} func Function name.
	 * @param {unknown} args Function args.
	 * @return {Promise<unknown>}
	 */
	async run(func, args) {
		return await new Promise(async (resolve, reject) => {
			let worker = this.#findAWorker();

			if (worker.queues.length >= this.options.maxJobsPerWorker) {
				worker = await this.createWorker();
			}

			let queueId = await worker.input({
				name: func,
				args,
			});

			if (queueId === 'SWITCH') {
				worker = this.#findAWorker();
				queueId = await worker.input({
					name: func,
					args,
				});
			}

			worker.queues[worker.queues.findIndex((q) => q.id === queueId)].callback =
				(result) => {
					if (result instanceof Error) return reject(result);
					else resolve(result);
				};
		});
	}
}
