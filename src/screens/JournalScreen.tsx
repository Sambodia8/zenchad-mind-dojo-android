import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { BookOpen, CalendarDays, Clock3, Download, FileUp, Mic, MoreVertical, Plus, Save, Sparkles, Square, Trash2 } from "lucide-react";
import { MEDITATIONS } from "../data";
import { completeMysteryJournal } from "../mysteryChallenge";
import {
  deleteWhisperJournalRecording,
  cancelWhisperJournalDownload,
  cancelQwenJournalDownload,
  downloadWhisperJournalModel,
  downloadQwenJournalModel,
  generateQwenJournalDraft,
  getQwenJournalStatus,
  getWhisperJournalStatus,
  keepScreenAwake,
  allowScreenSleep,
  startWhisperJournalRecording,
  stopWhisperJournalRecording,
  transcribeWhisperJournalRecording,
  isNativeAndroid
} from "../native";
import { addJournalXp, importJournalText, makeJournal, recordMeditationCompletion } from "../storage";
import type { AppData, JournalEntry } from "../types";
import { meditationIdForName } from "../progression";

interface Props {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  draftMeditation?: string;
  mysteryRunId?: string;
}

type EditorMode = "journal" | "meditation" | null;

const QWEN_NEAT_DRAFT_PROMPT = `Edit this spoken reflection into a clear, natural journal draft.

Write in the speaker's first-person voice using natural British English. Keep the original meaning, order of events, uncertainty, reported feelings and distinctive details. Present thoughts about another person as the speaker's perspective, and present that person's feelings as what they communicated.

Remove speech filler, false starts, transcription clutter and repeated wording. Arrange the result into readable paragraphs. Let the amount of detail and the length of the draft follow the source recording naturally. The draft should contain only information from the transcript.

Return valid JSON with exactly these fields:
{
  "title": "A concise title grounded in the reflection",
  "body": "The edited first-person journal draft"
}

Raw transcript:
`;

function dateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

