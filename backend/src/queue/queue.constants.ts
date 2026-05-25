/**
 * Single source of truth for BullMQ queue names. Imported by both the queue
 * module (to register) and the producers/consumers (to refer to the same
 * queue without copy-pasting magic strings).
 */
export const WHATSAPP_BLAST_QUEUE = 'whatsapp-blast';
