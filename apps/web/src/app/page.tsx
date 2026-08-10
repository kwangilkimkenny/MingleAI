"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth";
import styles from "./page.module.css";

/**
 * 공개 랜딩 페이지.
 *
 * ⚠️ 여기 적는 것은 전부 **지금 동작하는 기능**이어야 한다. 2026-08-07 감사 시점에 이 페이지는
 * 삭제된 v1 기능(AI 에이전트가 대신 대화 / 가상 소셜 파티 / AI 호환성 리포트)을 광고하고 있었고,
 * 로그인 후에는 존재하지 않는 `/dashboard`로 보냈다. 기능을 지우면 이 문구도 같이 지운다.
 *
 * 디자인: 에디토리얼 종이 톤(2026-08-10 재작성, MUI 제거). 스타일은 `page.module.css`,
 * 팔레트 근거는 그 파일 상단 주석 참고. 스토어 배지는 앱 심사 전이라 **비활성 자리표시자**다 —
 * 링크가 나오면 `STORE_LINKS`만 채우면 활성화된다.
 */

const STORE_LINKS: { google: string | null; apple: string | null } = {
  google: null, // Play Console 등록 후 채운다
  apple: null, // App Store Connect 등록 후 채운다
};

/** 스테이지 = 앱의 실제 진행 순서(shared `stageReveal`)와 같아야 한다. */
const STAGES = [
  {
    badge: "01 · 1라운드",
    name: "가면 대화",
    desc: "목소리는 변조되고 캐릭터로 만납니다. 얼굴도 실제 목소리도 아직 없습니다.",
  },
  {
    badge: "02 · 2라운드",
    name: "목소리 공개",
    desc: "변조가 풀립니다. 진짜 목소리로 이야기하지만 얼굴은 아직 가려져 있습니다.",
  },
  {
    badge: "03 · 3라운드",
    name: "얼굴 공개",
    desc: "카메라가 켜집니다. 대화가 쌓인 다음에야 얼굴을 봅니다.",
  },
];

const SAFETY = [
  {
    title: "본인인증한 성인만",
    body: "휴대폰 본인확인을 마쳐야 참여할 수 있습니다. 나이는 체크박스가 아니라 인증이 보장합니다.",
  },
  {
    title: "한 사람당 한 계정",
    body: "본인확인 정보로 중복 가입을 막습니다. 차단당한 사람이 새 계정으로 돌아오지 못합니다.",
  },
  {
    title: "언제든 신고·차단",
    body: "대화 중에도, 매칭 후에도 신고하고 차단할 수 있습니다. 차단하면 양방향으로 사라집니다.",
  },
  {
    title: "영상은 저장하지 않음",
    body: "얼굴 공개 라운드의 음성·영상은 실시간으로만 흐르고 서버에 녹화되지 않습니다.",
  },
];

/** 6인 좌석 배치 — 남3·여3이 번갈아 앉는다(앱의 성별 인지 매칭과 같은 구성). */
const SEATS = [0, 60, 120, 180, 240, 300];

