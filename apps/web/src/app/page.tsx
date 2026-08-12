"use client";

import { type ReactNode, useEffect, useRef } from "react";
import {
  animate,
  createTimeline,
  stagger,
  steps,
  svg as animeSvg,
  type JSAnimation,
  type Timeline,
} from "animejs";
import Image from "next/image";
import styles from "./page.module.css";

/**
 * 공개 랜딩 페이지.
 *
 * ⚠️ 여기 적는 것은 전부 **지금 동작하는 기능**이어야 한다. 2026-08-07 감사 시점에 이 페이지는
 * 삭제된 v1 기능(AI 에이전트가 대신 대화 / 가상 소셜 파티 / AI 호환성 리포트)을 광고하고 있었고,
 * 로그인 후에는 존재하지 않는 `/dashboard`로 보냈다. 기능을 지우면 이 문구도 같이 지운다.
 *
 * 디자인: 에디토리얼 종이 톤(2026-08-10 재작성, MUI 제거). 스타일은 `page.module.css`,
 * 팔레트 근거는 그 파일 상단 주석 참고. 스토어 배지는 앱 심사 전이라 **비활성 자리표시자**다.
 * App Store Connect/Play Console 상품이 생기면 배포 환경변수만 등록해 활성화한다.
 */

const STORE_LINKS: { google: string | null; apple: string | null } = {
  google: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
  apple: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
};

