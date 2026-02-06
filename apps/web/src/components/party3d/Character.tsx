"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import type { ParticipantState } from "@/hooks/usePartySocket";

interface CharacterProps {
  participant: ParticipantState;
  isActive?: boolean;
}

// 심플한 캐릭터 색상
const AVATAR_COLORS = [
  "#FF6B6B", // 빨강
  "#4ECDC4", // 청록
  "#45B7D1", // 하늘
  "#96CEB4", // 민트
  "#FFEAA7", // 노랑
  "#DDA0DD", // 보라
  "#98D8C8", // 연두
  "#F7DC6F", // 금색
  "#BB8FCE", // 라벤더
  "#85C1E9", // 파랑
];

// 캐릭터 얼굴 표정
function CharacterFace({
  isTalking,
  emotion,
}: {
  isTalking: boolean;
  emotion?: string;
}) {
  const mouthRef = useRef<THREE.Mesh>(null);

  // 입 애니메이션
  useFrame((state) => {
    if (mouthRef.current && isTalking) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 15) * 0.3;
      mouthRef.current.scale.y = scale;
    }
  });

  return (
    <group position={[0, 0.15, 0.25]}>
      {/* 눈 */}
      <mesh position={[-0.08, 0.05, 0]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.08, 0.05, 0]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* 눈동자 */}
      <mesh position={[-0.08, 0.05, 0.02]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0.08, 0.05, 0.02]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      {/* 입 */}
      <mesh ref={mouthRef} position={[0, -0.05, 0]}>
        <sphereGeometry args={[isTalking ? 0.04 : 0.02, 16, 16]} />
        <meshStandardMaterial color={isTalking ? "#ff6b6b" : "#333"} />
      </mesh>

      {/* 볼 (행복할 때) */}
      {(emotion === "happy" || emotion === "excited") && (
        <>
          <mesh position={[-0.12, -0.02, 0.01]}>
            <circleGeometry args={[0.02, 16]} />
            <meshStandardMaterial color="#ffb6c1" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.12, -0.02, 0.01]}>
            <circleGeometry args={[0.02, 16]} />
            <meshStandardMaterial color="#ffb6c1" transparent opacity={0.6} />
          </mesh>
        </>
      )}
    </group>
  );
}

// 말풍선
function SpeechBubble({ message }: { message: string }) {
  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <Html
        center
        distanceFactor={8}
        style={{
          pointerEvents: "none",
          transform: "translateY(-60px)",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "8px 12px",
            borderRadius: "12px",
            maxWidth: "200px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: "12px",
            lineHeight: 1.4,
            color: "#333",
            textAlign: "center",
            position: "relative",
          }}
        >
          {message}
          <div
            style={{
              position: "absolute",
              bottom: "-8px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid white",
            }}
          />
        </div>
      </Html>
    </Billboard>
  );
}

// 이름표
function NameTag({ name }: { name: string }) {
  return (
    <Billboard follow>
      <Text
        position={[0, 1.8, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {name}
      </Text>
    </Billboard>
  );
}

// 캐릭터 몸체
function CharacterBody({ color, animation }: { color: string; animation: string }) {
  const bodyRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Mesh>(null);
  const armRRef = useRef<THREE.Mesh>(null);
  const legLRef = useRef<THREE.Mesh>(null);
  const legRRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (animation === "walking") {
      // 걷기 애니메이션
      if (armLRef.current) armLRef.current.rotation.x = Math.sin(t * 8) * 0.5;
      if (armRRef.current) armRRef.current.rotation.x = Math.sin(t * 8 + Math.PI) * 0.5;
      if (legLRef.current) legLRef.current.rotation.x = Math.sin(t * 8 + Math.PI) * 0.4;
      if (legRRef.current) legRRef.current.rotation.x = Math.sin(t * 8) * 0.4;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 8)) * 0.05;
    } else if (animation === "talking") {
      // 대화 애니메이션 (살짝 움직임)
      if (bodyRef.current) {
        bodyRef.current.rotation.y = Math.sin(t * 2) * 0.1;
        bodyRef.current.position.y = Math.sin(t * 3) * 0.02;
      }
    } else if (animation === "waving") {
      // 손 흔들기
      if (armRRef.current) {
        armRRef.current.rotation.z = -Math.PI / 4 + Math.sin(t * 8) * 0.3;
        armRRef.current.rotation.x = Math.PI / 4;
      }
    } else {
      // Idle - 미세한 호흡
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.sin(t * 2) * 0.01;
      }
      if (armLRef.current) armLRef.current.rotation.x = 0;
      if (armRRef.current) armRRef.current.rotation.x = 0;
    }
  });

  return (
    <group ref={bodyRef}>
      {/* 몸통 */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* 팔 */}
      <mesh ref={armLRef} position={[-0.3, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.3, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={armRRef} position={[0.3, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.3, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* 다리 */}
      <mesh ref={legLRef} position={[-0.1, 0.2, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.25, 8, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh ref={legRRef} position={[0.1, 0.2, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.25, 8, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

// 메인 캐릭터 컴포넌트
export default function Character({ participant, isActive }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPosition = useRef(new THREE.Vector3());

  // 프로필 ID 기반 색상 선택
  const color = useMemo(() => {
    const hash = participant.profileId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }, [participant.profileId]);

  // 위치 보간
  useEffect(() => {
    targetPosition.current.set(
      participant.position.x,
      participant.position.y,
      participant.position.z
    );
  }, [participant.position]);

  useFrame(() => {
    if (groupRef.current) {
      // 부드러운 위치 이동
      groupRef.current.position.lerp(targetPosition.current, 0.05);
      // 회전
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        participant.rotation,
        0.1
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={[participant.position.x, participant.position.y, participant.position.z]}
      rotation={[0, participant.rotation, 0]}
    >
      {/* 머리 */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* 얼굴 */}
      <CharacterFace isTalking={participant.isTalking} />

      {/* 몸체 */}
      <CharacterBody color={color} animation={participant.animation} />

      {/* 이름표 */}
      <NameTag name={participant.name} />

      {/* 말풍선 */}
      {participant.isTalking && participant.currentMessage && (
        <SpeechBubble message={participant.currentMessage} />
      )}

      {/* 활성 표시 (하이라이트) */}
      {isActive && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#ff69b4" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
