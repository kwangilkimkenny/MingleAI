export interface Match {
  id: string;
  profileId1: string;
  profileId2: string;
  createdAt: string;
}

export interface Block {
  id: string;
  blockerProfileId: string;
  blockedProfileId: string;
  createdAt: string;
}

export interface DirectMessageRoom {
  id: string;
  matchId: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  roomId: string;
  senderProfileId: string;
  /** 이미지만 보낸 메시지는 빈 문자열. */
  content: string;
  /** 첨부 이미지 URL(자체 업로드 경로). 없으면 텍스트 메시지. */
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

/** A profile as exposed to a peer (no riskScore / raw preferenceSignals). */
export interface PeerProfile {
  profileId: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  photoUrl?: string;
  preferenceSummary?: string;
}

/** One row in the match/chat list. */
export interface MatchSummary {
  matchId: string;
  roomId: string;
  peer: PeerProfile;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

/** A received/sent proposal with the counterpart projection. */
export interface NewMessageEvent {
  roomId: string;
  message: DirectMessage;
}
export interface ReadEvent {
  roomId: string;
  readerProfileId: string;
  lastReadAt: string;
}
export interface TypingEvent {
  roomId: string;
  profileId: string;
  isTyping: boolean;
}
