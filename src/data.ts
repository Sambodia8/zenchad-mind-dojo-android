import type { BodyArea, Meditation, Movement, YogaClass, YogaClassSlide, ZenStatId } from "./types";

const phase = (
  name: string,
  duration: number,
  kind: "prepare" | "active" | "rest" | "finish",
  instruction: string
) => ({ name, duration, kind, instruction });

export const MEDITATIONS: Meditation[] = [
  {
    id: "metta",
    name: "Metta (Loving Kindness)",
    shortName: "Metta",
    icon: "heart",
    category: "Emotional",
    benefit: "Compassion & positivity",
    description: "Cultivate kindness toward yourself, people you care about, and the wider world.",
    tags: ["compassion", "anger", "connection"],
    color: "#f472b6",
    youtubeQuery: "guided metta loving kindness meditation",
    phases: [
      phase("Arrive", 30, "prepare", "Settle into a comfortable position and soften your breathing."),
      phase("For yourself", 180, "active", "May I be safe. May I be well. May I meet this moment with kindness."),
      phase("For another", 180, "active", "Picture somebody you care about and offer them the same wishes."),
      phase("Expand", 120, "active", "Let the wish widen to people you do not know yet."),
      phase("Rest", 60, "finish", "Release the words and notice any warmth that remains.")
    ]
  },
  {
    id: "binaural",
    name: "Binaural Beats",
    shortName: "Binaural",
    icon: "headphones",
    category: "Sensory",
    benefit: "Focus or deep relaxation",
    description: "Use stereo sound as a steady anchor. Headphones are required for the binaural effect.",
    tags: ["audio", "focus", "sleep"],
    color: "#60a5fa",
    youtubeQuery: "binaural beats focus meditation",
    phases: [
      phase("Headphones", 30, "prepare", "Put on stereo headphones and choose a comfortable volume."),
      phase("Deep listen", 600, "active", "Let the sound be the only task. Return gently whenever attention drifts."),
      phase("Return", 60, "finish", "Remove the headphones and notice the room again.")
    ]
  },
  {
    id: "pratyahara",
    name: "Pratyahara",
    shortName: "Pratyahara",
    icon: "leaf",
    category: "Spiritual",
    benefit: "Less sensory overload",
    description: "Move attention from the outer world toward a quieter inner space.",
    tags: ["sensory", "quiet", "inward"],
    color: "#34d399",
    youtubeQuery: "guided pratyahara sensory withdrawal meditation",
    phases: [
      phase("Outer sounds", 120, "prepare", "Notice distant sounds first, then sounds close to you."),
      phase("Turn inward", 300, "active", "Imagine lowering the volume of each sense without forcing anything away."),
      phase("Inner anchor", 180, "finish", "Rest with the quietest sensation you can find.")
    ]
  },
  {
    id: "nsdr",
    name: "NSDR",
    shortName: "NSDR",
    icon: "moon",
    category: "Relaxation",
    benefit: "Recovery without sleep",
    description: "A lying-down body scan for deep rest, recovery, and a nervous-system reset.",
    tags: ["rest", "recovery", "body scan"],
    color: "#a78bfa",
    youtubeQuery: "NSDR non sleep deep rest guided",
    phases: [
      phase("Get comfortable", 60, "prepare", "Lie down and support your knees or head if that helps."),
      phase("Body scan", 600, "active", "Move slowly from toes to face, allowing each area to feel heavy."),
      phase("Wake gently", 120, "finish", "Deepen the breath, move fingers and toes, and open your eyes.")
    ]
  },
  {
    id: "yoga-nidra",
    name: "Yoga Nidra",
    shortName: "Yoga Nidra",
    icon: "moon",
    category: "Relaxation",
    benefit: "Detailed whole-body rest",
    description: "A spacious, intricate body scan that softens the face, tongue, limbs, torso, and whole body.",
    tags: ["rest", "body scan", "sleep"],
    color: "#8b5cf6",
    phases: [
      phase("Settle", 120, "prepare", "Lie down, become still, and let the room hold you."),
      phase("Right side", 240, "active", "Move attention through every part of the right hand, arm, leg, and foot."),
      phase("Left side", 240, "active", "Move attention through every part of the left hand, arm, leg, and foot."),
      phase("Back and front", 180, "active", "Soften the back body, chest, belly, and pelvis."),
      phase("Face and head", 240, "active", "Release the jaw, lips, tongue, cheeks, eyes, brow, forehead, and scalp."),
      phase("Whole body", 120, "rest", "Feel the entire body resting as one quiet field."),
      phase("Return", 60, "finish", "Deepen the breath and return slowly, keeping as much softness as you can.")
    ]
  },
  {
    id: "diaphragmatic-breathing",
    name: "Diaphragmatic Breathing",
    shortName: "Belly Breath",
    icon: "wind",
    category: "Relaxation",
    benefit: "Easy, grounded breathing",
    description: "Practise comfortable lower-rib and belly breathing without forcing depth or pace.",
    tags: ["breathing", "relaxation", "body"],
    color: "#38bdf8",
    phases: [
      phase("Arrive", 60, "prepare", "Let the first breaths remain ordinary and comfortable."),
      phase("Find the diaphragm", 180, "active", "Invite gentle movement through the belly and lower ribs."),
      phase("Easy rhythm", 300, "active", "Continue without strain, returning to normal breathing whenever needed."),
      phase("Release", 60, "finish", "Stop shaping the breath and notice how the body breathes by itself.")
    ]
  },
  {
    id: "frisson",
    name: "Frisson",
    shortName: "Frisson",
    icon: "music",
    category: "Sensory",
    benefit: "Joy & emotional release",
    description: "Listen closely to powerful music and notice chills, movement, and emotion without analysis.",
    tags: ["music", "joy", "release"],
    color: "#f59e0b",
    youtubeQuery: "frisson powerful emotional music playlist",
    phases: [
      phase("Choose", 45, "prepare", "Pick one track that reliably moves you."),
      phase("Immersion", 240, "active", "Close your eyes and feel the music in the body."),
      phase("Afterglow", 90, "finish", "Stay for the silence after the final sound.")
    ]
  },
  {
    id: "sound-awareness",
    name: "Rotating Sound Awareness",
    shortName: "Sound Sweep",
    icon: "waves",
    category: "Focus",
    benefit: "Flexible attention",
    description: "Systematically shift focus between sounds to build mindful presence.",
    tags: ["sound", "attention", "ADHD"],
    color: "#22d3ee",
    phases: [
      phase("Open hearing", 45, "prepare", "Let every sound arrive without naming it."),
      phase("Far", 120, "active", "Attend only to the furthest sound you can detect."),
      phase("Near", 120, "active", "Shift to the closest sound, including breath and clothing."),
      phase("Whole field", 120, "finish", "Hear the entire soundscape as one changing field.")
    ]
  },
  {
    id: "focused-attention",
    name: "Focused Attention",
    shortName: "Focus",
    icon: "orbit",
    category: "Focus",
    benefit: "Gentle concentration",
    description: "Use the breath as an anchor and practise returning without judging a wandering mind.",
    tags: ["attention", "breath", "ADHD"],
    color: "#2dd4bf",
    phases: [
      phase("Choose an anchor", 60, "prepare", "Find one comfortable place where breathing is easy to feel."),
      phase("Stay and notice", 240, "active", "Follow the breath and notice when attention wanders."),
      phase("Practise returning", 240, "active", "Name distractions lightly and guide attention back."),
      phase("Widen", 60, "finish", "Include the whole body and room before opening the eyes.")
    ]
  },
  {
    id: "ego",
    name: "Ego Inquiry",
    shortName: "Ego",
    icon: "spiral",
    category: "Spiritual",
    benefit: "Perspective & self-inquiry",
    description: "Examine thoughts and identity with the question: who is noticing this?",
    tags: ["advanced", "inquiry", "perspective"],
    color: "#818cf8",
    phases: [
      phase("Settle", 60, "prepare", "Let the breath become natural."),
      phase("Ask", 300, "active", "When a thought appears, ask: who is aware of this thought?"),
      phase("Rest as awareness", 180, "finish", "Drop the question and rest in simple noticing.")
    ]
  },
  {
    id: "tripp-vr",
    name: "TRIPP VR",
    shortName: "TRIPP VR",
    icon: "sparkles",
    category: "Sensory",
    benefit: "Immersive visual reset",
    description: "A launch point for your preferred TRIPP virtual-reality meditation experience.",
    tags: ["VR", "immersive", "visual"],
    color: "#c084fc",
    isVr: true,
    phases: [
      phase("Prepare headset", 60, "prepare", "Clear your play space and fit the headset comfortably."),
      phase("VR session", 600, "active", "Follow your chosen TRIPP experience."),
      phase("Reorient", 90, "finish", "Remove the headset slowly and reconnect with the room.")
    ]
  },
  {
    id: "ajna",
    name: "Ajna Chakra",
    shortName: "Ajna",
    icon: "eye",
    category: "Spiritual",
    benefit: "Clarity & inner focus",
    description: "Place gentle attention at the space between the eyebrows.",
    tags: ["third eye", "focus", "chakra"],
    color: "#6366f1",
    youtubeQuery: "ajna third eye guided meditation",
    phases: [
      phase("Centre", 60, "prepare", "Sit tall and let the face soften."),
      phase("Third-eye focus", 600, "active", "Rest attention between the eyebrows without straining the eyes."),
      phase("Ground", 60, "finish", "Feel the contact points beneath your body.")
    ]
  },
  {
    id: "urge-surfing",
    name: "Urge Surfing",
    shortName: "Urge Surfing",
    icon: "wave",
    category: "Emotional",
    benefit: "Impulse tolerance",
    description: "Ride a craving like a wave, observing it rise and fall without acting on it.",
    tags: ["craving", "impulse", "ADHD"],
    color: "#fb7185",
    youtubeQuery: "urge surfing mindfulness guided",
    phases: [
      phase("Locate", 60, "prepare", "Where does the urge show up in your body?"),
      phase("Rising", 180, "active", "Notice intensity, shape, temperature, and movement."),
      phase("Crest", 180, "active", "Allow the wave to peak without feeding or fighting it."),
      phase("Recede", 120, "finish", "Notice what changes as the wave loses energy.")
    ]
  },
  {
    id: "grounding",
    name: "Five-Sense Grounding",
    shortName: "Grounding",
    icon: "coordinates",
    category: "Emotional",
    benefit: "Return to the present",
    description: "Use the five senses and steady contact points to reconnect with the room around you.",
    tags: ["grounding", "senses", "present"],
    color: "#14b8a6",
    phases: [
      phase("See", 150, "prepare", "Notice five visible details in the room."),
      phase("Feel", 120, "active", "Find four physical contact sensations."),
      phase("Hear", 90, "active", "Listen for three distinct sounds."),
      phase("Smell and taste", 120, "active", "Notice two scents or air qualities and one taste."),
      phase("Orient", 120, "finish", "Feel the whole room and choose one gentle next action.")
    ]
  },
  {
    id: "acceptance",
    name: "Radical Acceptance",
    shortName: "Acceptance",
    icon: "circle",
    category: "Emotional",
    benefit: "Less resistance",
    description: "Make room for the present experience without approving, fixing, or judging it.",
    tags: ["anxiety", "acceptance", "calm"],
    color: "#2dd4bf",
    youtubeQuery: "radical acceptance guided meditation",
    phases: [
      phase("Notice resistance", 120, "prepare", "Find where your body says no to this moment."),
      phase("Allow", 360, "active", "Silently repeat: this is what is here right now."),
      phase("Make space", 120, "finish", "Breathe around the difficult sensation instead of into battle with it.")
    ]
  },
  {
    id: "trataka",
    name: "Trataka",
    shortName: "Candle Gaze",
    icon: "flame",
    category: "Focus",
    benefit: "Steady visual focus",
    description: "Alternate between a candle flame and its after-image to train concentration.",
    tags: ["candle", "visual", "focus"],
    color: "#f97316",
    youtubeQuery: "trataka candle gazing guided",
    phases: [
      phase("Warm up", 20, "prepare", "Sit comfortably. Keep the phone at eye level and relax your gaze."),
      phase("Gaze", 180, "active", "Look softly at the centre of the flame. Blink when you need to."),
      phase("Eyes closed", 180, "rest", "Close your eyes and notice the after-image."),
      phase("Gaze again", 180, "active", "Open your eyes and return to the flame."),
      phase("Inner flame", 180, "finish", "Close your eyes. Let the image fade naturally.")
    ]
  },
  {
    id: "maloka-vr",
    name: "Maloka VR",
    shortName: "Maloka VR",
    icon: "orbit",
    category: "Sensory",
    benefit: "Playful immersive calm",
    description: "A launch point for a preferred Maloka VR guided meditation.",
    tags: ["VR", "guided", "playful"],
    color: "#8b5cf6",
    isVr: true,
    phases: [
      phase("Prepare headset", 60, "prepare", "Clear your space and choose an experience."),
      phase("VR meditation", 600, "active", "Follow the experience and let the visuals hold your attention."),
      phase("Land", 90, "finish", "Remove the headset and name five things in the room.")
    ]
  }
];

