import type { WorkerOptions, Worker } from 'node:worker_threads';

export type Queue = {
	id: string;
	callback?: (result: any) => Promise<void> | void;
	timeout: NodeJS.Timeout;
	data: any;
};

export declare class Worker {
	public readonly id: string;
	public readonly _maxJobs: number;
	private #worker: Worker;
	private #timeout: NodeJS.Timeout;
	public queues: Queue[];
	constructor(
		readonly workerfile: string,
		readonly options: WorkerOptions,
		readonly transferToAnotherWorkerAfter?: number,
		readonly maxIdle?: number,
	);
	input(cloneableData: any): Promise<string>;
	exit(force?: boolean): Promise<void>;
	private #process(queueIndex: number): Promise<void>;
}