function StoreButton({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) {
    return (
      <span className={styles.downloadButton} role="link" aria-disabled="true">
        {children} · 준비 중
      </span>
    );
  }

  return (
    <a className={styles.downloadButton} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function IPhoneFrame({
  label,
  children,
  interactive = false,
}: {
  label: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  return (
    <div className={styles.iphone} role={interactive ? "group" : "img"} aria-label={label}>
      <div className={styles.iphoneSpeaker} aria-hidden />
      <div className={styles.iphoneScreen}>{children}</div>
    </div>
  );
}

function RotationPreview() {
  return (
    <div className={styles.rotationPreview}>
      <div className={styles.previewTopbar}>
        <span className={styles.liveBadge}>LIVE</span>
        <span className={styles.previewTimer}>00:58</span>
      </div>
      <div className={styles.callStage}>
        <Image
          className={styles.callPortrait}
          src="/renaissance-woman-cutout.png"
          alt=""
          aria-hidden
          width={300}
          height={410}
        />
        <span className={styles.voiceBadge}>VOICE FIRST</span>
      </div>
      <div className={styles.questionCard}>
        <span>오늘 가장 웃겼던 순간은?</span>
        <small>추천 대화 주제</small>
      </div>
      <div className={styles.previewIdentity}>
        <strong>서연</strong>
        <span>음성 보호 중 · ROUND 2</span>
      </div>
      <div className={styles.previewControls} aria-hidden>
        <span>MIC</span>
        <span>CAM</span>
        <span>SAFE</span>
      </div>
    </div>
  );
}

function DatePlanPreview() {
  return (
    <div className={styles.planPreview}>
      <div className={styles.planHeader}>
        <span>‹</span>
        <strong>데이트 플랜</strong>
        <span className={styles.planStatus}>제안 중</span>
      </div>
      <p className={styles.planLead}>마음에 드는 코스를 선택하세요.</p>
      <div className={`${styles.courseCard} ${styles.courseCardActive}`}>
        <span className={styles.courseNumber}>01</span>
        <strong>성수 카페 → 서울숲 산책</strong>
        <small>대화하기 좋은 2시간 코스</small>
        <span className={styles.courseAction}>이 코스로 선택</span>
      </div>
      <div className={styles.courseCard}>
        <span className={styles.courseNumber}>02</span>
        <strong>전시 관람 → 와인바</strong>
        <small>천천히 취향을 나누는 코스</small>
      </div>
      <div className={styles.planTimeline}>
        <span className={styles.timelineDot} />
        <div>
          <strong>상대의 확정을 기다리는 중</strong>
          <small>확정되면 채팅으로 알려드려요.</small>
        </div>
      </div>
    </div>
  );
}

function DownloadPreview() {
  return (
    <div className={styles.downloadPreview}>
      <span className={styles.downloadKicker}>MINGLES</span>
      <div className={styles.appIcon}>
        <Image
          className={styles.appLogo}
          src="/mingles-app-icon.png"
          alt="Mingles"
          width={1024}
          height={1024}
          priority
        />
      </div>
      <div className={styles.downloadMessage}>
        <strong>이제, 대화를 시작하세요.</strong>
        <span>BLIND ROTATION MEETING</span>
      </div>
      <div className={styles.downloadButtons}>
        <StoreButton href={STORE_LINKS.apple}>iOS</StoreButton>
        <StoreButton href={STORE_LINKS.google}>Android</StoreButton>
      </div>
    </div>
  );
}

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const brandLetters = "MINGLES".split("");

  // 로그인 상태를 보고 어디론가 보내지 않는다. 웹에는 소비자 홈이 없고(2026-08-12 소비자 화면
  // 삭제) 관리자는 /login으로 직접 들어온다 — 예전 `/profile` 리다이렉트는 이제 404였다.

  // 히어로 패럴랙스 + 두 번째 섹션의 캐릭터 분리/컬러 전환을 스크롤 진행도로 제어한다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const showcase = root.querySelector<HTMLElement>(`.${styles.showcase}`);
    const featureThree = root.querySelector<HTMLElement>(`.${styles.featureThree}`);
    const featureFour = root.querySelector<HTMLElement>(`.${styles.featureFour}`);
    const brand = root.querySelector<HTMLElement>(`.${styles.brand}`);
    const brandWord = root.querySelector<HTMLElement>(`.${styles.brandWord}`);
    const brandLight = root.querySelector<HTMLElement>(`.${styles.brandLight}`);
    const letters = root.querySelectorAll<HTMLElement>(`.${styles.brandLetter}`);
    const editorialCopy = root.querySelectorAll<HTMLElement>(`.${styles.heroEditorial} p`);
    const flash = root.querySelector<HTMLElement>(`.${styles.heroFlash}`);
    const signalPath = root.querySelector<SVGPathElement>(`.${styles.signalLive}`);
    const signalPulse = root.querySelector<SVGGElement>(`.${styles.signalPulse}`);
    const signalPulseHalo = root.querySelector<SVGCircleElement>(`.${styles.signalPulseHalo}`);
    const signalHeart = root.querySelector<SVGSVGElement>(`.${styles.signalHeart}`);
    const trackRight = root.querySelector<HTMLElement>(`.${styles.trackRight}`);
    const trackLeft = root.querySelector<HTMLElement>(`.${styles.trackLeft}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let lastScrollY = window.scrollY;
    let lastScrollAt = performance.now();
    let previousHeroProgress = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    let tickerEase: JSAnimation | null = null;
    let flashAnimation: JSAnimation | null = null;
    let signalMotion: JSAnimation | null = null;
    let signalDraw: JSAnimation | null = null;
    let signalBeat: JSAnimation | null = null;
    let signalHeartBeat: JSAnimation | null = null;
    let intro: Timeline | null = null;
    const tickers: JSAnimation[] = [];

    // Anime.js가 티커의 루프와 스크롤 속도 반응을 함께 맡는다. CSS 키프레임을 조회해
    // playbackRate를 바꾸던 구조보다 생명주기 정리와 동작 재현이 명확하다.
    if (!reduceMotion.matches && trackRight && trackLeft) {
      tickers.push(
        animate(trackRight, {
          translateX: ["-50%", "0%"],
          duration: 30000,
          ease: "linear",
          loop: true,
        }),
        animate(trackLeft, {
          translateX: ["0%", "-50%"],
          duration: 26000,
          ease: "linear",
          loop: true,
        }),
      );
    }

    // 펄스의 x/y를 별도 퍼센트 수식으로 근사하지 않고 실제 SVG 곡선에 결합한다.
    // 경로가 반응형으로 늘어나도 Anime.js가 현재 CTM을 기준으로 정확한 위치를 계산한다.
    if (!reduceMotion.matches && signalPath && signalPulse) {
      signalMotion = animate(signalPulse, {
        ...animeSvg.createMotionPath(signalPath),
        duration: 1000,
        ease: "linear",
        autoplay: false,
      });
      signalDraw = animate(animeSvg.createDrawable(signalPath), {
        draw: "0 1",
        duration: 1000,
        ease: "linear",
        autoplay: false,
      });
      if (signalPulseHalo) {
        signalBeat = animate(signalPulseHalo, {
          keyframes: [
            { r: 9, opacity: 0.92, duration: 0 },
            { r: 18, opacity: 0, duration: 720, ease: "outExpo" },
            { r: 9, opacity: 0, duration: 180 },
          ],
          loop: true,
        });
      }
      if (signalHeart) {
        signalHeartBeat = animate(signalHeart, {
          keyframes: [
            { scale: 1, duration: 0 },
            { scale: 1.14, duration: 160, ease: "outQuad" },
            { scale: 1, duration: 210, ease: "inOutSine" },
            { scale: 1.08, duration: 130, ease: "outQuad" },
            { scale: 1, duration: 260, ease: "outExpo" },
            { scale: 1, duration: 520 },
          ],
          loop: true,
        });
      }
    }

    const setTickerSpeed = (speed: number) => {
      for (const ticker of tickers) ticker.speed = speed;
    };

    const settleTicker = (from: number) => {
      tickerEase?.cancel();
      const state = { speed: from };
      setTickerSpeed(state.speed);
      tickerEase = animate(state, {
        speed: 1,
        duration: 900,
        ease: "outExpo",
        onUpdate: () => setTickerSpeed(state.speed),
      });
    };

    const settleTickerSpeed = () => {
      if (reduceMotion.matches || root.dataset.tickerLock) return;
      const now = performance.now();
      const scrollY = window.scrollY;
      const elapsed = Math.max(16, now - lastScrollAt);
      const velocity = Math.abs(scrollY - lastScrollY) / elapsed;
      const boostedSpeed = Math.max(tickers[0]?.speed ?? 1, 1 + Math.min(1.5, velocity * 1.8));
      settleTicker(boostedSpeed);
      lastScrollY = scrollY;
      lastScrollAt = now;
    };

    // 왼쪽에서 열리는 워드마크, 빛 번짐, 활자 인쇄, 불규칙 카피를 하나의 Anime.js
    // 타임라인에 묶는다. 가짜 로딩 지연 없이 첫 페인트 직후 바로 시작한다.
    if (!reduceMotion.matches && brand && brandWord && brandLight) {
      root.dataset.heroIntro = "running";
      intro = createTimeline({ autoplay: false })
        .add(
          brand,
          {
            width: ["0%", "100%"],
            duration: 1250,
            ease: "inOutQuart",
          },
          40,
        )
        .add(
          letters,
          {
            "--letter-opacity": [0, 1],
            "--letter-y": ["38%", "0%"],
            "--letter-rotate": ["2deg", "0deg"],
            "--letter-blur": ["8px", "0px"],
            duration: 420,
            delay: stagger(46),
            ease: "outBack(1.35)",
          },
          180,
        )
        .add(
          brandLight,
          {
            keyframes: [
              { translateX: "-140%", opacity: 0, duration: 0 },
              { translateX: "45%", opacity: 1, duration: 340, ease: "outQuad" },
              { translateX: "520%", opacity: 0, duration: 1010, ease: "outExpo" },
            ],
          },
          120,
        )
        .add(
          editorialCopy,
          {
            "--intro-opacity": [0, 1],
            "--intro-y": ["18px", "0px"],
            duration: 620,
            delay: stagger(64, { from: "center" }),
            ease: "outExpo",
          },
          260,
        )
        .add(
          brandWord,
          {
            keyframes: [
              { "--word-x": "3px", "--word-y": "-1px", duration: 45 },
              { "--word-x": "-2px", "--word-y": "1px", duration: 45 },
              { "--word-x": "0px", "--word-y": "0px", duration: 70 },
            ],
            ease: steps(2),
          },
          780,
        )
        .call(() => {
          root.dataset.tickerLock = "true";
          for (const ticker of tickers) ticker.pause();
        }, 1080)
        .call(() => {
          delete root.dataset.tickerLock;
          root.dataset.heroIntro = "complete";
          for (const ticker of tickers) ticker.resume();
        }, 1280);
      intro.play();
    } else {
      root.dataset.heroIntro = "complete";
    }

    const playPrintCut = () => {
      if (!flash) return;
      flashAnimation?.cancel();
      flashAnimation = animate(flash, {
        keyframes: [
          { opacity: 0.9, backgroundColor: "#f2bcc8", duration: 70, ease: steps(1) },
          { opacity: 1, backgroundColor: "#000000", duration: 110, ease: steps(1) },
          { opacity: 0.35, backgroundColor: "#ffffff", duration: 90, ease: steps(1) },
          { opacity: 0, backgroundColor: "transparent", duration: 90, ease: steps(1) },
        ],
      });
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const scrollY = window.scrollY;

        // 0→1로 정규화한 히어로 진행도. 캐릭터와 연결 신호만 스크롤에 반응한다.
        // MINGLES 워드마크는 진입 애니메이션이 끝난 위치를 그대로 유지한다.
        const p = Math.min(1, scrollY / Math.max(1, window.innerHeight));
        root.style.setProperty("--p", String(p));
        const heroIsCompact = window.innerWidth <= 720;
        const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
        const smoothstep = (value: number) => value * value * (3 - 2 * value);
        const identityReveal = reduceMotion.matches
          ? 1
          : smoothstep(clamp01((p - 0.18) / (heroIsCompact ? 0.62 : 0.5)));
        const collision = reduceMotion.matches
          ? 0
          : 1 - Math.abs(clamp01((p - 0.28) / 0.32) * 2 - 1);
        root.style.setProperty("--identity-reveal", identityReveal.toFixed(3));
        root.style.setProperty("--identity-blur", `${((1 - identityReveal) * 4).toFixed(2)}px`);
        root.style.setProperty("--copy-collision", collision.toFixed(3));
        root.dataset.identityStage = identityReveal > 0.78 ? "face" : identityReveal > 0.4 ? "profile" : "voice";

        // 히어로의 인쇄물이 다음 장으로 넘어가는 짧은 2프레임 컷. 역스크롤에는 반복하지 않는다.
        if (!reduceMotion.matches && previousHeroProgress < 0.9 && p >= 0.9) {
          playPrintCut();
        }
        previousHeroProgress = p;
        // 문서 전체 진행도 — 섹션 경계와 무관하게 이어지는 스파인이 이 값으로 그려진다.
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        root.style.setProperty("--s", String(Math.min(1, scrollY / max)));

        if (showcase && featureThree) {
          const rect = featureThree.getBoundingClientRect();
          const showcaseRect = showcase.getBoundingClientRect();
          const start = window.innerHeight * 0.92;
          const end = window.innerHeight * 0.12;
          const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));

          // 히어로와 두 번째 섹션이 같은 Image 두 개를 공유한다. 시작/끝 좌표를 px로
          // 보간해 DOM 교체 없이 위치·크기·채도만 연속적으로 변하게 한다.
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const compact = vw <= 900;
          const mobile = vw < 720;
          // 태블릿 세로: 화면이 길어 캐릭터가 작으면 아래쪽에만 붙어 구도에서 떨어진다.
          const tallPortrait = !mobile && vh > vw * 1.15;
          const mix = (from: number, to: number) => from + (to - from) * progress;
          // 마지막 다운로드 섹션의 sticky 이동량을 별도로 정규화한다.
          const showcaseTravel = Math.max(1, showcaseRect.height - vh);
          const showcaseProgress = clamp01(-showcaseRect.top / showcaseTravel);
          const sceneEntry = smoothstep(clamp01(showcaseProgress / 0.18));
          const reveal = smoothstep(clamp01((showcaseProgress - 0.12) / 0.16));

          const stageProgress = (stage: HTMLElement | null) => {
            if (!stage) return { entry: 0, scroll: 0, rect: null };
            const stageRect = stage.getBoundingClientRect();
            // 콘텐츠가 움직이며 보이지 않도록 섹션 상단이 고정된 뒤에만 페이드인한다.
            const entry = smoothstep(clamp01(-stageRect.top / (vh * 0.18)));
            const travel = Math.max(1, stageRect.height - vh);
            return {
              entry,
              scroll: clamp01(-stageRect.top / travel),
              rect: stageRect,
            };
          };
          const third = stageProgress(featureThree);
          const fourth = stageProgress(featureFour);
          // 첫 기능 패널은 완전히 나타난 뒤 충분히 읽을 수 있도록 섹션의 마지막
          // 14%에서만 퇴장한다. 이전 72% 시작점은 등장 직후 바로 사라지는 인상을 줬다.
          const thirdExit = smoothstep(clamp01((third.scroll - 0.86) / 0.14));
          const fourthExit = smoothstep(clamp01((fourth.scroll - 0.72) / 0.28));
          // 캐릭터가 좌우 목적지에 정착한 후 전기 신호를 채운다. 완충 상태를 잠깐
          // 유지한 다음에야 기기와 설명이 나타나므로 세 장면이 서로 겹치지 않는다.
          const charactersSettled = smoothstep(clamp01((progress - 0.92) / 0.08));
          const signalCharge = reduceMotion.matches
            ? 1
            : smoothstep(clamp01((third.scroll - 0.02) / 0.34));
          const signalExit = reduceMotion.matches
            ? 1
            : smoothstep(clamp01((third.scroll - 0.42) / 0.12));
          const firstFeatureReveal = reduceMotion.matches
            ? third.entry
            : smoothstep(clamp01((third.scroll - 0.42) / 0.14));
          const signalOpacity = reduceMotion.matches ? 0 : charactersSettled * (1 - signalExit);
          root.style.setProperty("--hero-link", signalCharge.toFixed(3));
          root.style.setProperty("--signal-opacity", signalOpacity.toFixed(3));
          root.style.setProperty("--signal-charge", signalCharge.toFixed(3));
          signalMotion?.seek(signalMotion.duration * signalCharge, true);
          signalDraw?.seek(signalDraw.duration * signalCharge, true);
          root.dataset.signalStage =
            signalCharge >= 0.995 ? "charged" : signalOpacity > 0.02 ? "charging" : "idle";
          // 마지막 장면은 다시 페이드아웃하지 않는다. sticky 구간 동안 그대로 유지되고,
          // 섹션 끝에서는 화면 전체가 문서 흐름을 따라 자연스럽게 위로 스크롤된다.
          root.style.setProperty("--showcase-p", reveal.toFixed(3));
          root.style.setProperty("--showcase-scale", "1");
          root.style.setProperty("--home-scene-p", sceneEntry.toFixed(3));
          root.style.setProperty("--home-bg-blur", `${((1 - sceneEntry) * 14).toFixed(2)}px`);
          root.style.setProperty("--home-bg-scale", (1.12 - sceneEntry * 0.12).toFixed(3));
          root.style.setProperty("--home-bg-clip", `${((1 - sceneEntry) * 14).toFixed(2)}%`);
          root.style.setProperty(
            "--feature-three-p",
            (firstFeatureReveal * (1 - thirdExit)).toFixed(3),
          );
          root.style.setProperty("--feature-four-p", (fourth.entry * (1 - fourthExit)).toFixed(3));

          const manStartW = compact ? vw * 0.38 : Math.min(280, Math.max(130, vw * 0.18));
          const womanStartW = compact ? vw * 0.38 : Math.min(250, Math.max(120, vw * 0.16));
          const manEndW = mobile
            ? vw * 0.52
            : tallPortrait
              ? vw * 0.42
              : Math.min(460, Math.max(240, vw * 0.3));
          const womanEndW = manEndW;

          const manStartX = vw - vw * 0.06 - manStartW;
          const womanStartX = compact ? vw - vw * 0.44 - womanStartW : vw - vw * 0.26 - womanStartW;
          // 세로 화면에서는 캐릭터를 더 바깥으로 민다 — 안 그러면 가운데 폰 목업이 얼굴을 덮는다.
          const settledOut = mobile ? 0.16 : tallPortrait ? 0.13 : 0.03;
          const manSettledX = -vw * settledOut;
          const womanSettledX = vw + vw * settledOut - womanEndW;

          const manStartY = vh - manStartW * (1405 / 1024);
          const womanStartY = vh - womanStartW * (1400 / 1024);
          const endBottom = mobile ? vh * 0.02 : -vh * 0.02;
          const manEndY = vh - endBottom - manEndW * (1405 / 1024);
          const womanEndY = vh - endBottom - womanEndW * (1400 / 1024);
          const baseOpacity = compact ? 0.18 : 0.3;
          // 세 번째 기능 화면의 퇴장 구간에서는 기존 캐릭터가 양옆으로 빠진 뒤 사라진다.
          const manX = mix(manStartX, manSettledX) - fourthExit * vw * 0.18;
          const womanX = mix(womanStartX, womanSettledX) + fourthExit * vw * 0.18;
          const heroGray = 1 - progress;
          const manDim = fourth.entry;
          const womanDim = firstFeatureReveal * (1 - fourth.entry);

          root.style.setProperty("--man-x", `${manX.toFixed(2)}px`);
          root.style.setProperty("--man-y", `${mix(manStartY, manEndY).toFixed(2)}px`);
          root.style.setProperty("--man-w", `${mix(manStartW, manEndW).toFixed(2)}px`);
          root.style.setProperty("--woman-x", `${womanX.toFixed(2)}px`);
          root.style.setProperty("--woman-y", `${mix(womanStartY, womanEndY).toFixed(2)}px`);
          root.style.setProperty("--woman-w", `${mix(womanStartW, womanEndW).toFixed(2)}px`);
          root.style.setProperty("--man-gray", Math.max(heroGray, manDim * 0.9).toFixed(3));
          root.style.setProperty("--woman-gray", Math.max(heroGray, womanDim * 0.9).toFixed(3));
          root.style.setProperty("--man-brightness", (1 - manDim * 0.7).toFixed(3));
          root.style.setProperty("--woman-brightness", (1 - womanDim * 0.7).toFixed(3));
          root.style.setProperty(
            "--character-opacity",
            ((baseOpacity + (1 - baseOpacity) * progress) * (1 - fourthExit)).toFixed(3),
          );
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", settleTickerSpeed, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", settleTickerSpeed);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      tickerEase?.cancel();
      flashAnimation?.revert();
      signalMotion?.revert();
      signalDraw?.revert();
      signalBeat?.revert();
      signalHeartBeat?.revert();
      intro?.revert();
      for (const ticker of tickers) ticker.revert();
    };
  }, []);

  return (
    <div className={styles.page} ref={rootRef}>
      <div className={styles.spine} aria-hidden />
      <div className={`${styles.morphFigure} ${styles.morphFigureMan}`} aria-hidden>
        <Image
          className={`${styles.morphCharacter} ${styles.morphCharacterBase}`}
          src="/renaissance-man-cutout.png"
          alt=""
          width={620}
          height={850}
          priority
        />
        <Image
          className={`${styles.morphCharacter} ${styles.morphCharacterEcho}`}
          src="/renaissance-man-cutout.png"
          alt=""
          width={620}
          height={850}
          priority
        />
        <div className={styles.identityMask}>
          <span data-stage="voice">VOICE DISGUISED</span>
          <span data-stage="profile">PROFILE UNLOCKED</span>
          <span data-stage="face">FACE REVEALED</span>
        </div>
      </div>
      <div className={`${styles.morphFigure} ${styles.morphFigureWoman}`} aria-hidden>
        <Image
          className={`${styles.morphCharacter} ${styles.morphCharacterBase}`}
          src="/renaissance-woman-cutout.png"
          alt=""
          width={620}
          height={850}
          priority
        />
        <Image
          className={`${styles.morphCharacter} ${styles.morphCharacterEcho}`}
          src="/renaissance-woman-cutout.png"
          alt=""
          width={620}
          height={850}
          priority
        />
        <div className={styles.identityMask}>
          <span data-stage="voice">VOICE DISGUISED</span>
          <span data-stage="profile">PROFILE UNLOCKED</span>
          <span data-stage="face">FACE REVEALED</span>
        </div>
      </div>
      <div className={styles.heroSignal} aria-hidden>
        <svg viewBox="0 0 1000 170" preserveAspectRatio="none">
          <path
            className={styles.signalRail}
            d="M20 96 C105 78 178 110 250 94 L340 94 L365 88 L382 108 L405 45 L432 142 L458 72 L482 96 L520 96 L542 87 L565 110 L590 50 L616 136 L642 70 L670 96 C760 112 845 76 980 96"
            pathLength="1"
          />
          <path
            className={styles.signalLive}
            d="M20 96 C105 78 178 110 250 94 L340 94 L365 88 L382 108 L405 45 L432 142 L458 72 L482 96 L520 96 L542 87 L565 110 L590 50 L616 136 L642 70 L670 96 C760 112 845 76 980 96"
            pathLength="1"
          />
          <circle className={styles.signalAnchor} cx="20" cy="96" r="6" />
          <circle className={styles.signalAnchor} cx="980" cy="96" r="6" />
          <g className={styles.signalPulse}>
            <circle className={styles.signalPulseHalo} r="15" />
            <circle className={styles.signalPulseCore} r="6" />
          </g>
        </svg>
        <span className={`${styles.signalEndpoint} ${styles.signalEndpointLeft}`}>YOU</span>
        <span className={styles.signalAi}>
          <svg className={styles.signalHeart} viewBox="0 0 32 30" aria-hidden>
            <path d="M16 28S2 19.7 2 10.4C2 5.7 5.5 2 9.9 2c2.7 0 5.1 1.4 6.1 3.6C17 3.4 19.4 2 22.1 2 26.5 2 30 5.7 30 10.4 30 19.7 16 28 16 28Z" />
          </svg>
          <span className={styles.signalAiText}>AI</span>
        </span>
        <span className={`${styles.signalEndpoint} ${styles.signalEndpointRight}`}>MATCH</span>
      </div>
      <div className={styles.heroFlash} aria-hidden />
      {/* 히어로 — 타이틀+설명+버튼 스택이 아니라, 활자 자체가 레이아웃이다.
          세 줄이 좌/우로 엇갈리고 판화 컷아웃이 행 사이에 끼어든다. */}
      {/* 히어로 — 워드마크가 곧 헤드라인이다. 별도 헤더 바 없음.
          워드마크 라인을 따라 핑크 텍스트가 한 방향으로 계속 흘러간다. */}
      <header className={styles.hero}>
        {/* 워드마크가 화면 폭을 채운다. 같은 영문 문구가 위·아래에서
            서로 반대 방향으로 흐르며 워드마크를 감싼다. */}
        <div className={styles.brandBlock}>
          <div className={`${styles.ticker} ${styles.tickerTop}`} aria-hidden>
            <div className={styles.trackRight}>
              {[0, 1].map((dup) => (
                <span className={styles.tickerSet} key={dup}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span className={styles.tickerItem} key={i}>
                      BLIND ROTATION MEETING
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>

          <h1 className={styles.brand} aria-label="MINGLES">
            <span className={styles.brandLight} aria-hidden />
            <span className={`${styles.brandEcho} ${styles.brandEchoBack}`} aria-hidden>
              MINGLES
            </span>
            <span className={`${styles.brandEcho} ${styles.brandEchoFront}`} aria-hidden>
              MINGLES
            </span>
            <span className={styles.brandWord} aria-hidden>
              {brandLetters.map((letter, index) => (
                <span className={styles.brandLetter} key={`${letter}-${index}`}>
                  {letter}
                </span>
              ))}
            </span>
          </h1>

          <div className={`${styles.ticker} ${styles.tickerBottom}`} aria-hidden>
            <div className={styles.trackLeft}>
              {[0, 1].map((dup) => (
                <span className={styles.tickerSet} key={dup}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span className={styles.tickerItem} key={i}>
                      BLIND ROTATION MEETING
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className={styles.heroEditorial}
          role="img"
          aria-label="AI가 매칭하고 선택은 사람이 합니다. 집에서 만나고, 대화는 AI가 돕습니다."
        >
          <p className={styles.editorialMatch} aria-hidden>
            <span>AI MATCHED</span>
            <strong>HUMAN CHOSEN</strong>
          </p>
          <p className={styles.editorialSequence} aria-hidden>
            <span>01—ROTATION</span>
            <span>02—CONVERSATION</span>
            <span>03—DATE</span>
          </p>
          <p className={styles.editorialHome} aria-hidden>
            <span>MEET AT</span> <strong>HOME</strong>
          </p>
          <p className={styles.editorialAssist} aria-hidden>
            <span>YOU TALK</span>
            <strong>AI HELPS</strong>
          </p>
          <p className={styles.editorialVertical} aria-hidden>
            BLIND BUT NOT RANDOM
          </p>
        </div>
      </header>

      <section
        className={`${styles.featureStage} ${styles.featureThree}`}
        aria-labelledby="feature-three-title"
      >
        <div className={styles.featureSticky}>
          <div className={styles.featurePanel}>
            <IPhoneFrame label="블라인드 로테이션 앱 실행 프리뷰">
              <RotationPreview />
            </IPhoneFrame>
            <div className={styles.featureCopy}>
              <span className={styles.featureKicker}>01 / BLIND ROTATION</span>
              <h2 id="feature-three-title">로테이션 소개팅을 집에서</h2>
              <p>
                낯선 장소에 모일 부담 없이, AI가 취향을 살펴 찾은 상대들과 편안하게 대화해보세요.
              </p>
              <ul>
                <li>취향과 거리를 고려한 맞춤 로테이션</li>
                <li>말이 막힐 때 자연스럽게 이어주는 대화 질문</li>
                <li>서로 선택해야만 시작되는 안심 1:1 채팅</li>
              </ul>
              <small>이동 없이, 부담은 낮추고 만남의 가능성은 넓게</small>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`${styles.featureStage} ${styles.featureFour}`}
        aria-labelledby="feature-four-title"
      >
        <div className={styles.featureSticky}>
          <div className={`${styles.featurePanel} ${styles.featurePanelReverse}`}>
            <div className={styles.featureCopy}>
              <span className={styles.featureKicker}>02 / DATE PLAN</span>
              <h2 id="feature-four-title">매칭에서 만남까지</h2>
              <p>
                연애가 낯설어도 계획까지 잘할 필요는 없어요. 예산과 동네만 고르면 만남에 맞는 코스를
                추천해드려요.
              </p>
              <ul>
                <li>예산과 시간에 맞춰 비교하는 데이트 코스</li>
                <li>고른 동네의 실제 장소와 지도·예약 정보</li>
                <li>한 사람이 제안하고, 상대가 확인하는 약속 확정</li>
              </ul>
              <small>검색과 조율은 줄이고, 둘의 만남에 더 집중하세요</small>
            </div>
            <IPhoneFrame label="데이트 플랜 앱 실행 프리뷰">
              <DatePlanPreview />
            </IPhoneFrame>
          </div>
        </div>
      </section>

      <section className={styles.showcase} aria-labelledby="download-title">
        <div className={styles.showcaseSticky}>
          <div className={styles.homeScene} aria-hidden>
            <Image
              className={styles.homeSceneBackground}
              src="/cafe-date-background-landscape.png"
              alt=""
              fill
              sizes="100vw"
            />
            <div className={styles.homeSceneShade} />
            <Image
              className={`${styles.homeCharacter} ${styles.homeCharacterMan}`}
              src="/cafe-date-character-man.png"
              alt=""
              width={1023}
              height={1537}
              sizes="(max-width: 720px) 58vw, 32vw"
            />
            <Image
              className={`${styles.homeCharacter} ${styles.homeCharacterWoman}`}
              src="/cafe-date-character-woman.png"
              alt=""
              width={1023}
              height={1537}
              sizes="(max-width: 720px) 58vw, 32vw"
            />
          </div>
          <div className={styles.downloadCenter}>
            <h2 className={styles.visuallyHidden} id="download-title">
              Mingles 앱 다운로드
            </h2>
            <IPhoneFrame label="Mingles 앱 다운로드" interactive>
              <DownloadPreview />
            </IPhoneFrame>
          </div>
          <div className={`${styles.characterBubble} ${styles.manBubble}`} role="note">
            AI가 맞춤 매칭을 해준대
          </div>
          <div className={`${styles.characterBubble} ${styles.womanBubble}`} role="note">
            AI가 다음 멘트도 추천해준다는데?
          </div>
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