export const MEDITATION_SKILL_MAPPING: Record<string, { primary: ZenStatId; secondary: ZenStatId }> = {
  metta: { primary: "compassion", secondary: "equanimity" },
  binaural: { primary: "focus", secondary: "calm" },
  pratyahara: { primary: "intuition", secondary: "calm" },
  nsdr: { primary: "calm", secondary: "presence" },
  "yoga-nidra": { primary: "calm", secondary: "presence" },
  "diaphragmatic-breathing": { primary: "calm", secondary: "presence" },
  frisson: { primary: "presence", secondary: "equanimity" },
  "sound-awareness": { primary: "presence", secondary: "focus" },
  "focused-attention": { primary: "focus", secondary: "discipline" },
  ego: { primary: "intuition", secondary: "presence" },
  "tripp-vr": { primary: "presence", secondary: "calm" },
  ajna: { primary: "intuition", secondary: "focus" },
  "urge-surfing": { primary: "equanimity", secondary: "discipline" },
  grounding: { primary: "presence", secondary: "calm" },
  acceptance: { primary: "equanimity", secondary: "calm" },
  trataka: { primary: "focus", secondary: "discipline" },
  "maloka-vr": { primary: "presence", secondary: "calm" }
};

const area = (x: number, y: number, rx: number, ry: number, rotate = 0): BodyArea => ({
  x,
  y,
  rx,
  ry,
  rotate
});

