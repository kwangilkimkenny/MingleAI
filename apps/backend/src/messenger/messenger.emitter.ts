import type { NewMessageEvent, ReadEvent } from "@mingle/shared";

export const MESSENGER_EMITTER = Symbol("MESSENGER_EMITTER");

export interface MessengerEmitter {
  emitNewMessage(event: NewMessageEvent): void;
  emitRead(event: ReadEvent): void;
}
