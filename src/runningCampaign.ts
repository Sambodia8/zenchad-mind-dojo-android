import { loadStoryRunResults } from "./runningStoryResults";

export interface StoryMissionDefinition {
  id: string;
  title: string;
  episode: number | null;
  kind: "campaign" | "side";
  contact: string;
  objective: string;
  briefing: string;
  openingLine: string;
  watcherLine: string;
  chaseLine: string;
  helicopterLine: string;
  homeLine: string;
  extractionLine: string;
  cliffhanger: string;
}

export const STORY_CAMPAIGN: StoryMissionDefinition[] = [
  {
    id: "ghost-signal-001",
    title: "Ghost Signal",
    episode: 1,
    kind: "campaign",
    contact: "Mara",
    objective: "Move a stolen relay key before the city grid realises it survived.",
    briefing: "A dead relay just spoke. Mara needs its key carried physically off-grid before the signal is traced.",
    openingLine: "Runner. Mara here. You're carrying a relay key the city grid thinks was destroyed. Keep moving. I'll handle the route.",
    watcherLine: "We've got a watcher behind you. Not a problem yet. Keep your rhythm.",
    chaseLine: "Runner, you've got company. Another runner is closing fast. Move.",
    helicopterLine: "Air unit above us. They've got visual. Keep running. Cover ahead — get under it.",
    homeLine: "You're almost clear, Runner. Bring the relay key home.",
    extractionLine: "Key received. Nobody should have known that relay existed.",
    cliffhanger: "The key contains a transmission timestamped tomorrow."
  },
  {
    id: "paper-city-002",
    title: "Paper City",
    episode: 2,
    kind: "campaign",
    contact: "Mara",
    objective: "Carry the impossible transmission to an analogue dead-drop.",
    briefing: "The relay key predicted a police sweep before it happened. Mara wants the raw packet somewhere the network cannot rewrite it.",
    openingLine: "Runner. Same channel. The packet on that key predicts things before the grid sees them. We're taking it analogue.",
    watcherLine: "Someone just mirrored your direction change. Assume you're being tailed and keep your rhythm.",
    chaseLine: "Tail confirmed. They're accelerating. Open a gap if you've got it.",
    helicopterLine: "Rotor noise inbound. Air unit is searching your corridor. Keep moving to cover.",
    homeLine: "Dead-drop is close. Don't slow down for the handoff.",
    extractionLine: "Packet dropped. Mara's reader found a map hidden inside the timestamps.",
    cliffhanger: "The map marks a route you ran before the app existed."
  },
  {
    id: "echo-runner-003",
    title: "Echo Runner",
    episode: 3,
    kind: "campaign",
    contact: "Mara",
    objective: "Follow the impossible route while somebody else appears to be running it too.",
    briefing: "The timestamp-map overlaps your real streets. A second moving signal has just entered the same corridor.",
    openingLine: "Runner, the map is live. There's another signal moving through the same streets as you. We don't know who is carrying it.",
    watcherLine: "Second signal is matching your pace. Too clean to be coincidence.",
    chaseLine: "They're closing now. Move. I want to know whether they can actually keep up with you.",
    helicopterLine: "Police air unit just joined the search. Use the route — cover is ahead.",
    homeLine: "Signal is breaking away. Finish the route and I'll triangulate it.",
    extractionLine: "Triangulation complete. The other signal used your Runner identifier.",
    cliffhanger: "Someone has been filing missions under your name."
  },
  {
    id: "borrowed-name-004",
    title: "Borrowed Name",
    episode: 4,
    kind: "campaign",
    contact: "Mara",
    objective: "Flush out whoever is operating under your Runner identity.",
    briefing: "Mara has planted a false courier job under your identifier. If the copy takes the bait, both of you will converge on the same network window.",
    openingLine: "The bait is live. Whoever borrowed your name accepted the job twelve seconds ago. Keep moving and let them think you're following their route.",
    watcherLine: "They're reacting to us in real time. That means our channel isn't as private as I thought.",
    chaseLine: "Contact moving fast. Don't chase the person — chase the signal. Give me the pace change I need to separate you.",
    helicopterLine: "Police helicopter just lit up the corridor. Both Runner IDs are exposed. Get under cover.",
    homeLine: "I've got enough. Bring yourself out clean and I'll burn this channel.",
    extractionLine: "Channel burned. The copied identifier wasn't forged externally — it was issued by our own network.",
    cliffhanger: "Mara's credentials signed the duplicate Runner ID."
  }
];

