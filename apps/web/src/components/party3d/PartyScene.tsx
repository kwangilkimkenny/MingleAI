"use client";

import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei";
import * as THREE from "three";
import PartyVenue, { Table } from "./PartyVenue";
import Character from "./Character";
import type { PartyState, ConversationEvent } from "@/hooks/usePartySocket";

interface PartySceneProps {
  partyState: PartyState | null;
  conversations: ConversationEvent[];
  onReady?: () => void;
}

// 카메라 컨트롤러
function CameraController({
  focusPosition,
  autoRotate,
}: {
  focusPosition?: THREE.Vector3;
  autoRotate: boolean;
}) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 2, 0));
  const cameraAngle = useRef(0);

  useFrame((state, delta) => {
    if (focusPosition) {
      targetRef.current.lerp(focusPosition, 0.02);
    } else {
      targetRef.current.lerp(new THREE.Vector3(0, 1, 0), 0.02);
    }

    if (autoRotate && !focusPosition) {
      cameraAngle.current += delta * 0.1;
      const radius = 12;
      const x = Math.sin(cameraAngle.current) * radius;
      const z = Math.cos(cameraAngle.current) * radius;
      camera.position.lerp(new THREE.Vector3(x, 6, z), 0.02);
    }

    camera.lookAt(targetRef.current);
  });

  return null;
}

// 3D 씬 컨텐츠
function SceneContent({
  partyState,
  conversations,
}: {
  partyState: PartyState | null;
  conversations: ConversationEvent[];
}) {
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // 현재 대화 중인 참가자 포커스
  useEffect(() => {
    if (conversations.length > 0) {
      const lastConv = conversations[conversations.length - 1];
      setFocusedParticipant(lastConv.speaker.profileId);
      setAutoRotate(false);

      // 3초 후 자동 회전 재개
      const timer = setTimeout(() => {
        setAutoRotate(true);
        setFocusedParticipant(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [conversations]);

  // 포커스 위치 계산
  const focusPosition = focusedParticipant && partyState
    ? (() => {
        const p = partyState.participants.find(
          (p) => p.profileId === focusedParticipant
        );
        return p ? new THREE.Vector3(p.position.x, 1.5, p.position.z) : undefined;
      })()
    : undefined;

  return (
    <>
      {/* 카메라 */}
      <PerspectiveCamera makeDefault position={[0, 8, 12]} fov={50} />
      <CameraController focusPosition={focusPosition} autoRotate={autoRotate} />

      {/* 파티 공간 */}
      <PartyVenue theme="lounge" />

      {/* 테이블 */}
      {partyState?.tables.map((table) => (
        <Table
          key={table.tableId}
          position={[table.position.x, table.position.y, table.position.z]}
        />
      ))}

      {/* 캐릭터들 */}
      {partyState?.participants.map((participant) => (
        <Character
          key={participant.profileId}
          participant={participant}
          isActive={focusedParticipant === participant.profileId}
        />
      ))}

      {/* 마우스 컨트롤 */}
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={20}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 1, 0]}
      />
    </>
  );
}

// 로딩 표시
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#888" wireframe />
    </mesh>
  );
}

// 메인 컴포넌트
export default function PartyScene({
  partyState,
  conversations,
  onReady,
}: PartySceneProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: "linear-gradient(to bottom, #1a1a2e, #16213e)" }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <SceneContent partyState={partyState} conversations={conversations} />
        </Suspense>
      </Canvas>
    </div>
  );
}