const stretch = (
  id: string,
  name: string,
  seconds: number,
  cue: string,
  muscleGroups: string[],
  sensationCue: string,
  bodyAreas: BodyArea[],
  sides = false,
  sensationKind: Movement["sensationKind"] = "stretch",
  image = `assets/stretches/${id}.png`
): Movement => ({
  id,
  name,
  seconds,
  cue,
  sides,
  image,
  kind: sensationKind === "working" ? "dynamic-warmup" : "static-stretch",
  sensationKind,
  muscleGroups,
  sensationCue,
  bodyAreas
});

export const STRETCHES: Movement[] = [
  stretch(
    "seated-hamstring-stretch",
    "Seated Hamstring Stretch",
    40,
    "Hinge from the hips and keep the spine long.",
    ["Hamstrings", "Calf"],
    "Along the back of the extended thigh, possibly continuing into the calf.",
    [area(47, 68, 22, 8, 2), area(22, 72, 10, 5, 2)],
    true
  ),
  stretch(
    "childs-pose",
    "Child's Pose",
    60,
    "Let your ribs widen into the back of your body.",
    ["Lower back", "Latissimus dorsi", "Glutes"],
    "Across the back and outer shoulders, with a gentle opening around the hips.",
    [area(60.4, 38, 18.9, 9, 8), area(74.5, 55, 11.3, 9, -8)]
  ),
  stretch(
    "butterfly-stretch",
    "Butterfly Stretch",
    45,
    "Let the knees fall outward without pressing them down.",
    ["Adductors", "Inner thighs"],
    "Along the inner thighs and groin, not inside the knee joints.",
    [area(33, 59.4, 16, 7, -25), area(67, 59.4, 16, 7, 25)]
  ),
  stretch(
    "cobra-pose",
    "Cobra Pose",
    30,
    "Lift through the chest and keep the shoulders away from your ears.",
    ["Abdominals", "Hip flexors", "Chest"],
    "Across the front of the torso and hips; avoid pinching in the lower back.",
    [area(29, 54, 10, 22, -15), area(21, 35, 9, 11, -10)]
  ),
  stretch(
    "deep-squat",
    "Deep Squat",
    45,
    "Keep the heels grounded or place support beneath them.",
    ["Adductors", "Glutes", "Ankles"],
    "Around the inner thighs, hips and ankles without knee pain.",
    [area(34, 67, 13, 17, -18), area(66, 67, 13, 17, 18)]
  ),
  stretch(
    "downward-facing-dog",
    "Downward-Facing Dog",
    45,
    "Bend the knees enough to lengthen your back.",
    ["Hamstrings", "Calves", "Latissimus dorsi"],
    "Along the backs of the thighs and calves, with length through the shoulders and back.",
    [area(44, 54, 24, 8, 24), area(26, 70, 14, 6, 25), area(69, 46, 18, 7, 30)]
  ),
  stretch(
    "figure-4-forward-fold",
    "Figure-4 Forward Fold",
    40,
    "Fold only until you feel a steady glute stretch.",
    ["Glutes", "Piriformis", "Outer hip"],
    "Deep in the buttock and outer hip of the crossed leg.",
    [area(77, 28, 16, 12, -10)],
    true
  ),
  stretch(
    "figure-4-stretch-supine",
    "Supine Figure-4",
    45,
    "Keep the head relaxed and draw the legs in gently.",
    ["Glutes", "Piriformis", "Outer hip"],
    "In the buttock and outer hip of the crossed leg, not in the knee.",
    [area(52, 57, 14, 12, -8)],
    true
  ),
  stretch(
    "forward-fold",
    "Forward Fold",
    40,
    "Let the head hang and soften the knees.",
    ["Hamstrings", "Calves", "Lower back"],
    "Along the backs of the thighs and calves, with gentle length through the back.",
    [area(63, 62, 16, 25, -4), area(48, 43, 13, 16, 18)]
  ),
  stretch(
    "half-kneeling-hamstring-stretch",
    "Half-Kneeling Hamstring",
    40,
    "Send the hips back with a long spine.",
    ["Hamstrings", "Calf"],
    "Along the back of the straight front thigh and possibly the calf.",
    [area(45, 68, 22, 8, 3), area(22, 72, 9, 5)],
    true
  ),
  stretch(
    "half-kneeling-quad-stretch",
    "Half-Kneeling Quad Stretch",
    35,
    "Tuck the pelvis slightly before drawing the rear foot in.",
    ["Quadriceps", "Hip flexors"],
    "Along the front of the rear thigh and hip.",
    [area(37, 61, 11, 19, 12)],
    true
  ),
  stretch(
    "high-lunge",
    "High Lunge",
    40,
    "Reach tall while pressing strongly through both feet.",
    ["Hip flexors", "Calf", "Quadriceps"],
    "Across the front of the rear hip and calf; the front leg should feel active.",
    [area(40, 60, 10, 16, -20), area(25, 75, 13, 6, -18)],
    true
  ),
  stretch(
    "kneeling-lunge-twist",
    "Kneeling Lunge Twist",
    40,
    "Rotate from the upper back and keep the front knee steady.",
    ["Hip flexors", "Thoracic spine", "Glutes"],
    "Across the front of the kneeling hip and through the upper-back rotation.",
    [area(39, 65.4, 10, 16.1, 10), area(52, 37, 15, 10.4, -16)],
    true
  ),
  stretch(
    "kneeling-lunge",
    "Kneeling Lunge",
    40,
    "Glide the hips forward without collapsing the lower back.",
    ["Hip flexors", "Quadriceps"],
    "Across the front of the hip and upper thigh of the kneeling leg.",
    [area(45, 64, 11, 18, 12)],
    true
  ),
  stretch(
    "kneeling-side-stretch",
    "Kneeling Side Stretch",
    35,
    "Create length through both sides of the waist.",
    ["Obliques", "Latissimus dorsi"],
    "Along the raised-arm side of the waist and outer torso.",
    [area(48, 42, 10, 25, 25)],
    true
  ),
  stretch(
    "lizard-stretch",
    "Lizard Stretch",
    45,
    "Use your hands or forearms and keep the breath easy.",
    ["Hip flexors", "Adductors", "Groin"],
    "Across the front of the rear hip and inner thigh of the forward leg.",
    [area(53, 61, 15, 12, -5), area(72, 62, 15, 8, 4)],
    true
  ),
  stretch(
    "low-lunge",
    "Low Lunge",
    40,
    "Let the back hip soften toward the floor.",
    ["Hip flexors", "Quadriceps"],
    "Across the front of the rear hip and upper thigh.",
    [area(40, 67, 11, 19, 15)],
    true
  ),
  stretch(
    "pigeon-stretch",
    "Pigeon Stretch",
    50,
    "Support the front hip if it does not reach the floor.",
    ["Glutes", "Piriformis", "Outer hip"],
    "Deep in the buttock and outer hip of the folded front leg.",
    [area(48, 63, 15, 13, -5)],
    true
  ),
  stretch(
    "reverse-plank",
    "Reverse Plank",
    30,
    "Press the floor away and lift through the chest.",
    ["Chest", "Front shoulders", "Hip flexors"],
    "Across the chest, fronts of the shoulders and front of the hips.",
    [area(68, 37, 13, 8, -10), area(53, 54, 13, 8, -8)]
  ),
  stretch(
    "seated-spinal-twist",
    "Seated Spinal Twist",
    40,
    "Grow taller on the inhale and rotate on the exhale.",
    ["Thoracic spine", "Glutes", "Outer hip"],
    "Through the upper and mid back, with a gentle opening at the outer hip.",
    [area(48, 39, 14, 13, -15), area(56, 64, 14, 11, 8)],
    true
  ),
  stretch(
    "side-lunge",
    "Side Lunge",
    40,
    "Sit into one hip while the other leg stays long.",
    ["Adductors", "Inner thigh", "Glutes"],
    "Along the inner thigh of the straight leg while the bent-side glute works.",
    [area(65, 49.7, 23, 5.8, 2)],
    true
  ),
  stretch(
    "sphinx-pose",
    "Sphinx Pose",
    45,
    "Draw the chest forward between the arms.",
    ["Abdominals", "Hip flexors", "Chest"],
    "Across the front of the torso; reduce the lift if the lower back pinches.",
    [area(42, 64, 15, 13, -5)]
  ),
  stretch(
    "standing-quad-stretch",
    "Standing Quad Stretch",
    35,
    "Keep the knees close and use a wall for balance.",
    ["Quadriceps", "Hip flexors"],
    "Along the front of the lifted thigh and hip.",
    [area(63, 62, 10, 20, -10)],
    true
  ),
  stretch(
    "supine-twist",
    "Supine Twist",
    45,
    "Keep both shoulders heavy as the knee lowers.",
    ["Lower back", "Glutes", "Outer hip"],
    "Across the outer hip and through a gentle lower- and mid-back rotation.",
    [area(55, 55, 14, 12, -8), area(45, 43, 15, 9, 8)],
    true
  ),
  stretch(
    "upward-facing-dog",
    "Upward-Facing Dog",
    30,
    "Press through the hands and lift the thighs if comfortable.",
    ["Abdominals", "Hip flexors", "Chest"],
    "Across the front of the torso and hips, never as sharp lower-back pain.",
    [area(31, 58, 10, 20, -15)]
  ),
  stretch(
    "mountain-pose",
    "Mountain Pose",
    30,
    "Stand tall with the feet grounded, ribs stacked over the pelvis, and shoulders relaxed.",
    ["Feet", "Core", "Glutes"],
    "A steady, active feeling through the feet and trunk rather than a stretch.",
    [area(49, 53, 12, 24), area(37, 83, 8, 8), area(63, 83, 8, 8)],
    false,
    "working",
    "assets/stretches/mountain-pose.png"
  ),
  stretch(
    "upward-salute",
    "Upward Salute",
    20,
    "Reach overhead without flaring the ribs; keep the neck long and the shoulders soft.",
    ["Shoulders", "Abdominals", "Upper back"],
    "Along the sides of the body and through the shoulders as you reach upward.",
    [area(49, 38, 20, 10), area(37, 25, 7, 15), area(63, 25, 7, 15)],
    false,
    "stretch",
    "assets/stretches/upward-salute.png"
  ),
  stretch(
    "halfway-lift",
    "Halfway Lift",
    20,
    "Lengthen the spine forward and keep the knees softly bent as needed.",
    ["Hamstrings", "Lower back", "Core"],
    "Along the backs of the legs and through the length of the spine, without rounding to reach lower.",
    [area(58, 57, 20, 10, -8), area(43, 42, 15, 10, 15)],
    false,
    "stretch",
    "assets/stretches/halfway-lift.png"
  ),
  stretch(
    "plank-pose",
    "Plank Pose",
    30,
    "Press the floor away, keep the body in one long line, and brace gently through the center.",
    ["Core", "Chest", "Shoulders", "Glutes"],
    "A whole-body working sensation, especially through the trunk and shoulders; avoid sagging in the lower back.",
    [area(50, 49, 29, 9, 8), area(73, 42, 10, 9), area(28, 57, 10, 8)],
    false,
    "working",
    "assets/stretches/plank-pose.png"
  ),
  stretch(
    "chaturanga",
    "Four-Limbed Staff Pose",
    20,
    "Lower only as far as you can control while keeping the elbows close and the shoulders above the wrists.",
    ["Chest", "Triceps", "Shoulders", "Core"],
    "A strong working sensation in the chest, arms and core; stop before the shoulders drop below the elbows.",
    [area(53, 46, 24, 9, 7), area(74, 49, 8, 11), area(29, 57, 9, 7)],
    false,
    "working",
    "assets/stretches/chaturanga.png"
  ),
  stretch(
    "cat-cow",
    "Cat-Cow",
    45,
    "Move slowly between rounding and lengthening the spine, following the breath rather than forcing the range.",
    ["Spinal extensors", "Abdominals", "Shoulders"],
    "A comfortable moving sensation through the whole spine, not a pinching feeling in the lower back.",
    [area(51, 48, 27, 10, 4), area(40, 61, 12, 8)],
    false,
    "working",
    "assets/stretches/cat-cow.png"
  ),
  stretch(
    "chair-pose",
    "Chair Pose",
    30,
    "Sit the hips back as if toward a chair and keep the knees tracking in line with the toes.",
    ["Quadriceps", "Glutes", "Core"],
    "A strong, steady working sensation in the thighs and buttocks without knee pain.",
    [area(39, 64, 12, 18, -10), area(62, 64, 12, 18, 10), area(50, 45, 13, 9)],
    false,
    "working",
    "assets/stretches/chair-pose.png"
  ),
  stretch(
    "warrior-i",
    "Warrior I",
    30,
    "Square the hips as comfortably as possible, bend the front knee, and reach up through the arms.",
    ["Quadriceps", "Glutes", "Hip flexors", "Shoulders"],
    "Through the front thigh and the front of the rear hip, with the shoulders working overhead.",
    [area(37, 63, 11, 19, -12), area(64, 68, 10, 19, 12), area(49, 28, 17, 8)],
    true,
    "working",
    "assets/stretches/warrior-i.png"
  ),
  stretch(
    "warrior-ii",
    "Warrior II",
    30,
    "Open the hips and arms wide while keeping the front knee tracking toward the second toe.",
    ["Quadriceps", "Glutes", "Adductors", "Shoulders"],
    "In the front thigh and inner thigh, with active reaching through both arms.",
    [area(36, 66, 12, 19, -15), area(66, 67, 12, 18, 15), area(50, 38, 28, 7)],
    true,
    "working",
    "assets/stretches/warrior-ii.png"
  ),
  stretch(
    "triangle-pose",
    "Triangle Pose",
    30,
    "Lengthen both sides of the waist and hinge from the hip rather than collapsing into the lower hand.",
    ["Hamstrings", "Adductors", "Obliques"],
    "Along the inner thigh and side body, with length through the hamstrings.",
    [area(40, 66, 22, 7, -12), area(70, 46, 14, 8, -28), area(51, 39, 8, 22, 20)],
    true,
    "stretch",
    "assets/stretches/triangle-pose.png"
  ),
  stretch(
    "bridge-pose",
    "Bridge Pose",
    30,
    "Press through the feet, lift the hips gently, and keep the knees pointing forward.",
    ["Glutes", "Hamstrings", "Hip flexors", "Chest"],
    "Across the front of the hips and chest, with the glutes and backs of the legs working.",
    [area(53, 56, 24, 9, -5), area(39, 72, 11, 9, 10), area(67, 72, 11, 9, -10)],
    false,
    "working",
    "assets/stretches/bridge-pose.png"
  ),
  stretch(
    "boat-pose",
    "Boat Pose",
    25,
    "Lift through the chest and keep the spine long; bend the knees or lower the feet for control.",
    ["Abdominals", "Hip flexors", "Quadriceps"],
    "A focused working sensation through the center and front of the hips, never sharp low-back pain.",
    [area(50, 49, 14, 18, -8), area(36, 69, 9, 15, -24), area(65, 69, 9, 15, 24)],
    false,
    "working",
    "assets/stretches/boat-pose.png"
  ),
  stretch(
    "tree-pose",
    "Tree Pose",
    30,
    "Press the standing foot into the floor and place the other foot above or below the knee.",
    ["Feet", "Glutes", "Core"],
    "A steady working sensation in the standing leg and side of the hip; use a wall for balance.",
    [area(39, 68, 10, 19, -5), area(48, 46, 12, 19), area(52, 31, 10, 8)],
    true,
    "working",
    "assets/stretches/tree-pose.png"
  ),
  stretch(
    "corpse-pose",
    "Corpse Pose",
    60,
    "Lie comfortably on your back, let the arms and legs rest, and allow the breath to settle.",
    ["Whole body"],
    "A quiet release through the whole body rather than an active stretch.",
    [area(50, 50, 32, 18)],
    false,
    "stretch",
    "assets/stretches/corpse-pose.png"
  )
];

