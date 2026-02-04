import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { ProfileRepo } from "../storage/profile.repo.js";
import { SafetyService } from "./safety.service.js";
import type {
  Profile,
  Gender,
  UserPreferences,
  UserValues,
  CommunicationStyle,
} from "@mingle/shared";

export interface CreateProfileInput {
  userId: string;
  name: string;
  age: number;
  gender: Gender;
  location: string;
  occupation?: string;
  preferences: UserPreferences;
  values: UserValues;
  communicationStyle: CommunicationStyle;
  bio?: string;
}

export interface UpdateProfileInput {
  preferences?: UserPreferences;
  values?: UserValues;
  communicationStyle?: CommunicationStyle;
  bio?: string;
  location?: string;
}

export class ProfileService {
  private repo: ProfileRepo;
  private safety: SafetyService;

  constructor(db: Database.Database) {
    this.repo = new ProfileRepo(db);
    this.safety = new SafetyService(db);
  }

  create(input: CreateProfileInput): Profile {
    if (input.bio) {
      const check = this.safety.checkContent(input.bio, "profile_bio");
      if (!check.safe) {
        const reasons = check.violations.map((v) => v.description).join("; ");
        throw new Error(`프로필 내용이 안전 정책을 위반했습니다: ${reasons}`);
      }
    }

    const agentPersona = this.generateAgentPersona(input);

    const profile: Profile = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      age: input.age,
      gender: input.gender,
      location: input.location,
      occupation: input.occupation,
      preferences: input.preferences,
      values: input.values,
      communicationStyle: input.communicationStyle,
      bio: input.bio,
      agentPersona,
      riskScore: 0,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.repo.insert(profile);
    return profile;
  }

  getById(id: string): Profile | null {
    return this.repo.findById(id);
  }

  list(
    filters?: { relationshipGoal?: string; location?: string; ageMin?: number; ageMax?: number },
    limit = 20,
    offset = 0
  ): Profile[] {
    return this.repo.findAll(filters, limit, offset);
  }

  update(id: string, input: UpdateProfileInput): Profile {
    const existing = this.repo.findById(id);
    if (!existing) throw new Error(`프로필을 찾을 수 없습니다: ${id}`);

    if (input.bio) {
      const check = this.safety.checkContent(input.bio, "profile_bio");
      if (!check.safe) {
        const reasons = check.violations.map((v) => v.description).join("; ");
        throw new Error(`프로필 내용이 안전 정책을 위반했습니다: ${reasons}`);
      }
    }

    const merged = {
      ...existing,
      preferences: input.preferences ?? existing.preferences,
      values: input.values ?? existing.values,
      communicationStyle: input.communicationStyle ?? existing.communicationStyle,
      bio: input.bio ?? existing.bio,
      location: input.location ?? existing.location,
    };

    const needsPersonaUpdate =
      input.values !== undefined || input.communicationStyle !== undefined;

    const updates: Partial<Profile> = {
      ...input,
      agentPersona: needsPersonaUpdate
        ? this.generateAgentPersona(merged)
        : undefined,
    };

    this.repo.update(id, updates);
    return this.repo.findById(id)!;
  }

  private generateAgentPersona(input: {
    name: string;
    age: number;
    gender: Gender;
    location: string;
    occupation?: string;
    values: UserValues;
    communicationStyle: CommunicationStyle;
    bio?: string;
  }): string {
    const occupationStr = input.occupation ? `, 직업: ${input.occupation}` : "";
    const bioStr = input.bio ? `\n자기소개: ${input.bio}` : "";

    return (
      `당신은 "Another I"로, ${input.name}님을 대신하는 AI 에이전트입니다.\n` +
      `기본정보: ${input.age}세 ${input.gender}, ${input.location} 거주${occupationStr}\n` +
      `대화 톤: ${input.communicationStyle.tone}\n` +
      `중요 가치관: ${input.values.importantValues.join(", ")}\n` +
      `관계 목표: ${input.values.relationshipGoal}\n` +
      `라이프스타일: ${input.values.lifestyle.join(", ")}\n` +
      `선호 대화 주제: ${input.communicationStyle.topics.join(", ")}` +
      bioStr +
      `\n\n규칙:\n` +
      `- 실제 전화번호, 주소, 직장 상세정보, 금융정보를 절대 공유하지 마세요\n` +
      `- 페르소나에 충실하되 개인 안전을 보호하세요\n` +
      `- 자연스럽고 진정성 있는 대화를 나누세요\n` +
      `- 상대방의 관심사와 가치관에 관해 질문하세요`
    );
  }
}
