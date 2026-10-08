import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ExternalLink,
  ListMusic,
  Play,
  Search,
  Timer,
  Sparkles,
  SlidersHorizontal,
  X
} from "lucide-react";
import { MEDITATIONS } from "../data";
import { GUIDED_MEDIA_CATEGORIES } from "../guidedMedia";
import type { AppData, Route } from "../types";
import EmotionalToolbox from "./EmotionalToolbox";
import MeditationCard from "../components/MeditationCard";

interface Props {
  initialTab?: "meditations" | "guided" | "emotional";
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  navigate: Dispatch<SetStateAction<Route>>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function ToolkitScreen({
  initialTab = "meditations",
  data,
  setData,
  navigate
}: Props) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const meditations = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return MEDITATIONS.filter((item) => {
      const matchesCategory = category === "All"
        || item.category === category
        || (category === "Sleep" && item.tags.includes("sleep"))
        || (category === "Breathwork" && item.tags.some(tag => /breath/i.test(tag)));
      return matchesCategory && (!normalized ||
        `${item.name} ${item.category} ${item.description} ${item.benefit} ${item.tags.join(" ")}`.toLowerCase().includes(normalized));
    }).sort((a, b) => {
      const featured = ["metta", "yoga-nidra", "diaphragmatic-breathing"];
      const rank = (id: string) => featured.includes(id) ? featured.indexOf(id) : featured.length;
      return rank(a.id) - rank(b.id);
    });
  }, [query, category]);

  return (
    <div className={`screen-stack meditation-library ${tab === "meditations" ? "" : "library-auxiliary"}`}>
      {tab !== "meditations" && (
      <section className="page-intro">
        <span className="eyebrow">
          {tab === "emotional"
            ? "My emotional toolbox"
            : tab === "guided"
              ? "My saved listening"
              : "Meditation library"}
        </span>
        <h1>
          {tab === "emotional"
            ? "Find what helps now"
            : tab === "guided"
              ? "Press play, less searching"
              : "Choose what fits"}
        </h1>
        <p>
          {tab === "emotional"
            ? "Tell the toolbox where you are, and it will learn what genuinely helps."
            : tab === "guided"
              ? "Your curated YouTube lists, with titles and durations saved locally."
              : "Short descriptions answer “what is this for?” before you commit."}
        </p>
      </section>

      )}
      {(toolsOpen || tab !== "meditations") && <div id="library-tools" className="library-tools">
      <div className="segmented three">
        <button className={tab === "meditations" ? "active" : ""} onClick={() => setTab("meditations")}>
          Meditate
        </button>
        <button className={tab === "guided" ? "active" : ""} onClick={() => setTab("guided")}>
          Listen
        </button>
        <button className={tab === "emotional" ? "active" : ""} onClick={() => setTab("emotional")}>
          Regulate
        </button>
      </div>

      <div className="practice-launchers">
            <button onClick={()=>navigate({name:"meditation-timer",preset:"free"})}><Timer size={25}/><span><strong>Meditation timer</strong><small>Your time · countdown or stopwatch · earn XP</small></span></button>
            <button onClick={()=>navigate({name:"meditation-timer",preset:"focus-refocus"})}><Sparkles size={25}/><span><strong>Focus & refocus · 13 minutes</strong><small>A gentle return to attention · optional eight-week goal</small></span></button>
          </div>
      </div>}
      {tab === "meditations" && <>
        <div className="library-search">
          <Search size={22} aria-hidden="true" />
          <input aria-label="Search meditations" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, goal, or feeling" />
          {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={18} /></button>}
          <button aria-label="Library tools" aria-expanded={toolsOpen} aria-controls="library-tools" onClick={() => setToolsOpen(!toolsOpen)}><SlidersHorizontal size={21} /></button>
        </div>
        <div className="library-categories" aria-label="Meditation categories">
          {["All", "Relaxation", "Sleep", "Breathwork", "Focus", "Emotional", "Sensory", "Spiritual"].map(item =>
            <button key={item} aria-pressed={category === item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="library-card-list">
          {meditations.map(meditation => <MeditationCard key={meditation.id} meditation={meditation} onStart={() => navigate({ name: "timer", meditationId: meditation.id })} />)}
          {meditations.length === 0 && <div className="library-empty"><p>No meditations match your search.</p><button className="library-secondary" onClick={() => { setQuery(""); setCategory("All"); }}>Clear search and filters</button></div>}
        </div>
      </>}

      {tab === "guided" && (
        <div className="guided-library">
          <div className={`connectivity-note ${online ? "" : "offline"}`}>
            <ListMusic size={18} />
            <span>
              {online
                ? "The catalogue is stored in the app. Videos open in YouTube."
                : "You are offline. Titles and durations remain available; playback will work when reconnected."}
            </span>
          </div>
          {GUIDED_MEDIA_CATEGORIES.map((category, categoryIndex) => (
            <details className="card media-category" key={category.id} open={categoryIndex === 0}>
              <summary>
                <div>
                  <span className="eyebrow">{category.items.length} saved</span>
                  <h2>{category.name}</h2>
                  <p>{category.description}</p>
                </div>
                <span className="summary-marker">+</span>
              </summary>
              <div className="media-category-body">
                {category.importNote && <p className="import-note">{category.importNote}</p>}
                <a
                  className={`button secondary playlist-link ${online ? "" : "offline"}`}
                  href={online ? category.playlistUrl : undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!online}
                  onClick={(event) => !online && event.preventDefault()}
                >
                  <ExternalLink size={16} /> Open full playlist
                </a>
                <div className="media-item-list">
                  {category.items.map((item) => (
                    <a
                      key={item.id}
                      className={`media-item ${online ? "" : "offline"}`}
                      href={online ? item.url : undefined}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!online}
                      onClick={(event) => !online && event.preventDefault()}
                    >
                      <span className="media-play"><Play size={16} fill="currentColor" /></span>
                      <span className="media-copy">
                        <strong>{item.title}</strong>
                        {item.creator && <small>{item.creator}</small>}
                      </span>
                      <time>{formatDuration(item.durationSeconds)}</time>
                    </a>
                  ))}
                </div>
              </div>
            </details>
          ))}
          <section className="card offline-media-note">
            <strong>Offline audio comes later</strong>
            <p>
              The app can distinguish local media from YouTube links. Actual offline guided audio will
              be added after you provide approved files and your ElevenLabs voice details.
            </p>
          </section>
        </div>
      )}

      {tab === "emotional" && <EmotionalToolbox data={data} setData={setData} />}
    </div>
  );
}
