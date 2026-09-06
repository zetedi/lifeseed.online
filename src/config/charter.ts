import raw from '../../node.json';
import { charterProblem, charterHosts, charterOrigin, charterOwnDomains, type Charter } from '../domain/charter';

// THE NODE THIS SHELL RUNS AS (ring 2026-09-06) — node.json, read once. Every place the code
// used to name lightseed.online, its bucket, its keeper or its push key reads from here.
export const charter: Charter = raw as Charter;
const problem = charterProblem(charter);
if (problem) console.error(`[lightseed] node.json is not a sound charter: ${problem}`);
export const nodeOrigin = charterOrigin(charter);
export const nodeHosts = charterHosts(charter);
export const nodeDomains = charterOwnDomains(charter);
