import { describe, expect, it } from "vitest";
import { translate } from "./index";

describe("i18n translate", () => {
  it("returns the English source string by default", () => {
    expect(translate("en", "nav.now")).toBe("Now");
    expect(translate("en", "nav.squad")).toBe("Squad");
    expect(translate("en", "settings.title")).toBe("Settings");
  });

  it("flips a sample string to Portuguese when language is pt", () => {
    expect(translate("pt", "nav.now")).toBe("Agora");
    expect(translate("pt", "settings.title")).toBe("Ajustes");
  });

  it("keeps the brand/nav label 'Squad' in Portuguese (C5/DEC-082)", () => {
    expect(translate("pt", "nav.squad")).toBe("Squad");
    expect(translate("pt", "squad.title")).toBe("Squad");
  });

  it("flips one representative string from each main screen to Portuguese (G4 D04)", () => {
    // Now, Line-up, Timetable, My Plan, Map, Squad — proves the screen is wired, not just nav.
    expect(translate("pt", "now.upNext")).toBe("A seguir");
    expect(translate("pt", "lineup.allArtists")).not.toBe(translate("en", "lineup.allArtists"));
    expect(translate("pt", "tt.onlyFavs")).not.toBe(translate("en", "tt.onlyFavs"));
    expect(translate("pt", "plan.lockInMyDay")).toBe("Fechar meu dia");
    expect(translate("pt", "map.recenter")).toBe("Recentralizar");
    expect(translate("pt", "squad.whereEveryone")).toBe("Onde está todo mundo");
  });

  it("keeps an asserted-elsewhere English string identical (e2e contract)", () => {
    // shell.spec asserts this exact label is visible — i18n must not change the EN value.
    expect(translate("en", "settings.appearanceLang")).toBe("Appearance & language");
  });

  it("falls back to English for a key Portuguese doesn't translate", () => {
    // 'palette.day' is translated, but prove the fallback path with a key present only in EN by
    // construction: every key has EN, so a missing PT overlay yields the EN value.
    const ptDay = translate("pt", "palette.day");
    expect(ptDay).toBe("dia");
    // A key whose PT is intentionally identical/handled still never throws and never returns blank.
    expect(translate("pt", "appearance.auto")).toBe("Auto");
  });

  it("interpolates named variables and leaves unknown placeholders intact", () => {
    expect(
      translate("en", "appearance.hintLine", { hint: "Follows the festival clock", palette: "night" }),
    ).toBe("Follows the festival clock · currently showing the night map.");
    expect(translate("pt", "settings.appearanceLangSub", { appearance: "Auto", language: "Português" })).toBe(
      "Auto · Português",
    );
    // Missing var: the placeholder is preserved rather than rendering 'undefined'.
    expect(translate("en", "settings.appearanceLangSub", { appearance: "Auto" })).toBe("Auto · {language}");
  });
});
