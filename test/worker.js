import { createThreadFunc } from '../thread.js';

const add = ({ one, two }) => one + two;

createThreadFunc(add);
