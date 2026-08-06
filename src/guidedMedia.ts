import type { GuidedMediaCategory } from "./types";

const youtube = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const GUIDED_MEDIA_CATEGORIES: GuidedMediaCategory[] = [
  {
    id: "float-my-boat",
    name: "Meditations That Float My Boat",
    description: "Your hand-picked meditation playlist, filtered to entries shorter than 45 minutes.",
    playlistUrl:
      "https://www.youtube.com/watch?v=3YuOMmxbc9M&list=PL64Umd2MXb3qA_K_tM9t7wI_JUlUtgQaG",
    items: [
      { id: "3YuOMmxbc9M", title: "Guided Mindfulness Meditation on Acceptance and Letting Go", durationSeconds: 822, url: youtube("3YuOMmxbc9M") },
      { id: "NZh3YjbseCc", title: "Yoga Nidra for Deep Rest", durationSeconds: 1398, url: youtube("NZh3YjbseCc") },
      { id: "P8e4dbR03o0", title: "Breathing in Blessings (A Self-love Guided Meditation)", durationSeconds: 1839, url: youtube("P8e4dbR03o0") },
      { id: "xXwy1Cq5R3A", title: "Guided Nature Meditation — Restore Your Soul", durationSeconds: 1021, url: youtube("xXwy1Cq5R3A") },
      { id: "v5OCO_GRC80", title: "Guided Meditation for Cravings and Addiction — No Music", durationSeconds: 601, url: youtube("v5OCO_GRC80") },
      { id: "mZxcw2rPWxU", title: "Guided Mindfulness Meditation for a Powerful Mind", durationSeconds: 602, url: youtube("mZxcw2rPWxU") },
      { id: "ZXWfNkdZ8ks", title: "Guided Meditation for Detachment from Wants and Desires", durationSeconds: 2112, url: youtube("ZXWfNkdZ8ks") },
      { id: "9B_NSBWGYCw", title: "Release Tension and Recharge Energy — Body Scan", durationSeconds: 776, url: youtube("9B_NSBWGYCw") },
      { id: "hy4gfpOt9xA", title: "Til A Mermaid Drags You Under", durationSeconds: 627, url: youtube("hy4gfpOt9xA") },
      { id: "nmL-svyPHPU", title: "Guided Mindfulness Meditation on Loving Your Life", durationSeconds: 901, url: youtube("nmL-svyPHPU") },
      { id: "hKj_4hedwD8", title: "Untitled Ambient Meditation — Lw", durationSeconds: 2684, url: youtube("hKj_4hedwD8"), creator: "Lw" },
      { id: "p8VIYUknaJc", title: "Open Awareness — Mindfulness for Humans", durationSeconds: 931, url: youtube("p8VIYUknaJc") },
      { id: "AKGrmY8OSHM", title: "NSDR with Dr Andrew Huberman", durationSeconds: 650, url: youtube("AKGrmY8OSHM") },
      { id: "hEypv90GzDE", title: "20 Minute Non-Sleep Deep Rest (NSDR)", durationSeconds: 1252, url: youtube("hEypv90GzDE") }
    ]
  },
  {
    id: "lowercase",
    name: "lowercase.",
    description: "Quiet, close-up sound works from your lowercase playlist.",
    playlistUrl:
      "https://www.youtube.com/watch?v=zCx_MPMWrFU&list=PL64Umd2MXb3rHV1aIzcN33oVvpfu0KYLa",
    items: [
      { id: "zCx_MPMWrFU", title: "Jeph Jerman — The Bray Harp (Full LP)", durationSeconds: 1957, url: youtube("zCx_MPMWrFU") },
      { id: "fFbC719YbnE", title: "40 Pictures of Frozen Lakes", durationSeconds: 1013, url: youtube("fFbC719YbnE") },
      { id: "oO8HrG2h9pA", title: "Forms of Paper (Remastered)", durationSeconds: 3240, url: youtube("oO8HrG2h9pA") },
      { id: "EilhNINwcQc", title: "Steve Roden — Light Forms", durationSeconds: 2185, url: youtube("EilhNINwcQc") },
      { id: "pX_jySkFIK4", title: "William Basinski — Watermusic II", durationSeconds: 3998, url: youtube("pX_jySkFIK4") },
      { id: "-ao08T7KXAg", title: "Lowercase Composition #1", durationSeconds: 1509, url: youtube("-ao08T7KXAg") },
      { id: "Ueb-N3INbqk", title: "Lowercase Noises — Silence of Siberia", durationSeconds: 446, url: youtube("Ueb-N3INbqk") },
      { id: "RxXFWRQfWnU", title: "Sustain Trance", durationSeconds: 599, url: youtube("RxXFWRQfWnU") },
      { id: "LqzdTBlwG0w", title: "Glow", durationSeconds: 486, url: youtube("LqzdTBlwG0w") },
      { id: "Dd6tmwa01tQ", title: "Steve Roden — Stars of Ice", durationSeconds: 2039, url: youtube("Dd6tmwa01tQ") }
    ]
  },
  {
    id: "singing-as-therapy",
    name: "Singing as Therapy",
    description: "Songs you use as an active, sing-along emotional practice.",
    playlistUrl: "https://www.youtube.com/watch?v=5Gazna_jPNU&list=PLQofZ_BkKgQA",
    importNote:
      "The supplied YouTube playlist ID did not expose its remaining entries, so the confirmed starting track is saved and the original playlist link is preserved.",
    items: [
      {
        id: "5Gazna_jPNU",
        title: "Northern Downpour",
        durationSeconds: 248,
        url: youtube("5Gazna_jPNU"),
        creator: "Panic! At The Disco"
      }
    ]
  }
];