export const MARKS_FLOW_IDS = [
  "childs-pose",
  "downward-facing-dog",
  "low-lunge",
  "half-kneeling-hamstring-stretch",
  "high-lunge",
  "forward-fold",
  "deep-squat",
  "butterfly-stretch",
  "seated-spinal-twist",
  "supine-twist"
];

export const MARKS_FLOW = MARKS_FLOW_IDS.map((id) => STRETCHES.find((item) => item.id === id)!);

export const SUN_SALUTATION_IDS = [
  "mountain-pose",
  "upward-salute",
  "forward-fold",
  "halfway-lift",
  "plank-pose",
  "chaturanga",
  "upward-facing-dog",
  "downward-facing-dog",
  "halfway-lift",
  "forward-fold",
  "mountain-pose"
] as const;

const warmupMovement = (
  id: string,
  name: string,
  seconds: number,
  cue: string,
  muscleGroups: string[],
  sensationCue: string,
  bodyAreas: BodyArea[],
  kind: Movement["kind"] = "dynamic-warmup"
): Movement => ({
  id,
  name,
  seconds,
  cue,
  image: `assets/stretches/generated/${id}.png`,
  kind,
  sensationKind: "working",
  muscleGroups,
  sensationCue,
  bodyAreas
});

export const ROUTINE_ONLY_MOVEMENTS: Movement[] = [
  warmupMovement(
    "brisk-walk-jog",
    "Brisk Walk or Gentle Jog",
    300,
    "Build gradually to a pace that feels warm but easy.",
    ["Calves", "Quadriceps", "Hamstrings", "Glutes"],
    "Your legs should feel progressively warmer; this is not a held stretch.",
    [area(43, 62, 10, 20, -10), area(62, 62, 10, 20, 10)]
  ),
  warmupMovement(
    "heel-digs",
    "Alternating Heel Digs",
    60,
    "Place each heel forward with the toes up and keep the supporting knee soft.",
    ["Hamstrings", "Calves", "Quadriceps"],
    "A light warming movement through the backs and fronts of the legs.",
    [area(39, 65, 10, 20, -8), area(62, 65, 10, 20, 8)]
  ),
  warmupMovement(
    "knee-lifts",
    "Alternating Knee Lifts",
    30,
    "Stand tall and lift alternate knees toward your hands while keeping your trunk steady.",
    ["Hip flexors", "Core", "Glutes"],
    "The front of the lifting hip and trunk should feel active.",
    [area(49, 48, 13, 16), area(54, 66, 11, 14, -10)]
  ),
  warmupMovement(
    "knee-bends",
    "Shallow Knee Bends",
    45,
    "Keep the knees tracking with the toes and lower only a short distance.",
    ["Quadriceps", "Glutes", "Calves"],
    "The thighs and buttocks should feel active without knee pain.",
    [area(42, 67, 11, 18, -5), area(60, 67, 11, 18, 5)]
  ),
  {
    id: "wall-calf-stretch",
    name: "Wall Calf Stretch",
    image: "assets/stretches/generated/wall-calf-stretch.png",
    seconds: 20,
    sides: true,
    cue: "Keep the back heel down and point both feet forward.",
    kind: "static-stretch",
    sensationKind: "stretch",
    muscleGroups: ["Gastrocnemius", "Soleus", "Achilles region"],
    sensationCue: "Through the calf of the straight rear leg and toward the heel.",
    bodyAreas: [area(35, 70, 10, 19, -12)]
  },
  warmupMovement(
    "indoor-cycling",
    "Indoor Cycling",
    300,
    "Sit comfortably and begin with light resistance.",
    ["Quadriceps", "Glutes", "Hamstrings", "Calves", "Core"],
    "The legs should feel progressively warm and engaged, not strained.",
    [area(42, 63, 11, 18, 25), area(59, 67, 11, 18, -22)],
    "cardio"
  )
];