export default function Home() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 로그인 상태면 프로필로. (v1의 /dashboard는 제거됐다 — 여기로 보내면 404다.)
    if (token) router.replace("/profile");
  }, [token, router]);

  // 스크롤 등장 + 히어로 패럴랙스. 라이브러리 없이 IntersectionObserver + CSS 변수로 처리한다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = root.querySelectorAll(`.${styles.reveal}`);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add(styles.revealed);
          io.unobserve(e.target); // 한 번 나타나면 끝 — 스크롤 되감기에 깜빡이지 않는다.
        }
      },
      { threshold: 0.18 },
    );
    targets.forEach((t) => io.observe(t));

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // 0→1로 정규화한 히어로 진행도. CSS가 이 값으로 컷아웃을 민다.
        const p = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
        root.style.setProperty("--p", String(p));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (token) return null;

  return (
    <div className={styles.page} ref={rootRef}>
      <nav className={styles.nav}>
        <span className={styles.wordmark}>mingles</span>
        <div className={styles.navLinks}>
          <a href="#how">진행 방식</a>
          <a href="#safety">안전</a>
          <button
            type="button"
            className={`${styles.pillGhost} ${styles.pillSmall}`}
            onClick={() => router.push("/login")}
          >
            로그인
          </button>
        </div>
      </nav>

      <header className={styles.hero}>
        <Image
          className={`${styles.heroFigure} ${styles.heroFigureLeft}`}
          src="/renaissance-man-cutout.png"
          alt=""
          aria-hidden
          width={380}
          height={520}
          priority
        />
        <Image
          className={`${styles.heroFigure} ${styles.heroFigureRight}`}
          src="/renaissance-woman-cutout.png"
          alt=""
          aria-hidden
          width={380}
          height={520}
          priority
        />
        <div>
          <p className={styles.eyebrow}>로테이션 블라인드 소개팅</p>
          <h1 className={styles.heroTitle}>
            한자리에서 여러 사람과,
            <br />
            <em>얼굴보다 대화로 먼저</em>
          </h1>
          <p className={styles.heroSub}>
            남녀 세 명씩 모이면 한 자리가 열립니다. 돌아가며 이야기하고, 마음이 가는 한 사람을
            비공개로 고릅니다.
          </p>
          <div className={styles.heroCtas}>
            <a
              className={`${styles.pill} ${STORE_LINKS.google ? "" : styles.pillDisabled}`}
              href={STORE_LINKS.google ?? "#"}
              aria-disabled={!STORE_LINKS.google}
            >
              Google Play
            </a>
            <a
              className={`${styles.pillGhost} ${STORE_LINKS.apple ? "" : styles.pillDisabled}`}
              href={STORE_LINKS.apple ?? "#"}
              aria-disabled={!STORE_LINKS.apple}
            >
              App Store
            </a>
          </div>
          <p className={styles.storeNote}>출시 준비 중입니다. 스토어 링크는 공개되면 열립니다.</p>
        </div>
      </header>

      <section className={styles.section} id="how">
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <h2 className={styles.sectionTitle}>세 번에 걸쳐 조금씩 열립니다</h2>
          <p className={styles.sectionLead}>
            처음부터 얼굴을 보지 않습니다. 목소리도 처음엔 변조됩니다. 대화가 먼저 쌓이도록
            순서를 정해두었습니다.
          </p>
        </div>

        <div className={`${styles.stageWrap} ${styles.reveal}`}>
          <div className={styles.stages}>
            {STAGES.map((s) => (
              <div className={styles.stage} key={s.name}>
                <span className={styles.stageIndex}>{s.badge}</span>
                <h3 className={styles.stageName}>{s.name}</h3>
                <p className={styles.stageDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={styles.section}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <h2 className={styles.sectionTitle}>여섯 명이 모이면 한 자리</h2>
            <p className={styles.sectionLead}>
              남성 셋, 여성 셋. 한 라운드가 끝나면 자리를 옮겨 다음 사람과 이야기합니다. 아홉 번의
              대화가 한 자리 안에서 일어납니다.
            </p>
          </div>
          <div className={`${styles.circle} ${styles.reveal}`}>
            <div className={styles.circleRing}>
              {SEATS.map((a, i) => (
                <div
                  key={a}
                  className={`${styles.seat} ${i % 2 ? styles.seatF : ""}`}
                  // 좌석 좌표는 각도에서 직접 계산한다. CSS translate()의 %는 컨테이너가 아니라
                  // **자기 크기** 기준이라 반지름을 %로 줄 수 없다(원이 가운데로 뭉친다).
                  style={{
                    left: `${50 + 40 * Math.cos((a - 90) * (Math.PI / 180))}%`,
                    top: `${50 + 40 * Math.sin((a - 90) * (Math.PI / 180))}%`,
                    transitionDelay: `${i * 90}ms`,
                  }}
                >
                  {i % 2 ? "여" : "남"}
                </div>
              ))}
            </div>
            <div className={styles.circleCenter}>
              <div>
                <strong>9번의 대화</strong>
                <span>3라운드 × 3명</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.sectionHead} ${styles.reveal}`}>
          <h2 className={styles.sectionTitle}>서로 골랐을 때만 이어집니다</h2>
          <p className={styles.sectionLead}>
            마지막에 한 사람을 비공개로 고릅니다. 상대도 나를 골랐을 때만 채팅이 열립니다. 고르지
            않았다는 사실은 누구에게도 알려지지 않습니다.
          </p>
        </div>
        <div className={`${styles.matchRow} ${styles.reveal}`}>
          <div className={`${styles.matchCard} ${styles.matchCardLeft}`}>나의 선택</div>
          <div className={styles.matchHeart} aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 20s-7-4.35-7-9.5A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.5c0 5.15-7 9.5-7 9.5Z" />
            </svg>
          </div>
          <div className={`${styles.matchCard} ${styles.matchCardRight}`}>상대의 선택</div>
        </div>
      </section>

      <section className={styles.band} id="safety">
        <div className={styles.section}>
          <div className={`${styles.sectionHead} ${styles.reveal}`}>
            <h2 className={styles.sectionTitle}>안전하게 만나기 위한 장치</h2>
          </div>
          <div className={`${styles.safety} ${styles.reveal}`}>
            {SAFETY.map((s) => (
              <div className={styles.safetyItem} key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.closing} ${styles.reveal}`}>
        <h2 className={styles.sectionTitle}>얼굴보다 대화가 먼저인 소개팅</h2>
        <p className={styles.sectionLead}>
          소개팅은 mingles 앱에서 진행됩니다. 웹에서는 프로필·데이트 계획·알림을 볼 수 있습니다.
        </p>
        <div className={styles.heroCtas} style={{ marginTop: 28 }}>
          <button type="button" className={styles.pill} onClick={() => router.push("/login")}>
            웹으로 로그인
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} mingles</span>
        <span>
          <a href="/terms">이용약관</a>
          <a href="/privacy">개인정보처리방침</a>
          <a href="/account-deletion">회원탈퇴 안내</a>
        </span>
      </footer>
    </div>
  );
}