function cleanWhisperTranscript(transcript: string) {
  return transcript
    .replace(/\[(?:blank[_ ]audio|silence|inaudible|music)\]/gi, "")
    .replace(/(?:\s*[[(]?\s*blank[_ ]audio\s*[\])]?[.!]?\s*)+$/gi, "")
    .replace(/^[ \t]*(?:silence|inaudible)[.!]?[ \t]*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function JournalScreen({ data, setData, draftMeditation, mysteryRunId }: Props) {
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [meditationLabel, setMeditationLabel] = useState("");
  const [selectedMeditation, setSelectedMeditation] = useState("");
  const [customPractice, setCustomPractice] = useState("");
  const [practiceSource, setPracticeSource] = useState("TRIPP");
  const [durationMinutes, setDurationMinutes] = useState("10");
  const [practiceDate, setPracticeDate] = useState(dateInputValue());
  const [importMessage, setImportMessage] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [whisperModelInstalled, setWhisperModelInstalled] = useState(false);
  const [whisperDownloadStatus, setWhisperDownloadStatus] = useState<"none" | "pending" | "running" | "paused" | "successful" | "failed">("none");
  const [whisperDownloadBytes, setWhisperDownloadBytes] = useState(0);
  const [whisperDownloadTotalBytes, setWhisperDownloadTotalBytes] = useState(0);
  const [whisperDownloadBusy, setWhisperDownloadBusy] = useState(false);
  const [qwenModelInstalled, setQwenModelInstalled] = useState(false);
  const [qwenDownloadStatus, setQwenDownloadStatus] = useState<"none" | "pending" | "running" | "paused" | "successful" | "failed">("none");
  const [qwenDownloadBytes, setQwenDownloadBytes] = useState(0);
  const [qwenDownloadTotalBytes, setQwenDownloadTotalBytes] = useState(0);
  const [qwenDownloadBusy, setQwenDownloadBusy] = useState(false);
  const [qwenBusy, setQwenBusy] = useState(false);
  const [qwenMessage, setQwenMessage] = useState("");
  const [rawDraftForRestore, setRawDraftForRestore] = useState<string | null>(null);
  const [journalMenuOpen, setJournalMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const journalMenuRef = useRef<HTMLDivElement>(null);
  const mysteryJournalSavedRef = useRef<string | null>(null);

  const voiceErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "The voice reflection could not be completed.";

  useEffect(() => {
    if (!draftMeditation) return;
    setEditorMode("journal");
    setTitle(`Reflection after ${draftMeditation}`);
    setMeditationLabel(draftMeditation);
    setBody("");
  }, [draftMeditation]);

  useEffect(() => {
    if (!journalMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!journalMenuRef.current?.contains(event.target as Node)) setJournalMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [journalMenuOpen]);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    let active = true;
    const refresh = async () => {
      try {
        const [whisperStatus, qwenStatus] = await Promise.all([
          getWhisperJournalStatus(),
          getQwenJournalStatus()
        ]);
        if (!active) return;
        setWhisperModelInstalled(whisperStatus.modelInstalled);
        setWhisperDownloadStatus(whisperStatus.downloadStatus);
        setWhisperDownloadBytes(whisperStatus.downloadBytes);
        setWhisperDownloadTotalBytes(whisperStatus.downloadTotalBytes);
        setQwenModelInstalled(qwenStatus.modelInstalled);
        setQwenDownloadStatus(qwenStatus.downloadStatus);
        setQwenDownloadBytes(qwenStatus.downloadBytes);
        setQwenDownloadTotalBytes(qwenStatus.downloadTotalBytes);
      } catch {
        // The model controls remain hidden on platforms without the native plugin.
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const openJournalEditor = () => {
    setEditorMode("journal");
    setTitle("");
    setMeditationLabel("");
    setBody("");
    setRawDraftForRestore(null);
  };

  const openMeditationLogger = () => {
    setEditorMode("meditation");
    setSelectedMeditation("");
    setCustomPractice("");
    setPracticeSource("TRIPP");
    setDurationMinutes("10");
    setPracticeDate(dateInputValue());
    setBody("");
  };

  const closeEditor = () => {
    setEditorMode(null);
    setTitle("");
    setBody("");
    setMeditationLabel("");
    setRawDraftForRestore(null);
  };

  const saveEntry = () => {
    const cleanBody = body.trim();
    if (!cleanBody) return;
    if (mysteryRunId && mysteryJournalSavedRef.current === mysteryRunId) return;
    const linkedMeditation = meditationLabel.trim() || undefined;
    const entry = makeJournal(
      title.trim() || (linkedMeditation ? "Post-session reflection" : "Journal entry"),
      cleanBody,
      linkedMeditation,
      linkedMeditation ? "meditation" : "journal"
    );
    if (mysteryRunId) mysteryJournalSavedRef.current = mysteryRunId;
    setData((current) => {
      const next = {
        ...current,
        stats: addJournalXp(current.stats),
        journal: [entry, ...current.journal]
      };
      if (mysteryRunId) {
        next.mysteryChallenge = completeMysteryJournal(current.mysteryChallenge, mysteryRunId, entry.id);
      }
      return next;
    });
    setImportMessage(mysteryRunId ? "The reflection is sealed. +20 XP" : "Journal saved. +20 XP");
    closeEditor();
  };

  const saveMeditationLog = () => {
    const builtIn = MEDITATIONS.find((item) => item.id === selectedMeditation)?.name;
    const practiceName = builtIn || customPractice.trim();
    const minutes = Number(durationMinutes);
    if (!practiceName || !Number.isFinite(minutes) || minutes < 1 || minutes > 600 || !practiceDate) return;

    const sessionDate = new Date(`${practiceDate}T12:00:00`);
    const cleanBody = body.trim();
    const meditationId = meditationIdForName(practiceName);
    setData((current) => {
      const completed = recordMeditationCompletion(current, meditationId ?? "", Math.round(minutes * 60), sessionDate);
      return {
      ...completed,
      stats: addJournalXp(completed.stats, cleanBody ? 1 : 0),
      journal: cleanBody
        ? [
            makeJournal(
              title.trim() || `${practiceName} reflection`,
              cleanBody,
              `${practiceName} · ${practiceSource}`,
              "meditation",
              sessionDate.toISOString()
            ),
            ...current.journal
          ]
        : current.journal
      };
    });
    setImportMessage(
      `Meditation logged. +${50 + Math.max(1, Math.floor((minutes * 60) / 6))} XP${cleanBody ? " · journal +20 XP" : ""}`
    );
    closeEditor();
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const entries = importJournalText(await file.text());
    if (entries.length) {
      setData((current) => ({
        ...current,
        stats: addJournalXp(current.stats, entries.length),
        journal: [...entries, ...current.journal]
      }));
      setImportMessage(`${entries.length} reflection${entries.length === 1 ? "" : "s"} imported. +${entries.length * 20} XP`);
    } else {
      setImportMessage("No readable reflections found in that file.");
    }
    event.target.value = "";
  };

  const importBundledHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("assets/imports/meditation-journal-history.json");
      if (!response.ok) throw new Error("history unavailable");
      const rows = (await response.json()) as Array<Pick<JournalEntry, "title" | "body" | "createdAt">>;
      setData((current) => {
        const fresh = rows
          .filter((row) => !current.journal.some((entry) => entry.title === row.title && entry.createdAt === row.createdAt))
          .map((row) => makeJournal(row.title, row.body, "Historical meditation", "meditation", row.createdAt, "imported"));
        return fresh.length
          ? { ...current, stats: addJournalXp(current.stats, fresh.length), journal: [...fresh, ...current.journal] }
          : current;
      });
      setImportMessage("Supplied meditation history added. Journal XP collected.");
    } catch {
      setImportMessage("The supplied journal history is not available in this build yet.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportJournal = () => {
    const blob = new Blob([JSON.stringify(data.journal, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zenchad-journal-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const prepareVoiceEditor = () => {
    if (!editorMode) {
      setEditorMode("journal");
      setMeditationLabel("");
    }
  };

  const transcribeAndAppend = async (messagePrefix = "Whisper is transcribing on this phone. Nothing is being uploaded.") => {
    setVoiceMessage(messagePrefix);
    const result = await transcribeWhisperJournalRecording();
    const transcript = cleanWhisperTranscript(result.transcript);
    if (transcript) {
      if (editorMode !== "meditation") {
        setTitle((current) => current.trim() ? current : "Post-session voice reflection");
      }
      setRawDraftForRestore(null);
      setBody((current) => current.trimEnd() ? `${current.trimEnd()}\n\n${transcript}` : transcript);
    }
    await deleteWhisperJournalRecording();
    setVoiceMessage(transcript
      ? `Offline transcription finished in ${(result.elapsedMs / 1000).toFixed(1)} seconds and was added to your draft.`
      : "No clear speech was found in that recording. Your existing draft has not been changed.");
  };

  const organizeWithQwen = async () => {
    const source = body.trim();
    if (!source || !qwenModelInstalled) return;
    setQwenBusy(true);
    setQwenMessage("Qwen 4B is creating an editable neat draft on this phone...");
    try {
      const result = await generateQwenJournalDraft(`${QWEN_NEAT_DRAFT_PROMPT}\n${source}`, 700);
      const raw = result.output.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      const parsed = JSON.parse(firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw) as { title?: unknown; body?: unknown };
      if (typeof parsed.body !== "string" || !parsed.body.trim()) throw new Error("Qwen returned an empty draft.");
      setRawDraftForRestore(source);
      setBody(parsed.body.trim());
      if (typeof parsed.title === "string" && parsed.title.trim()) setTitle(parsed.title.trim());
      setQwenMessage(`Neat draft created offline in ${(result.elapsedMs / 1000).toFixed(1)} seconds. Review it before saving.`);
    } catch (error) {
      setQwenMessage(error instanceof Error ? error.message : "Qwen could not create the neat draft.");
    } finally {
      setQwenBusy(false);
    }
  };

  const restoreRawDraft = () => {
    if (rawDraftForRestore === null) return;
    setBody(rawDraftForRestore);
    setRawDraftForRestore(null);
    setQwenMessage("The raw Whisper transcript has been restored.");
  };

  const startWhisperDownload = async () => {
    setWhisperDownloadBusy(true);
    setVoiceMessage("Starting the one-time Whisper download. Android will continue it in the background over Wi-Fi.");
    try {
      const status = await downloadWhisperJournalModel();
      setWhisperModelInstalled(status.modelInstalled);
      setWhisperDownloadStatus(status.downloadStatus);
      setWhisperDownloadBytes(status.downloadBytes);
      setWhisperDownloadTotalBytes(status.downloadTotalBytes);
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "The Whisper model download could not start.");
    } finally {
      setWhisperDownloadBusy(false);
    }
  };

  const cancelWhisperDownload = async () => {
    setWhisperDownloadBusy(true);
    try {
      const status = await cancelWhisperJournalDownload();
      setWhisperDownloadStatus(status.downloadStatus);
      setWhisperDownloadBytes(status.downloadBytes);
      setWhisperDownloadTotalBytes(status.downloadTotalBytes);
      setVoiceMessage("The Whisper download was cancelled. You can start it again later.");
    } catch (error) {
      setVoiceMessage(error instanceof Error ? error.message : "The Whisper model download could not be cancelled.");
    } finally {
      setWhisperDownloadBusy(false);
    }
  };

  const startQwenDownload = async () => {
    setQwenDownloadBusy(true);
    setQwenMessage("Starting the one-time Qwen 4B download. Android will continue it in the background over Wi-Fi.");
    try {
      const status = await downloadQwenJournalModel();
      setQwenModelInstalled(status.modelInstalled);
      setQwenDownloadStatus(status.downloadStatus);
      setQwenDownloadBytes(status.downloadBytes);
      setQwenDownloadTotalBytes(status.downloadTotalBytes);
    } catch (error) {
      setQwenMessage(error instanceof Error ? error.message : "The Qwen model download could not start.");
    } finally {
      setQwenDownloadBusy(false);
    }
  };

  const cancelQwenDownload = async () => {
    setQwenDownloadBusy(true);
    try {
      const status = await cancelQwenJournalDownload();
      setQwenDownloadStatus(status.downloadStatus);
      setQwenDownloadBytes(status.downloadBytes);
      setQwenDownloadTotalBytes(status.downloadTotalBytes);
      setQwenMessage("The Qwen 4B download was cancelled. You can resume it later.");
    } catch (error) {
      setQwenMessage(error instanceof Error ? error.message : "The Qwen model download could not be cancelled.");
    } finally {
      setQwenDownloadBusy(false);
    }
  };

  const startVoiceReflection = async () => {
    setVoiceBusy(true);
    setVoiceMessage("Checking the offline Whisper model...");
    try {
      const status = await getWhisperJournalStatus();
      if (!status.modelInstalled) {
        setVoiceMessage("Download the offline Whisper model first. It is about 57 MB and is kept between app updates.");
        return;
      }
      prepareVoiceEditor();
      await keepScreenAwake();
      if (status.recording) {
        setVoiceRecording(true);
        setVoiceMessage("This voice reflection is still recording locally. Tap Stop & transcribe when you finish.");
        return;
      }
      if (status.recordingBytes >= 3200) {
        await transcribeAndAppend("Recovering the last unfinished voice reflection on this phone...");
        await allowScreenSleep();
        return;
      }
      await startWhisperJournalRecording();
      setVoiceRecording(true);
      setVoiceMessage("Listening locally. Five minutes or longer is fine; tap Stop & transcribe when you finish.");
    } catch (error) {
      setVoiceMessage(voiceErrorMessage(error));
      await allowScreenSleep();
    } finally {
      setVoiceBusy(false);
    }
  };

  const stopVoiceReflection = async () => {
    setVoiceBusy(true);
    setVoiceMessage("Finishing the recording...");
    try {
      await stopWhisperJournalRecording();
      setVoiceRecording(false);
      await transcribeAndAppend();
    } catch (error) {
      setVoiceRecording(false);
      setVoiceMessage(voiceErrorMessage(error));
    } finally {
      await allowScreenSleep();
      setVoiceBusy(false);
    }
  };

  return (
    <div className="screen-stack">
      <section className="page-intro">
        <span className="eyebrow">Meditation journal</span>
        <h1>Notice what changed</h1>
        <p>Log practices from anywhere, then keep the reflection that matters.</p>
      </section>

      <div className="journal-actions">
        <button className="button primary" onClick={openMeditationLogger}>
          <Clock3 size={18} /> Log meditation
        </button>
        <button className="button secondary" onClick={openJournalEditor}>
          <Plus size={18} /> New journal
        </button>
        {voiceRecording ? (
          <button className="button secondary" onClick={stopVoiceReflection} disabled={voiceBusy}>
            <Square size={17} /> Stop & transcribe
          </button>
        ) : (
          <button className="button secondary" onClick={startVoiceReflection} disabled={voiceBusy}>
            <Mic size={18} /> Voice reflection
          </button>
        )}
        {isNativeAndroid() && (
          <>
            <button
              className="button secondary"
              onClick={() => void startWhisperDownload()}
              disabled={whisperModelInstalled || whisperDownloadBusy || ["pending", "running", "paused"].includes(whisperDownloadStatus)}
            >
              <Download size={18} /> {whisperModelInstalled ? "Whisper ready" : "Download Whisper"}
            </button>
            {["pending", "running", "paused"].includes(whisperDownloadStatus) && (
              <button className="button ghost" onClick={() => void cancelWhisperDownload()} disabled={whisperDownloadBusy}>Cancel Whisper download</button>
            )}
            <button
              className="button secondary"
              onClick={() => void startQwenDownload()}
              disabled={qwenModelInstalled || qwenDownloadBusy || ["pending", "running", "paused"].includes(qwenDownloadStatus)}
            >
              <Download size={18} /> {qwenModelInstalled ? "Qwen 4B ready" : "Download Qwen 4B"}
            </button>
            {["pending", "running", "paused"].includes(qwenDownloadStatus) && (
              <button className="button ghost" onClick={() => void cancelQwenDownload()} disabled={qwenDownloadBusy}>Cancel Qwen download</button>
            )}
          </>
        )}
        <button className="button secondary" onClick={() => fileInput.current?.click()}>
          <FileUp size={18} /> Import file
        </button>
        <button className="button ghost" onClick={exportJournal} disabled={!data.journal.length}>
          <Download size={18} /> Export
        </button>
        <div className="topbar-menu" ref={journalMenuRef}>
          <button
            className="topbar-menu-trigger"
            onClick={() => setJournalMenuOpen((open) => !open)}
            aria-label="More journal options"
            aria-haspopup="menu"
            aria-expanded={journalMenuOpen}
          >
            <MoreVertical size={20} />
          </button>
          {journalMenuOpen ? (
            <div className="topbar-menu-popover journal-actions-menu" role="menu">
              <button
                role="menuitem"
                disabled={historyLoading}
                onClick={() => {
                  setJournalMenuOpen(false);
                  void importBundledHistory();
                }}
              >
                <Sparkles size={18} />
                <span>
                  <strong>{historyLoading ? "Adding history…" : "Add supplied history"}</strong>
                  <small>Import the original meditation journal</small>
                </span>
              </button>
            </div>
          ) : null}
        </div>
        <input ref={fileInput} hidden type="file" accept=".json,.txt,.md" onChange={importFile} />
      </div>
      {importMessage && <p className="status-message">{importMessage}</p>}
      {voiceMessage && <p className="status-message">{voiceMessage}</p>}
      {qwenMessage && <p className="status-message">{qwenMessage}</p>}
      {isNativeAndroid() && whisperDownloadTotalBytes > 0 && !whisperModelInstalled && (
        <p className="status-message">
          Whisper download: {Math.round((whisperDownloadBytes / whisperDownloadTotalBytes) * 100)}% ({Math.round(whisperDownloadBytes / 1_048_576)} / {Math.round(whisperDownloadTotalBytes / 1_048_576)} MB)
        </p>
      )}
      {isNativeAndroid() && qwenDownloadTotalBytes > 0 && !qwenModelInstalled && (
        <p className="status-message">
          Qwen 4B download: {Math.round((qwenDownloadBytes / qwenDownloadTotalBytes) * 100)}% ({Math.round(qwenDownloadBytes / 1_048_576)} / {Math.round(qwenDownloadTotalBytes / 1_048_576)} MB)
        </p>
      )}

      {editorMode === "meditation" && (
        <section className="card journal-editor practice-log-editor">
          <div className="section-row">
            <div>
              <span className="eyebrow">Offline practice</span>
              <h2>Give it a place in your dojo</h2>
            </div>
            <CalendarDays />
          </div>
          <label>
            What did you do?
            <select value={selectedMeditation} onChange={(event) => setSelectedMeditation(event.target.value)}>
              <option value="">Choose a Zen Chad practice</option>
              {MEDITATIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              <option value="custom">Something else</option>
            </select>
          </label>
          {selectedMeditation === "custom" && (
            <input value={customPractice} onChange={(event) => setCustomPractice(event.target.value)} placeholder="Practice name (e.g. TRIPP: Cosmic Flow)" />
          )}
          <div className="form-grid two-col">
            <label>
              Where?
              <input value={practiceSource} onChange={(event) => setPracticeSource(event.target.value)} placeholder="TRIPP, retreat, offline…" />
            </label>
            <label>
              Minutes
              <input type="number" min="1" max="600" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
            </label>
          </div>
          <label>
            Date
            <input type="date" value={practiceDate} onChange={(event) => setPracticeDate(event.target.value)} />
          </label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reflection title (optional)" />
          <textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Optional: what did you notice? Adding a reflection earns an extra +20 XP." />
          <div className="editor-actions">
            <button className="button primary" onClick={saveMeditationLog} disabled={!selectedMeditation || (selectedMeditation === "custom" && !customPractice.trim())}>
              <Save size={18} /> Log practice
            </button>
            <button className="button ghost" onClick={closeEditor}>Cancel</button>
          </div>
        </section>
      )}

      {editorMode === "journal" && (
        <section className="card journal-editor">
          {meditationLabel && <span className="eyebrow">{meditationLabel} · post-session reflection</span>}
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" aria-label="Journal entry title" />
          <textarea autoFocus rows={9} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What was present before? What do you notice now? What would make the next session easier?" />
          <div className="editor-actions">
            <button className="button primary" onClick={saveEntry} disabled={!body.trim() || voiceRecording || voiceBusy}><Save size={18} /> Save journal · +20 XP</button>
            {qwenModelInstalled && !voiceRecording && !voiceBusy && body.trim() && (
              <button className="button secondary" onClick={() => void organizeWithQwen()} disabled={qwenBusy}>
                <Sparkles size={18} /> {qwenBusy ? "Creating neat draft…" : "Create neat draft"}
              </button>
            )}
            {rawDraftForRestore !== null && <button className="button ghost" onClick={restoreRawDraft}>Restore raw transcript</button>}
            {!voiceRecording && !voiceBusy && <button className="button ghost" onClick={closeEditor}>Cancel</button>}
          </div>
        </section>
      )}

      {!data.journal.length && !editorMode ? (
        <section className="empty-state card">
          <BookOpen />
          <h2>No entries yet</h2>
          <p>Log a practice or write a reflection in your own words.</p>
        </section>
      ) : (
        <div className="journal-list">
          {data.journal.map((entry) => (
            <article className="card journal-entry" key={entry.id}>
              <div className="section-row">
                <div>
                  <span className="eyebrow">{new Date(entry.createdAt).toLocaleDateString()} · {entry.kind === "meditation" ? "Meditation" : "Journal"}</span>
                  <h3>{entry.title}</h3>
                </div>
                <button className="icon-button danger" aria-label={`Delete ${entry.title}`} onClick={() => setData((current) => ({ ...current, journal: current.journal.filter((item) => item.id !== entry.id) }))}>
                  <Trash2 size={18} />
                </button>
              </div>
              <p>{entry.body}</p>
              {entry.meditation && <small className="journal-entry-meta">{entry.meditation}</small>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
