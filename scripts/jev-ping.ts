import { choice } from '@typesafe-ai/sdk';
import { createNodeJevClient } from '../src/jev/client';

const client = createNodeJevClient();
const started = performance.now();
const { data, requestId } = await client
  .systemOne({
    state: { command: 'turn the top twice' },
    questions: {
      is_face_turn: choice("Does `command` ask to turn one side of a Rubik's cube?", {
        yes: 'it asks to turn one side',
        no: 'it does not',
      }),
    },
  })
  .withResponse();
console.log(
  JSON.stringify(
    { model: data.model, answer: data.answers.is_face_turn, usage: data.usage, requestId, ms: Math.round(performance.now() - started) },
    null,
    2,
  ),
);
