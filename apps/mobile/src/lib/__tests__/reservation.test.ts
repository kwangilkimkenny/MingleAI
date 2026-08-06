import { describe, it, expect } from "vitest";
import { reservationTarget, telUrl, naverMapUrl, categoryLeaf } from "../reservation";
import { parseArea } from "../place-area";

describe("reservationTarget", () => {
  it("promotes a real booking link to a labeled reservation action", () => {
    const t = reservationTarget({
      title: "우오보 하우스",
      link: "https://app.catchtable.co.kr/ct/shop/uovohouse?from=share",
    });
    expect(t).toMatchObject({ bookable: true, provider: "캐치테이블" });
    expect(t.label).toBe("캐치테이블에서 예약");
    expect(t.url).toContain("catchtable");
  });

  it("falls back to the Naver place page for a homepage link", () => {
    const t = reservationTarget({ title: "울프강 스테이크하우스", link: "http://wolfgangssteakhouse.co.kr" });
    expect(t.bookable).toBe(false);
    expect(t.url).toBe(naverMapUrl("울프강 스테이크하우스"));
  });

  it("falls back when the link is missing or unparseable", () => {
    expect(reservationTarget({ title: "가게" }).bookable).toBe(false);
    expect(reservationTarget({ title: "가게", link: "not a url" }).bookable).toBe(false);
  });

  it("does not match a lookalike host", () => {
    // catchtable.co.kr.evil.com 같은 접미사 위장은 예약 링크로 승격되면 안 된다.
    const t = reservationTarget({ title: "가게", link: "https://catchtable.co.kr.evil.com/x" });
    expect(t.bookable).toBe(false);
  });
});

describe("telUrl", () => {
  it("returns a dial link only when a usable number exists", () => {
    expect(telUrl("02-123-4567")).toBe("tel:021234567");
    expect(telUrl("")).toBeNull();
    expect(telUrl(undefined)).toBeNull();
    expect(telUrl("123")).toBeNull();
  });
});

describe("categoryLeaf", () => {
  it("keeps only the last segment", () => {
    expect(categoryLeaf("음식점>일식>초밥,롤")).toBe("초밥,롤");
    expect(categoryLeaf("카페")).toBe("카페");
  });
});

describe("parseArea", () => {
  it("accepts a well-formed area and rejects junk", () => {
    expect(parseArea('{"label":"홍대입구역","lat":37.55,"lng":126.92}')).toEqual({
      label: "홍대입구역",
      lat: 37.55,
      lng: 126.92,
    });
    expect(parseArea("{oops")).toBeNull();
    expect(parseArea('{"label":"","lat":1,"lng":2}')).toBeNull();
    expect(parseArea('{"label":"x","lat":"nope","lng":2}')).toBeNull();
  });
});
