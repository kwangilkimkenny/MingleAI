# MingleAI production design system

> Status: current source of truth · Updated 2026-07-22
> Live tokens: `apps/mobile/src/lib/theme.ts`

## 1. Product promise

MingleAI is a dating and social matching app where people become comfortable through play before
they decide whether to connect one-to-one. AI supports safety and matching quality; it never speaks
or decides in place of a person.

The memorable experience is:

> 게임에서 자연스럽게 친해지고, 서로의 명확한 선택으로 다음 대화를 연다.

Every screen must strengthen at least one of three qualities: social context, personal agency, or
safety. Game mechanics that do not create a reason to talk are decorative and should not be added.

## 2. Experience architecture

The primary loop is one continuous relationship journey:

1. **Matchmaking** — explain what is being matched, show progress honestly, allow cancellation.
2. **Match found** — preview the party, explain the first activity, enter only after an explicit tap.
3. **Game world** — always show the current social objective and contextual next action.
4. **Play and conversation** — use games as prompts; keep chat and member safety tools available.
5. **Reflection** — help people remember shared answers and moments, not only scores or winners.
6. **Proposal** — require a confirmation step and explain that chat opens only after mutual consent.
7. **Chat** — maintain identity, safety access, and a clear relationship to the shared game context.

No state may be a dead end. Empty proposal and chat screens lead back to finding a game party.

## 3. Visual language

The system is a warm, hand-drawn social game board. The world, characters, and interface share one
ink-and-paper language while hierarchy stays calmer in the HUD.

- **Doodle world:** quiet paper rooms, visible ink-outlined furniture, and monochrome character
  stickers. The map uses warm neutral tints; it is never more colorful than the people or objective.
- **Doodle UI:** the human layer for objectives, decisions, safety, and conversation.
- **Bridge:** opaque or near-opaque paper HUD cards with warm ink outlines sit above the world. The
  same stroke weight, corner language, and coral accent connect world objects and controls.
- **Tone:** playful but never childish; warm but never vague; expressive but never noisy.
- **Prohibited:** gradients, glassmorphism blur, generic dashboard grids, decorative badges without
  meaning, multiple primary CTAs, and low-contrast coral text.

Player identity is assigned from `profileId`, never mutable display names. A player keeps the same
avatar in the world, member list, spectator state, and elimination marker. Coral identifies the local
player or the single next action; it is not a random costume color.

Use asymmetry sparingly: cards may have wonky corners, while dense HUD controls remain stable and
predictable. Hard ink offset shadows belong to hero cards, not every control.

## 4. Color

| Token | Value | Purpose |
|---|---:|---|
| `ink` | `#17150F` | Primary text, outline, high-emphasis surface |
| `paper` | `#FFFFFF` | Page and card surface |
| `grayDark` | `#736357` | Accessible secondary copy |
| `grayMid` | `#786F67` | Accessible muted copy; 4.9:1 on paper |
| `grayLight` | `#D9D5CC` | Dividers and non-text boundaries |
| `fill` | `#F1EFE9` | Quiet grouped surface |
| `fillDeep` | `#E7E4DC` | Disabled or selected neutral surface |
| `accent` | `#D13F4F` | Primary action and selected state; white text passes AA |
| `accentBright` | `#FF5864` | Decorative brand coral, not a white-text button fill |
| `success` | `#257A55` | Confirmed safe/connected state, always paired with text/icon |
| `warning` | `#9A5D00` | Caution, always paired with text/icon |
| `warningFill` | `#FFF0D6` | Quiet warning surface; never used without warning text/icon |
| `danger` | `#7B2531` | Destructive/error meaning; burgundy separates it from brand coral |
| `dangerFill` | `#F7E7EA` | Quiet destructive surface for warnings and review steps |

Color never carries meaning alone. A screen has one coral primary action. Destructive actions are
separated spatially and never styled as the primary path. Entry points to destructive flows use a
paper surface with a burgundy outline; only the final irreversible confirmation uses solid burgundy.

## 5. Typography

