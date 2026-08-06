import type { Dispatch, SetStateAction } from "react";
import {
  Award,
  Bike,
  BookOpen,
  ChevronRight,
  Flower2,
  Headphones,
  HeartHandshake,
  MessageCircleHeart,
  Palette,
  Settings,
  Sparkles
} from "lucide-react";
import type { Route } from "../types";

interface Props {
  navigate: Dispatch<SetStateAction<Route>>;
}

const tools: Array<{
  title: string;
  copy: string;
  route: Route;
  icon: typeof Award;
  tone: string;
}> = [
  { title: "Live Zen Guide", copy: "A warm recommendation for right now", route: { name: "guide" }, icon: MessageCircleHeart, tone: "sage" },
  { title: "Meditation journal", copy: "Private reflections kept on this device", route: { name: "journal" }, icon: BookOpen, tone: "lavender" },
  { title: "Weekly quests & badges", copy: "Collect gentle milestones without pressure", route: { name: "rewards" }, icon: Award, tone: "gold" },
  { title: "Bike Quest", copy: "Turn bike prep, riding and recovery into XP", route: { name: "bike-quest" }, icon: Bike, tone: "gold" },
  { title: "Soundscapes", copy: "Offline rain, water and focus textures", route: { name: "soundscapes" }, icon: Headphones, tone: "blue" },
  { title: "Watercolour themes", copy: "Change the atmosphere, not the clarity", route: { name: "themes" }, icon: Palette, tone: "peach" },
  { title: "Emotional toolbox", copy: "Find what genuinely helps you regulate", route: { name: "library", tab: "emotional" }, icon: HeartHandshake, tone: "sage" },
  { title: "Yoga with Mark", copy: "Context-based classes with pose-by-pose guidance", route: { name: "yoga" }, icon: Flower2, tone: "blue" },
  { title: "Settings", copy: "Reminders, motion and session preferences", route: { name: "settings" }, icon: Settings, tone: "lavender" }
];

export default function ToolkitHubScreen({ navigate }: Props) {
  return (
    <div className="screen-stack toolkit-hub">
      <section className="page-intro illustrated-intro">
        <div>
          <span className="eyebrow">Your wellness adventure</span>
          <h1>Toolkit</h1>
          <p>Small supports for whichever kind of day turned up.</p>
        </div>
        <img src="assets/vision2/zen-chad-mascot.png" alt="" />
      </section>

      <section className="tool-journey" aria-label="Wellness tools">
        {tools.map(({ title, copy, route, icon: Icon, tone }) => (
          <button className={`tool-journey-card ${tone}`} key={title} onClick={() => navigate(route)}>
            <span className="tool-journey-icon"><Icon /></span>
            <span>
              <strong>{title}</strong>
              <small>{copy}</small>
            </span>
            <ChevronRight />
          </button>
        ))}
      </section>

      <section className="card monk-note">
        <Sparkles />
        <div>
          <strong>Zen Chad says</strong>
          <p>“Use the tool that helps. Ignore the one that sounds impressive.”</p>
        </div>
      </section>
    </div>
  );
}
