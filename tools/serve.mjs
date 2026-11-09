#!/usr/bin/env node
// One demo and one API server, shared by npm run demo / lab / gallery.
import './index.mjs';
import {createLabServer} from '../experiments/vfx-lab/server.mjs';
const port=Number(process.argv[2]??4173);
createLabServer().listen(port,'127.0.0.1',()=>console.log(`Athanor: http://127.0.0.1:${port}/`));
