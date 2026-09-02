/**
 * Archive form semantics (06-hydra): size, credibility and replication
 * properties differ per form. A 15 KB index can carry the dangerous
 * semantic payload while a 200 GB full archive cannot move quickly.
 */
import type { CopyForm, InfoCopy, InfoLevel } from './types'

export const INFOS_LEVELS_BY_FORM: Record<CopyForm, InfoLevel> = {
  original: 0,
  full: 2,
  excerpt: 3,
  index: 3,
  screenshot: 4,
  summary: 5,
}

export const FORM_SIZE_FRACTION: Record<CopyForm, number> = {
  original: 1,
  full: 0.9,
  excerpt: 0.08,
  index: 0.0001,
  screenshot: 0.02,
  summary: 0.00005,
}

export function COPY_FORM_BYTES(parent: InfoCopy, form: CopyForm): number {
  return Math.max(1, Math.round((parent.bytes || 1) * FORM_SIZE_FRACTION[form]))
}

export const FORM_LABELS: Record<CopyForm, string> = {
  original: 'ORIGINAL',
  full: 'FULL',
  excerpt: 'EXCERPT',
  index: 'INDEX',
  screenshot: 'SCREENSHOT',
  summary: 'SUMMARY',
}
