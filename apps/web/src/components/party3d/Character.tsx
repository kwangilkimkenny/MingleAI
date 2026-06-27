"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { ParticipantState } from "@/hooks/usePartySocket";

// ─── 팔레트 ──────────────────────────────────────────────────────────────────

const SKIN_COLORS = ["#f7c59f", "#d4a47a", "#c68642", "#8d5524", "#ffdbac", "#e8b89a"];
const SHIRT_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f97316",
  "#a855f7", "#22c55e", "#3b82f6", "#ef4444",
];

function colorFromId(id: string, palette: string[]): string {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[h % palette.length];
}

// ─── 말풍선 ──────────────────────────────────────────────────────────────────

function SpeechBubble({ message }: { message: string }) {
  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <Html center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div
          style={{
            background: "rgba(8,8,24,0.92)",
            padding: "8px 12px",
            borderRadius: "12px",
            maxWidth: "190px",
            boxShadow: "0 0 0 1px rgba(167,139,250,0.35), 0 8px 24px rgba(0,0,0,0.5)",
            fontSize: "12px",
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.88)",
            textAlign: "center",
            position: "relative",
            backdropFilter: "blur(12px)",
            transform: "translateY(-64px)",
          }}
        >
          {message}
          <div
            style={{
              position: "absolute",
              bottom: "-7px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "7px solid rgba(8,8,24,0.92)",
            }}
          />
        </div>
      </Html>
    </Billboard>
  );
}

// ─── 이름표 ──────────────────────────────────────────────────────────────────

function NameTag({ name, color }: { name: string; color: string }) {
  return (
    <Billboard follow>
      <Text
        position={[0, 2.05, 0]}
        fontSize={0.14}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor={color}
        outlineOpacity={0.8}
      >
        {name}
      </Text>
    </Billboard>
  );
}

// ─── 아이스브레이커 반짝이 링 ─────────────────────────────────────────────────