export const MOVEMENTS: Movement[] = [...STRETCHES, ...ROUTINE_ONLY_MOVEMENTS];
const MOVEMENT_BY_ID = new Map(MOVEMENTS.map((movement) => [movement.id, movement]));

export const YOGA_TRANSITION_SECONDS = 5;

export const YOGA_CLASSES: YogaClass[] = [
  {
    id: "sun-salutation",
    name: "Sun Salutation",
    timing: "Morning or warm-up",
    description: "A breath-led Sun Salutation class with each transition guided by Mark.",
    evidence:
      "A progressive movement sequence. Keep the range comfortable, use knees-down options when needed, and treat the flow as a warm-up rather than a test of depth.",
    sourceUrl: "https://orthoinfo.aaos.org/en/staying-healthy/warm-up-cool-down-and-be-flexible/",
    focusMuscles: ["Shoulders", "Core", "Hips", "Hamstrings", "Whole body"],
    image: "assets/stretches/sun-salutation-flow.png",
    steps: SUN_SALUTATION_IDS.map((movementId) => ({ movementId, seconds: 20 }))
  },
  {
    id: "daily-reset",
    name: "Daily Reset",
    timing: "Any time",
    description: "A calm, floor-to-standing-to-floor whole-body class with Mark.",
    evidence:
      "A gentle flexibility and mobility sequence. Move within a comfortable range; stretching should feel steady, never sharp.",
    sourceUrl: "https://orthoinfo.aaos.org/en/staying-healthy/warm-up-cool-down-and-be-flexible/",
    focusMuscles: ["Hips", "Hamstrings", "Back", "Shoulders"],
    image: "assets/stretches/sun-salutation-flow.png",
    steps: MARKS_FLOW_IDS.map((movementId) => ({ movementId, seconds: 30 }))
  },
  {
    id: "before-run",
    name: "Before Running",
    timing: "Before running",
    description: "A short standing sequence that gradually warms the legs used while running.",
    evidence:
      "Based on NHS guidance to warm up with controlled knee bends, knee lifts and heel digs before more vigorous exercise.",
    sourceUrl: "https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/",
    focusMuscles: ["Calves", "Quadriceps", "Hamstrings", "Glutes", "Hip flexors"],
    image: "assets/stretches/generated/knee-lifts.png",
    steps: [
      { movementId: "knee-bends", seconds: 30 },
      { movementId: "knee-lifts", seconds: 30 },
      { movementId: "heel-digs", seconds: 30 },
      { movementId: "high-lunge", seconds: 30 },
      { movementId: "side-lunge", seconds: 30 }
    ]
  },
  {
    id: "before-cycling",
    name: "Before Cycling",
    timing: "Before indoor cycling",
    description: "A compact off-bike preparation for hips, thighs and knees before an easy spin.",
    evidence:
      "British Cycling recommends building intensity progressively on the bike. Use this class before, not instead of, an easy progressive on-bike warm-up.",
    sourceUrl: "https://www.britishcycling.org.uk/knowledge/article/izn20140115-Intermediate-Warming-Up-and-Cooling-Down-0",
    focusMuscles: ["Quadriceps", "Hip flexors", "Glutes", "Calves"],
    image: "assets/stretches/generated/indoor-cycling.png",
    steps: [
      { movementId: "knee-bends", seconds: 30 },
      { movementId: "standing-quad-stretch", seconds: 20 },
      { movementId: "high-lunge", seconds: 20 },
      { movementId: "kneeling-lunge", seconds: 25 },
      { movementId: "half-kneeling-quad-stretch", seconds: 20 }
    ]
  },
  {
    id: "after-run",
    name: "After Running",
    timing: "After running",
    description: "A gentle lower-body sequence after your breathing has begun to settle.",
    evidence:
      "Based on NHS post-exercise guidance for the calves, quadriceps, hamstrings, inner thighs and buttocks.",
    sourceUrl: "https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/",
    focusMuscles: ["Calves", "Quadriceps", "Hamstrings", "Inner thighs", "Glutes"],
    image: "assets/stretches/generated/wall-calf-stretch.png",
    steps: [
      { movementId: "wall-calf-stretch", seconds: 25 },
      { movementId: "standing-quad-stretch", seconds: 25 },
      { movementId: "half-kneeling-hamstring-stretch", seconds: 30 },
      { movementId: "butterfly-stretch", seconds: 30 },
      { movementId: "figure-4-stretch-supine", seconds: 30 }
    ]
  },
  {
    id: "after-cycling",
    name: "After Cycling",
    timing: "After indoor cycling",
    description: "Move gradually from standing to kneeling and then down to the floor after an easy spin.",
    evidence:
      "Based on British Cycling guidance to cool down progressively and restore movement around the hamstrings, hip flexors, glutes and back.",
    sourceUrl: "https://www.britishcycling.org.uk/knowledge/bike-kit/set-up/article/20251022-Set-up-Why-a-bike-fit-is-essential-for-indoor-training-0",
    focusMuscles: ["Quadriceps", "Hip flexors", "Hamstrings", "Glutes", "Back"],
    image: "assets/stretches/kneeling-lunge.png",
    steps: [
      { movementId: "standing-quad-stretch", seconds: 30 },
      { movementId: "kneeling-lunge", seconds: 30 },
      { movementId: "half-kneeling-quad-stretch", seconds: 30 },
      { movementId: "childs-pose", seconds: 30 },
      { movementId: "seated-hamstring-stretch", seconds: 30 },
      { movementId: "figure-4-stretch-supine", seconds: 30 },
      { movementId: "supine-twist", seconds: 30 }
    ]
  },
  {
    id: "back-and-shoulders",
    name: "Back & Shoulders",
    timing: "After desk time or stress",
    description: "A smooth kneeling-to-floor class for a back and shoulders that feel held or stiff.",
    evidence:
      "Gentle movement can help ordinary stiffness. Keep the range comfortable and stop if symptoms worsen or pain travels, tingles or feels sharp.",
    sourceUrl: "https://www.nhs.uk/conditions/back-pain/",
    focusMuscles: ["Latissimus dorsi", "Obliques", "Shoulders", "Thoracic spine", "Lower back"],
    image: "assets/stretches/childs-pose.png",
    steps: [
      { movementId: "kneeling-side-stretch", seconds: 30 },
      { movementId: "childs-pose", seconds: 30 },
      { movementId: "downward-facing-dog", seconds: 30 },
      { movementId: "sphinx-pose", seconds: 30 },
      { movementId: "seated-spinal-twist", seconds: 30 },
      { movementId: "supine-twist", seconds: 30 }
    ]
  },
  {
    id: "gentle-leg-recovery",
    name: "Gentle Leg Recovery",
    timing: "For mild, recovering soreness",
    description: "A cautious floor-based class for legs that are recovering and ready for gentle movement.",
    evidence:
      "NHS guidance recommends protecting and resting a new sprain or strain initially, then resuming movement only when pain does not stop you. This is not for an acute injury.",
    sourceUrl: "https://www.nhs.uk/conditions/sprains-and-strains/",
    focusMuscles: ["Calves", "Hamstrings", "Inner thighs", "Glutes"],
    image: "assets/stretches/figure-4-stretch-supine.png",
    safetyGate: true,
    steps: [
      { movementId: "wall-calf-stretch", seconds: 20 },
      { movementId: "seated-hamstring-stretch", seconds: 20 },
      { movementId: "butterfly-stretch", seconds: 20 },
      { movementId: "figure-4-stretch-supine", seconds: 25 }
    ]
  }
];