const SIDE_MISSIONS: Omit<StoryMissionDefinition, "id">[] = [
  {
    title: "Cold Courier",
    episode: null,
    kind: "side",
    contact: "Mara",
    objective: "Move a short-lived data package across the city before its key expires.",
    briefing: "Routine courier work, except the package erases itself if the network gets a clean lock on you.",
    openingLine: "Runner, quick courier job. Package is live and the clock is already moving. Keep your route clean.",
    watcherLine: "Passive tail behind you. Keep your rhythm and make them work for the read.",
    chaseLine: "Tail just committed. Move.",
    helicopterLine: "Air unit scanning. Stay moving and use cover ahead.",
    homeLine: "Package window is nearly closed. Bring it in.",
    extractionLine: "Courier package delivered clean.",
    cliffhanger: "Another job is already waiting."
  },
  {
    title: "Blind Spot",
    episode: null,
    kind: "side",
    contact: "Mara",
    objective: "Cross a surveillance gap while the grid is recalibrating.",
    briefing: "A temporary blind spot has appeared in the surveillance mesh. Mara wants to know whether it is natural or bait.",
    openingLine: "We've got a blind spot in the grid. You're going through it before somebody patches it.",
    watcherLine: "Cameras behind you just came back online. Keep moving.",
    chaseLine: "Ground unit is trying to close the blind spot with you inside it. Move.",
    helicopterLine: "Air unit filling the gap from above. Cover ahead.",
    homeLine: "You're nearly out of the mesh. Keep the same line.",
    extractionLine: "Blind spot crossed. It wasn't an accident.",
    cliffhanger: "Somebody opened it for you."
  },
  {
    title: "Noise Floor",
    episode: null,
    kind: "side",
    contact: "Mara",
    objective: "Carry a transmitter long enough to make a false Runner trail believable.",
    briefing: "Your job is to be obvious in exactly the right way while another courier disappears.",
    openingLine: "Today you're the noise, Runner. Make the grid look at you while somebody else vanishes.",
    watcherLine: "Good. They're tracking the decoy. Keep feeding them a believable line.",
    chaseLine: "They've decided the decoy is real. Time to sell it. Move.",
    helicopterLine: "Air unit bought the signal too. Get under cover and make them overshoot.",
    homeLine: "Decoy job is done. Bring yourself back clean.",
    extractionLine: "The real courier disappeared exactly where we needed them to.",
    cliffhanger: "The grid still thinks you were carrying the package."
  }
];

export interface RunningCampaignState {
  completedCampaignIds: string[];
  latestCliffhanger: string | null;
  nextEpisode: number | null;
  campaignComplete: boolean;
  sideMissionsCompleted: number;
}

export function runningCampaignState(): RunningCampaignState {
  const results = loadStoryRunResults();
  const completedCampaignIds = results
    .map((result) => result.missionId)
    .filter((id) => STORY_CAMPAIGN.some((mission) => mission.id === id));
  const completedSet = new Set(completedCampaignIds);
  const next = STORY_CAMPAIGN.find((mission) => !completedSet.has(mission.id)) ?? null;
  const latestCampaignResult = results.find((result) => STORY_CAMPAIGN.some((mission) => mission.id === result.missionId));
  const latestMission = latestCampaignResult
    ? STORY_CAMPAIGN.find((mission) => mission.id === latestCampaignResult.missionId) ?? null
    : null;
  return {
    completedCampaignIds: [...new Set(completedCampaignIds)],
    latestCliffhanger: latestMission?.cliffhanger ?? null,
    nextEpisode: next?.episode ?? null,
    campaignComplete: !next,
    sideMissionsCompleted: results.filter((result) => result.missionId.startsWith("side-")).length
  };
}

function deterministicIndex(seed: string, modulo: number) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value >>> 0) % Math.max(1, modulo);
}

export function chooseStoryMission(runSessionId: string): StoryMissionDefinition {
  const state = runningCampaignState();
  const completed = new Set(state.completedCampaignIds);
  const nextCampaign = STORY_CAMPAIGN.find((mission) => !completed.has(mission.id));
  if (nextCampaign) return nextCampaign;

  const index = deterministicIndex(`${runSessionId}:${state.sideMissionsCompleted}`, SIDE_MISSIONS.length);
  const template = SIDE_MISSIONS[index];
  return {
    ...template,
    id: `side-${index + 1}-${state.sideMissionsCompleted + 1}`
  };
}

export function missionById(id: string) {
  return STORY_CAMPAIGN.find((mission) => mission.id === id) ?? null;
}