- **Display / short action:** Gaegu 700. Use at 18px or larger for Korean.
- **Body:** bundled Pretendard Regular 16/24.
- **Label:** bundled Pretendard SemiBold 15/21.
- **Caption:** bundled Pretendard Regular 13/19; use `grayDark` for essential information.
- Do not use handwriting fonts for long text, safety explanations, form values, or small metadata.
- Support text scaling without clipping. Critical actions may wrap to two lines rather than truncate.

## 6. Layout and controls

- Base grid: 4pt. Standard screen gutter: 20pt. Content max width: 560pt.
- Standard spacing sequence: 4, 8, 12, 16, 20, 24, 32, 40.
- Minimum touch target: 44×44pt. Standard button height: 48pt.
- Modal content must fit between safe areas and the software keyboard. Chat uses a responsive height,
  not a fixed pixel height.
- Primary content follows a single reading column. Side-by-side content is reserved for landscape
  game controls and short binary game choices.

## 7. Game-world rules

### Entry

- Matchmaking remains portrait.
- Match success is an explicit preparation screen; only the game world requests landscape.
- First entry shows a dismissible guide covering movement, contextual actions, chat, and safety.

### Persistent HUD

The lobby always exposes:

- current objective (`지금 할 일`),
- contextual next action,
- party presence,
- help,
- members and safety menu,
- chat with unread state.

The objective changes when a player approaches another member or a game station. HUD copy describes
the social outcome, not a technical operation: “프로필 버튼을 누르세요” is weaker than “함께
플레이한 뒤 소개를 확인하세요.”

### Controls and accessibility

- Joystick and action buttons remain in stable corners to build muscle memory.
- Screen-reader users receive four explicit directional buttons instead of an unlabeled drag area.
- All controls have role, label, state, and at least a 44pt target.
- Reduced-motion mode must disable decorative movement and non-essential camera effects; game state
  changes still need immediate textual feedback.
- Role reveal waits for explicit confirmation. Timed, hold, sequence, and wire missions provide
  non-motion or single-tap alternatives and never communicate success or failure through color alone.
- Short landscape screens keep mission content inside a bounded, scrollable modal with a persistent
  close action. Screen-reader users can open the next mission without spatial navigation.
- The nearest unfinished mission is always named with direction and distance. Mission markers use a
  tool icon, high-contrast paper fill, and an edge pointer when the target is outside the viewport.
- Meeting candidates use responsive one-, two-, or three-column radio cards. All candidates and the
  pinned confirmation action must remain reachable at 8-player capacity.
- Semantic haptics reinforce selection, success, warning, and failure on native devices. Haptics are
  supplementary: every state change must still have visible text or icon feedback.

### Reflection

- Results summarize real session data: personal mission progress, survival/ejection context, and the
  strongest shared balance-game answer when available.
- Result copy should create a specific conversation opener. Do not fabricate compatibility scores,
  chemistry claims, or generic awards.

## 8. Proposal and safety rules

- Never send a proposal from the first CTA tap. Show the recipient and meaning, then confirm.
- Explain that one-to-one chat opens only after acceptance.
- Show both received and sent proposals, including pending/accepted/closed states.
- Do not expose detailed rejection reasons or pressure users with countdowns.
- Report/block access stays available from party member and direct-chat contexts.
- Leaving, blocking, and reporting must be understandable before the user needs them.

## 9. Content voice

Use calm, specific Korean. State what is happening and what the user can do next.

- Prefer: `잘 맞는 파티를 찾고 있어요` / `게임 월드 입장` / `답변 기다리는 중`
- Avoid: `매칭 중...` / `완료` without a subject / debug party IDs / unexplained timers
- Never imply guaranteed compatibility or safety. Say what the system checks and what remains the
  user's decision.

## 10. Production quality gate

A release candidate is not design-complete until it passes:

- iPhone SE-class, standard iPhone, Pro Max, and representative Android portrait/landscape layouts;
- keyboard-open chat composition and safe-area checks;
- VoiceOver and TalkBack primary-loop completion;
- Dynamic Type / large font checks for all decision screens;
- WCAG AA contrast for normal text and visible focus/pressed/disabled states;
- reduced-motion behavior;
- offline, reconnecting, empty, loading, error, pending, accepted, declined, and blocked states;
- live screenshots of matchmaking, match found, game entry, game HUD, proposal confirmation,
  proposal status, and chat.

Automated checks complement but do not replace visual QA on the rendered app.
