import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ExternalLink,
  ListMusic,
  Play,
  Search
} from "lucide-react";
import { MEDITATIONS } from "../data";
import { GUIDED_MEDIA_CATEGORIES } from "../guidedMedia";
import type { AppData, Route } from "../types";
import EmotionalToolbox from "./EmotionalToolbox";
import MeditationIcon from "../components/MeditationIcon";

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
    return MEDITATIONS.filter(
      (item) =>
        !normalized ||
        `${item.name} ${item.description} ${item.benefit} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(normalized)
    );
  }, [query]);

  return (
    <div className="screen-stack">
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

      {tab === "meditations" && (
        <>
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, goal, or feeling"
            />
          </label>
          <div className="meditation-list">
            {meditations.map((meditation) => (
              <article className="meditation-card" key={meditation.id}>
                <span className="meditation-glyph">
                  <MeditationIcon meditationId={meditation.id} />
                </span>
                <div className="meditation-copy">
                  <div className="meta-row">
                    <span>{meditation.category}</span>
                    <span>
                      {Math.ceil(
                        meditation.phases.reduce((sum, item) => sum + item.duration, 0) / 60
                      )}{" "}
                      min
                    </span>
                  </div>
                  <h3>{meditation.name}</h3>
                  <strong style={{ color: meditation.color }}>{meditation.benefit}</strong>
                  <p>{meditation.description}</p>
                  <div className="chip-row">
                    {meditation.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="card-actions">
                    <button
                      className="button primary"
                      onClick={() => navigate({ name: "timer", meditationId: meditation.id })}
                    >
                      <Play size={17} /> Start
                    </button>
                    {meditation.youtubeQuery && (
                      <a
                        className="button ghost"
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                          meditation.youtubeQuery
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={16} /> Guided
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

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
