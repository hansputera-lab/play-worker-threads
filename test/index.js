import { WorkerPool } from '../index.js';
import * as assert from 'node:assert';

const workerPool = new WorkerPool({
	'workerFile': './worker.js',
	'maxWorkers': 50,
	'maxJobsPerWorker': 10,
});

console.time('work');
for (let i = 0; i < 1000; i++) {
    const result = await workerPool.run('add', {
        one: i+1,
        two: i+2,
    });

    assert.strictEqual(result, (i+1)+(i+2));
}
console.timeEnd('work');
process.exit(0);