function ActiveRing({ isActive, color }: { isActive: boolean; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.elapsedTime;
      const opacity = isActive ? 0.4 + Math.sin(t * 4) * 0.25 : 0;
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      if (isActive) {
        ringRef.current.rotation.z = t * 1.5;
      }
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={[0, 0.015, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.45, 0.58, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── 얼굴 ────────────────────────────────────────────────────────────────────

function Face({ isTalking, emotion }: { isTalking: boolean; emotion?: string }) {
  const mouthRef = useRef<THREE.Mesh>(null);
  const eyeLBlinkRef = useRef<THREE.Mesh>(null);
  const eyeRBlinkRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // 입 애니메이션
    if (mouthRef.current) {
      if (isTalking) {
        mouthRef.current.scale.y = 0.8 + Math.abs(Math.sin(t * 14)) * 0.6;
        mouthRef.current.scale.x = 0.9 + Math.abs(Math.sin(t * 10)) * 0.2;
      } else {
        mouthRef.current.scale.set(1, 1, 1);
      }
    }

    // 눈 깜빡임 (4초마다 한 번씩)
    const blinkPhase = (t % 4) / 4;
    const blink = blinkPhase > 0.95 ? Math.sin((blinkPhase - 0.95) * Math.PI / 0.05) : 0;
    const blinkScaleY = 1 - blink * 0.9;
    if (eyeLBlinkRef.current) eyeLBlinkRef.current.scale.y = blinkScaleY;
    if (eyeRBlinkRef.current) eyeRBlinkRef.current.scale.y = blinkScaleY;
  });

  const isHappy = emotion === "happy" || emotion === "excited";

  return (
    <group>
      {/* 왼쪽 눈 */}
      <group position={[-0.09, 0.06, 0.19]}>
        <mesh ref={eyeLBlinkRef}>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
        {/* 눈 흰색 하이라이트 */}
        <mesh position={[0.012, 0.012, 0.03]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* 오른쪽 눈 */}
      <group position={[0.09, 0.06, 0.19]}>
        <mesh ref={eyeRBlinkRef}>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
        <mesh position={[0.012, 0.012, 0.03]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* 입 */}
      <mesh ref={mouthRef} position={[0, -0.055, 0.2]}>
        <sphereGeometry args={[isTalking ? 0.038 : 0.022, 16, 8]} />
        <meshStandardMaterial color={isTalking ? "#ff6b8a" : "#1a1a2e"} />
      </mesh>

      {/* 볼 터치 (행복) */}
      {isHappy && (
        <>
          <mesh position={[-0.13, -0.02, 0.17]} rotation={[0, 0.3, 0]}>
            <circleGeometry args={[0.028, 16]} />
            <meshStandardMaterial color="#ffb3c6" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0.13, -0.02, 0.17]} rotation={[0, -0.3, 0]}>
            <circleGeometry args={[0.028, 16]} />
            <meshStandardMaterial color="#ffb3c6" transparent opacity={0.55} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ─── 몸통 ────────────────────────────────────────────────────────────────────

function Body({
  skinColor,
  shirtColor,
  animation,
}: {
  skinColor: string;
  shirtColor: string;
  animation: string;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Mesh>(null);
  const legLRef = useRef<THREE.Mesh>(null);
  const legRRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (animation === "walking") {
      if (armLRef.current) armLRef.current.rotation.x = Math.sin(t * 8) * 0.55;
      if (armRRef.current) armRRef.current.rotation.x = Math.sin(t * 8 + Math.PI) * 0.55;
      if (legLRef.current) legLRef.current.rotation.x = Math.sin(t * 8 + Math.PI) * 0.45;
      if (legRRef.current) legRRef.current.rotation.x = Math.sin(t * 8) * 0.45;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.04;
    } else if (animation === "talking") {
      if (bodyRef.current) {
        bodyRef.current.rotation.y = Math.sin(t * 2.5) * 0.08;
        bodyRef.current.position.y = Math.sin(t * 3.5) * 0.015;
      }
    } else if (animation === "waving") {
      if (armRRef.current) {
        armRRef.current.rotation.z = -(Math.PI / 4) + Math.sin(t * 9) * 0.35;
        armRRef.current.rotation.x = Math.PI / 5;
      }
    } else {
      // idle: 미세한 호흡
      if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 1.8) * 0.008;
      if (armLRef.current) armLRef.current.rotation.x = 0;
      if (armRRef.current) {
        armRRef.current.rotation.x = 0;
        armRRef.current.rotation.z = 0;
      }
      if (legLRef.current) legLRef.current.rotation.x = 0;
      if (legRRef.current) legRRef.current.rotation.x = 0;
    }
  });

  const pantsColor = "#1e293b";

  return (
    <group ref={bodyRef}>
      {/* 셔츠 몸통 */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.46, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} metalness={0.05} />
      </mesh>

      {/* 목 */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>

      {/* 왼팔 */}
      <mesh ref={armLRef} position={[-0.32, 0.8, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.32, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      {/* 왼손 */}
      <mesh position={[-0.32, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>

      {/* 오른팔 */}
      <mesh ref={armRRef} position={[0.32, 0.8, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.32, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      {/* 오른손 */}
      <mesh position={[0.32, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>

      {/* 바지 왼다리 */}
      <mesh ref={legLRef} position={[-0.1, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.075, 0.28, 8, 16]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>
      {/* 왼발 */}
      <mesh position={[-0.1, 0.06, 0.04]} castShadow>
        <boxGeometry args={[0.12, 0.06, 0.18]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.9} />
      </mesh>

      {/* 바지 오른다리 */}
      <mesh ref={legRRef} position={[0.1, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.075, 0.28, 8, 16]} />
        <meshStandardMaterial color={pantsColor} roughness={0.8} />
      </mesh>
      {/* 오른발 */}
      <mesh position={[0.1, 0.06, 0.04]} castShadow>
        <boxGeometry args={[0.12, 0.06, 0.18]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── 메인 캐릭터 ─────────────────────────────────────────────────────────────

interface CharacterProps {
  participant: ParticipantState;
  isActive?: boolean;
}

export default function Character({ participant, isActive = false }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3());

  const { skinColor, shirtColor } = useMemo(() => ({
    skinColor: colorFromId(participant.profileId, SKIN_COLORS),
    shirtColor: colorFromId(participant.profileId + "_shirt", SHIRT_COLORS),
  }), [participant.profileId]);

  // 위치 업데이트
  targetPos.current.set(
    participant.position.x,
    participant.position.y,
    participant.position.z,
  );

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, 0.06);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      participant.rotation,
      0.12,
    );
  });

  // 마지막 감정 추출
  const lastEmotion = participant.currentMessage ? "talking" : undefined;

  return (
    <group
      ref={groupRef}
      position={[participant.position.x, participant.position.y, participant.position.z]}
      rotation={[0, participant.rotation, 0]}
    >
      {/* 활성 반짝이 링 */}
      <ActiveRing isActive={isActive} color={shirtColor} />

      {/* 머리 */}
      <group position={[0, 1.22, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.22, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.75} />
        </mesh>

        {/* 얼굴 */}
        <Face isTalking={participant.isTalking} emotion={lastEmotion} />

        {/* 머리카락 */}
        <mesh position={[0, 0.16, -0.02]} castShadow>
          <sphereGeometry args={[0.215, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial
            color={colorFromId(participant.profileId + "_hair", [
              "#1a0a00", "#3b1f00", "#5c3317", "#7a4419",
              "#f5e6c8", "#2c1a0e", "#111111", "#6b3a2a",
            ])}
            roughness={0.9}
          />
        </mesh>
      </group>

      {/* 몸 */}
      <Body
        skinColor={skinColor}
        shirtColor={shirtColor}
        animation={participant.animation}
      />

      {/* 이름표 */}
      <NameTag name={participant.name} color={shirtColor} />

      {/* 말풍선 */}
      {participant.isTalking && participant.currentMessage && (
        <SpeechBubble message={participant.currentMessage} />
      )}
    </group>
  );
}