export const getYogaClass = (classId: string) =>
  YOGA_CLASSES.find((yogaClass) => yogaClass.id === classId) ?? YOGA_CLASSES[0];

export const expandYogaClassSlides = (yogaClass: YogaClass): YogaClassSlide[] => {
  const rawSlides: Array<Omit<YogaClassSlide, "stepNumber" | "totalSteps">> =
    yogaClass.steps.flatMap((step) => {
      const movement = MOVEMENT_BY_ID.get(step.movementId);
      if (!movement) throw new Error(`Unknown yoga movement: ${step.movementId}`);
      const base = {
        movement,
        seconds: step.seconds ?? movement.seconds,
        cue: step.cue ?? movement.cue,
        label: step.label
      };
      return movement.sides
        ? [{ ...base, side: 1 as const }, { ...base, side: 2 as const }]
        : [base];
    });
  return rawSlides.map((slide, index) => ({
    ...slide,
    stepNumber: index + 1,
    totalSteps: rawSlides.length
  }));
};

export const getYogaClassDuration = (yogaClass: YogaClass) => {
  const slides = expandYogaClassSlides(yogaClass);
  return (
    slides.reduce((total, slide) => total + slide.seconds, 0) +
    Math.max(0, slides.length - 1) * YOGA_TRANSITION_SECONDS
  );
};

