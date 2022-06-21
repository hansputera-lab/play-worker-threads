import * as workerThreads from 'node:worker_threads';

if (workerThreads.isMainThread)
	throw new Error('You are not allowed to run this on main thread!');

/**
 * Handle created thread function.
 * @param  {...Function} callablefunc callable function.
 * @return {Promise<void>}
 */
export const createThreadFunc = async (...callablefunc) => {
	workerThreads.parentPort.on('message', async (m) => {
		console.log(m);
		if (typeof m.data === 'object' && m.data.name && m.data.args && m.id) {
			const func = callablefunc.find((f) => f.name === m.data.name);
			if (func) {
				try {
					const result = await func(m.data.args);
					workerThreads.parentPort.postMessage({
						type: 1,
						data: result,
						id: m.id,
					});
				} catch (err) {
					workerThreads.parentPort.postMessage({
						type: 2,
						data: err.message,
						id: m.id,
					});
				}
			} else {
				workerThreads.parentPort.postMessage({
					type: 0,
					id: m.id,
				});
			}
		}
	});
};
