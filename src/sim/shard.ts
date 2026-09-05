/** One shard of a simulation batch. Prints a JSON accumulator on stdout. */
import { accumulate, emptyAccumulator } from './metrics';
import { objectiveFor, runOne, type RunConfig } from './runner';

type ShardSpec = Omit<RunConfig, 'seed' | 'botSeed'> & {
  seedPrefix: string;
  from: number;
  to: number;
};

const spec = JSON.parse(process.argv[2] ?? '{}') as ShardSpec;
const acc = emptyAccumulator();
for (let i = spec.from; i < spec.to; i++) {
  accumulate(
    acc,
    runOne({
      seed: `${spec.seedPrefix}${i}`,
      role: spec.role,
      depth: spec.depth,
      bot: spec.bot,
      botSeed: `bot${i}`,
      objective: objectiveFor(i),
      entropy: spec.entropy,
    }),
  );
}
process.stdout.write(JSON.stringify(acc));
