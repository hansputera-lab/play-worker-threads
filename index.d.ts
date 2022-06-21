import type { WorkerOptions, BroadcastChannel } from 'node:worker_threads';
import type { Worker } from './worker';

export type WorkerPoolOptions = {
	workerFile: string;
	maxWorkers?: number;
	minWorkers?: number;
	workerOptions?: WorkerOptions;
	maxIdleTime?: number;
	switchQueueTime?: number;
	maxJobsPerWorker?: number;
};

export declare class WorkerPool {
	private #channel: BroadcastChannel;
	constructor(readonly options: WorkerPoolOptions);

	public workers: Worker[];
	private #findAWorker(): Promise<Worker>;
	createWorker(): Promise<Worker>;
	deleteWorker(id: string): Promise<boolean>;
	run<A = Record<string, any>, V>(func: string, args: A): Promise<V>;
}
