import { LOCOMOTION } from './locomotion';
import { INTERACTION } from './interaction';
import { REACTIONS } from './reactions';
import { SPORTS } from './sports';
import { CHARACTER } from './character';
import { CRICKET } from './cricket';
import type { ClipDef } from '../pose';

export const ALL_CLIP_DEFS: ClipDef[] = [
  ...LOCOMOTION, ...INTERACTION, ...REACTIONS, ...SPORTS, ...CHARACTER, ...CRICKET,
];

export { LOCOMOTION, INTERACTION, REACTIONS, SPORTS, CHARACTER, CRICKET };