export const validateYogaClasses = () => {
  const errors: string[] = [];
  for (const yogaClass of YOGA_CLASSES) {
    let slides: YogaClassSlide[] = [];
    try {
      slides = expandYogaClassSlides(yogaClass);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const slide of slides) {
      if (slide.seconds > 30) {
        errors.push(`${yogaClass.id}/${slide.movement.id} exceeds 30 seconds`);
      }
      if (!slide.movement.muscleGroups.length || !slide.movement.sensationCue) {
        errors.push(`${slide.movement.id} is missing muscle guidance`);
      }
      if (!slide.movement.bodyAreas.length) {
        errors.push(`${slide.movement.id} is missing an anatomy overlay`);
      }
    }
    for (const step of yogaClass.steps) {
      const movement = MOVEMENT_BY_ID.get(step.movementId);
      if (!movement?.sides) continue;
      const expandedCount = slides.filter(
        (slide) => slide.movement.id === step.movementId && slide.side
      ).length;
      const repeatedSteps = yogaClass.steps.filter(
        (candidate) => candidate.movementId === step.movementId
      ).length;
      if (expandedCount !== repeatedSteps * 2) {
        errors.push(`${yogaClass.id}/${step.movementId} did not expand to two sides`);
      }
    }
  }
  return errors;
};

export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2500, 5000, 10000];
