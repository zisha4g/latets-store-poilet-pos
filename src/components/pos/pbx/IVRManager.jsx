import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, GripVertical, Type, Upload, Mic, Square, Loader2, Pause, Play, RotateCcw, Check, Volume2, VolumeX } from 'lucide-react';

const PROMPT_SOURCES = [
  { id: 'text', label: 'Type the prompt', icon: Type },
  { id: 'upload', label: 'Upload audio', icon: Upload },
  { id: 'record', label: 'Record audio', icon: Mic },
];

const VOICES = [
  { id: 'woman', label: 'Default — Woman' },
  { id: 'man', label: 'Default — Man' },
  { id: 'alice', label: 'Alice (clear, friendly)' },
  { id: 'Polly.Joanna', label: 'Polly Joanna (US, female)' },
  { id: 'Polly.Matthew', label: 'Polly Matthew (US, male)' },
  { id: 'Polly.Salli', label: 'Polly Salli (US, female)' },
];

const RATES = [
  { id: 'x-slow', label: 'Very slow' },
  { id: 'slow', label: 'Slow' },
  { id: 'medium', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
  { id: 'x-fast', label: 'Very fast' },
];

// Browser dictation button (Web Speech API — Chrome/Edge). On Windows the
// OS Win+H shortcut can't be invoked from a web page, so this provides
// equivalent in-page dictation that writes straight into the textarea.
const DictationButton = ({ text, onChange, focusTargetId }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseTextRef = useRef('');
  const manualStopRef = useRef(false);

  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SpeechRecognition;

  useEffect(() => () => {
    manualStopRef.current = true;
    try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
  }, []);

  const buildRecognizer = () => {
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      if (finalChunk) baseTextRef.current += finalChunk + ' ';
      onChange((baseTextRef.current + interimChunk).trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      manualStopRef.current = true;
      setListening(false);
      const friendly = {
        'not-allowed': 'Microphone permission was blocked. Click the lock icon in the address bar to allow it, then try again.',
        'audio-capture': 'No microphone was found.',
        'network': 'Browser dictation needs internet (Chrome sends audio to Google). Check your connection or press Win+H to use Windows dictation instead.',
        'service-not-allowed': 'Browser blocked the dictation service.',
      }[e.error] || e.error || 'Microphone access failed.';
      toast({ title: 'Dictation error', description: friendly, variant: 'destructive' });
    };
    rec.onend = () => {
      // Chrome ends recognition after silence even with continuous=true.
      // Auto-restart until the user explicitly clicks Stop.
      if (!manualStopRef.current) {
        try { rec.start(); return; } catch { /* fall through */ }
      }
      setListening(false);
    };
    return rec;
  };

  const startDictation = () => {
    if (!supported) {
      toast({
        title: 'Dictation not supported',
        description: 'Your browser does not support speech recognition. Use Chrome or Edge, or press Win+H to use Windows dictation.',
        variant: 'destructive',
      });
      return;
    }
    if (focusTargetId) {
      const el = document.getElementById(focusTargetId);
      el?.focus();
      if (el && typeof el.setSelectionRange === 'function') {
        const len = (el.value || '').length;
        try { el.setSelectionRange(len, len); } catch { /* noop */ }
      }
    }
    baseTextRef.current = text ? text.replace(/\s+$/, '') + ' ' : '';
    manualStopRef.current = false;
    const rec = buildRecognizer();
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); }
    catch (err) {
      toast({ title: 'Could not start dictation', description: err.message, variant: 'destructive' });
    }
  };

  const stopDictation = () => {
    manualStopRef.current = true;
    try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
    setListening(false);
  };

  return (
    <button
      type="button"
      onClick={listening ? stopDictation : startDictation}
      title={supported ? (listening ? 'Stop dictation' : 'Speak to type') : 'Dictation not supported in this browser'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        listening
          ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
          : 'bg-background border-border hover:bg-muted text-muted-foreground'
      } ${!supported ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {listening ? (
        <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Stop dictating</>
      ) : (
        <><Mic className="w-3.5 h-3.5" /> Speak to type</>
      )}
    </button>
  );
};

const PromptEditor = ({ menu, audioFiles, audioHandlers, value, onChange }) => {
  const initialSource = menu?.prompt_text ? 'text' : (menu?.prompt_audio_id ? 'upload' : 'text');
  const [source, setSource] = useState(initialSource);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [recordingName, setRecordingName] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [browserVoices, setBrowserVoices] = useState([]);
  const [justSavedName, setJustSavedName] = useState('');
  const justSavedTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  const set = (patch) => onChange({ ...value, ...patch });

  const uploadBlob = async (blob, suggestedName) => {
    if (!audioHandlers?.add) {
      toast({ title: 'Upload not available', variant: 'destructive' });
      return null;
    }
    setUploading(true);
    try {
      const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
      const file = new File([blob], `${suggestedName || 'ivr-prompt'}.${ext}`, { type: blob.type });
      const row = await audioHandlers.add(file, suggestedName || file.name);
      if (row?.id) set({ prompt_audio_id: row.id, prompt_text: '' });
      toast({ title: '✓ Saved & selected' });
      return row;
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadBlob(file, file.name.replace(/\.[^.]+$/, ''));
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
  };
  const stopTimer = () => clearInterval(timerRef.current);

  const defaultRecordingName = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `Recording ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const startRecording = async () => {
    // Reset any previous preview before starting again.
    if (previewUrl) { URL.revokeObjectURL(previewUrl); }
    setPreviewBlob(null);
    setPreviewUrl('');
    setElapsed(0);
    setPaused(false);
    if (!recordingName) setRecordingName(defaultRecordingName());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stopTimer();
        try { stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setRecording(false);
        setPaused(false);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      startTimer();
    } catch (e) {
      toast({ title: 'Microphone blocked', description: e.message, variant: 'destructive' });
    }
  };

  const pauseRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;
    mr.pause();
    stopTimer();
    setPaused(true);
  };

  const resumeRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'paused') return;
    mr.resume();
    startTimer();
    setPaused(false);
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
  };

  const discardPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl('');
    setElapsed(0);
  };

  const savePreview = async () => {
    if (!previewBlob) return;
    const name = (recordingName || defaultRecordingName()).trim();
    const row = await uploadBlob(previewBlob, name);
    if (row?.id) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(null);
      setPreviewUrl('');
      setElapsed(0);
      setRecordingName('');
      setJustSavedName(row.name || name);
      clearTimeout(justSavedTimerRef.current);
      justSavedTimerRef.current = setTimeout(() => setJustSavedName(''), 4000);
    }
  };

  const startRename = (file) => {
    setRenameId(file.id);
    setRenameValue(file.name || '');
  };
  const cancelRename = () => { setRenameId(null); setRenameValue(''); };
  const saveRename = async () => {
    if (!audioHandlers?.rename || !renameId) { cancelRename(); return; }
    const trimmed = (renameValue || '').trim();
    if (!trimmed) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    try {
      await audioHandlers.rename(renameId, trimmed);
      toast({ title: 'Renamed' });
      cancelRename();
    } catch (e) {
      toast({ title: 'Rename failed', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => () => {
    stopTimer();
    clearTimeout(justSavedTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  };

  // Load browser voices (some browsers populate them async via 'voiceschanged').
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    const load = () => setBrowserVoices(window.speechSynthesis.getVoices() || []);
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const pickBrowserVoice = (voiceId) => {
    const list = browserVoices;
    if (!list.length) return null;
    const en = list.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : list;
    // Map our voice options to gender hints + name preferences.
    const id = (voiceId || 'woman').toLowerCase();
    const female = /^(woman|alice|polly\.joanna|polly\.salli|polly\.kendra|polly\.kimberly|polly\.ivy)$/.test(id);
    const male = /^(man|polly\.matthew|polly\.justin|polly\.kevin|polly\.joey)$/.test(id);
    const namePreferences = {
      'polly.joanna': /joanna|samantha|zira|jenny|aria/i,
      'polly.salli': /salli|allison|samantha/i,
      'polly.matthew': /matthew|guy|david|alex/i,
      alice: /samantha|karen|moira|alice/i,
      woman: /female|samantha|zira|karen|victoria|susan|aria|jenny/i,
      man: /male|david|mark|alex|fred|guy|tony/i,
    };
    const pref = namePreferences[id];
    if (pref) {
      const m = pool.find((v) => pref.test(v.name));
      if (m) return m;
    }
    if (female) {
      const m = pool.find((v) => /female|samantha|zira|karen|victoria|susan|aria|jenny|joanna|salli/i.test(v.name));
      if (m) return m;
    }
    if (male) {
      const m = pool.find((v) => /male|david|mark|alex|fred|guy|tony|matthew/i.test(v.name));
      if (m) return m;
    }
    return pool[0];
  };

  const rateToFloat = (rate) => {
    switch (rate) {
      case 'x-slow': return 0.6;
      case 'slow': return 0.8;
      case 'fast': return 1.25;
      case 'x-fast': return 1.5;
      default: return 1.0;
    }
  };

  const speakPreviewWith = (voiceId, rateId) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast({ title: 'Preview not supported in this browser', variant: 'destructive' });
      return;
    }
    const text = (value.prompt_text || '').trim();
    if (!text) return;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    const utter = new SpeechSynthesisUtterance(text);
    const v = pickBrowserVoice(voiceId);
    if (v) { utter.voice = v; utter.lang = v.lang; }
    utter.rate = rateToFloat(rateId);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const speakPreview = () => speakPreviewWith(value.prompt_voice || 'woman', value.prompt_rate || 'medium');

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    setSpeaking(false);
  };

  const selectedAudio = audioFiles.find((f) => f.id === value.prompt_audio_id);

  return (
    <div className="space-y-3">
      <Label>Welcome Prompt</Label>
      <div className="flex gap-2">
        {PROMPT_SOURCES.map((s) => {
          const Icon = s.icon;
          const active = source === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4" /> {s.label}
            </button>
          );
        })}
      </div>

      {source === 'text' && (
        <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Prompt text</Label>
            <DictationButton
              text={value.prompt_text || ''}
              onChange={(text) => set({ prompt_text: text, prompt_audio_id: '' })}
              focusTargetId="ivr-prompt-textarea"
            />
          </div>
          <Textarea
            id="ivr-prompt-textarea"
            rows={4}
            placeholder="e.g. Thanks for calling Acme Pizza. Press 1 to place an order. Press 2 to speak with someone."
            value={value.prompt_text || ''}
            onChange={(e) => set({ prompt_text: e.target.value, prompt_audio_id: '' })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Voice</Label>
              <Select
                value={value.prompt_voice || 'woman'}
                onValueChange={(v) => {
                  set({ prompt_voice: v });
                  if (speaking) speakPreviewWith(v, value.prompt_rate || 'medium');
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Speed</Label>
              <Select
                value={value.prompt_rate || 'medium'}
                onValueChange={(v) => {
                  set({ prompt_rate: v });
                  if (speaking) speakPreviewWith(value.prompt_voice || 'woman', v);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RATES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {speaking ? (
              <Button type="button" variant="outline" size="sm" onClick={stopSpeaking}>
                <VolumeX className="w-4 h-4 mr-1" /> Stop
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={speakPreview} disabled={!(value.prompt_text || '').trim()}>
                <Volume2 className="w-4 h-4 mr-1" /> Preview
              </Button>
            )}
          </div>
        </div>
      )}

      {source === 'upload' && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          {audioFiles.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Use one of your existing audio files</Label>
              <Select value={value.prompt_audio_id || ''} onValueChange={(v) => set({ prompt_audio_id: v, prompt_text: '' })}>
                <SelectTrigger><SelectValue placeholder="Select an audio file…" /></SelectTrigger>
                <SelectContent>
                  {audioFiles.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview of what will play */}
          {selectedAudio ? (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <Check className="w-3.5 h-3.5" /> Will play
                </span>
                {renameId === selectedAudio.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-[180px]">
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                      className="h-8"
                    />
                    <Button size="sm" variant="outline" onClick={saveRename}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={cancelRename}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-sm truncate">{selectedAudio.name}</span>
                    {audioHandlers?.rename && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startRename(selectedAudio)} title="Rename">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              <audio controls src={selectedAudio.file_url} className="w-full h-9" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Pick an audio above or upload a new file below.</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Upload new file
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg" className="hidden" onChange={handleFile} />
          </div>
        </div>
      )}

      {source === 'record' && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          {/* Selected card (same as upload) so the user can see what's currently the prompt */}
          {selectedAudio && !recording && !previewBlob && (
            <div className={`rounded-lg border-2 p-3 space-y-2 ${justSavedName ? 'border-emerald-400 bg-emerald-50' : 'border-primary/40 bg-primary/5'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${justSavedName ? 'text-emerald-700' : 'text-primary'}`}>
                  <Check className="w-3.5 h-3.5" /> {justSavedName ? 'Saved & set as prompt' : 'Will play'}
                </span>
                <span className="font-medium text-sm truncate">{selectedAudio.name}</span>
              </div>
              <audio controls autoPlay={!!justSavedName} src={selectedAudio.file_url} className="w-full h-9" />
            </div>
          )}

          {/* Idle / pre-record */}
          {!recording && !previewBlob && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Recording name (optional)</Label>
                <Input
                  placeholder={defaultRecordingName()}
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={startRecording} disabled={uploading}>
                <Mic className="w-4 h-4 mr-1" /> Start recording
              </Button>
            </div>
          )}

          {/* Recording in progress */}
          {recording && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${paused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-sm font-medium">{paused ? 'Paused' : 'Recording'}</span>
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{fmtTime(elapsed)}</span>
              </span>
              {paused ? (
                <Button type="button" variant="outline" size="sm" onClick={resumeRecording}>
                  <Play className="w-4 h-4 mr-1" /> Resume
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={pauseRecording}>
                  <Pause className="w-4 h-4 mr-1" /> Pause
                </Button>
              )}
              <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
                <Square className="w-4 h-4 mr-1" /> Stop
              </Button>
            </div>
          )}

          {/* Preview after stop */}
          {!recording && previewBlob && (
            <div className="space-y-2 rounded-lg border-2 border-amber-300 bg-amber-50/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-700">Preview — not saved yet</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtTime(elapsed)}</span>
              </div>
              <audio controls src={previewUrl} className="w-full h-9" />
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  placeholder={defaultRecordingName()}
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" size="sm" onClick={savePreview} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Save & use as prompt
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { discardPreview(); startRecording(); }} disabled={uploading}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Re-record
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={discardPreview} disabled={uploading}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const IVRModal = ({ menu, onSave, onClose, audioFiles, audioHandlers, extensions, ivrMenus, flows = [] }) => {
  const [name, setName] = useState(menu?.name || '');
  const [prompt, setPrompt] = useState({
    prompt_text: menu?.prompt_text || '',
    prompt_voice: menu?.prompt_voice || 'woman',
    prompt_rate: menu?.prompt_rate || 'medium',
    prompt_audio_id: menu?.prompt_audio_id || '',
  });
  const [options, setOptions] = useState(menu?.options || []);

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    if (field === 'action_type') {
      newOptions[index].action_value = '';
    }
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, { key: '', action_type: '', action_value: '' }]);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };
  
  const handleSave = () => {
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    onSave({
      ...menu,
      name,
      prompt_audio_id: prompt.prompt_audio_id || null,
      prompt_text: prompt.prompt_audio_id ? null : (prompt.prompt_text || null),
      prompt_voice: prompt.prompt_audio_id ? null : (prompt.prompt_voice || null),
      prompt_rate: prompt.prompt_audio_id ? null : (prompt.prompt_rate || null),
      options,
    });
  };
  
  const renderActionValueInput = (option, index) => {
    switch (option.action_type) {
      case 'forward_to_extension':
        return (
          <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder="Select Extension" /></SelectTrigger>
            <SelectContent>{extensions.map(e => <SelectItem key={e.id} value={e.id}>{e.extension_number} - {e.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'go_to_menu':
        return (
          <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder="Select Menu" /></SelectTrigger>
            <SelectContent>{ivrMenus.filter(m => m.id !== menu.id).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'play_audio':
        return (
           <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder="Select Audio File" /></SelectTrigger>
            <SelectContent>{audioFiles.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'transfer_to_flow':
        return (
          <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder={flows.length ? 'Select Flow' : 'No flows yet — create one in Voice Ordering'} /></SelectTrigger>
            <SelectContent>{flows.map(f => <SelectItem key={f.id} value={f.id}>{f.is_primary ? '⭐ ' : ''}{f.name}{!f.is_active ? ' (off)' : ''}</SelectItem>)}</SelectContent>
          </Select>
        );
      default:
        return <Input disabled placeholder="Select an action type first" />;
    }
  };

  return (
    <DialogContent className="max-w-[95vw] sm:max-w-5xl w-full">
      <DialogHeader>
        <DialogTitle>{menu?.id ? 'Edit' : 'Create'} IVR Menu</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
        <div className="space-y-2">
          <Label htmlFor="ivr-name">Menu Name</Label>
          <Input id="ivr-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Main Menu" />
        </div>
        <PromptEditor
          menu={menu}
          audioFiles={audioFiles}
          audioHandlers={audioHandlers}
          value={prompt}
          onChange={setPrompt}
        />
        <div>
          <Label>Menu Options</Label>
          <div className="space-y-3 mt-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 p-3 border rounded-lg">
                <GripVertical className="w-5 h-5 text-muted-foreground" />
                <Input placeholder="Key" value={opt.key} onChange={e => handleOptionChange(i, 'key', e.target.value)} className="w-16" />
                <Select value={opt.action_type} onValueChange={val => handleOptionChange(i, 'action_type', val)}>
                  <SelectTrigger><SelectValue placeholder="Select Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forward_to_extension">Forward to Extension</SelectItem>
                    <SelectItem value="go_to_menu">Go to another IVR</SelectItem>
                    <SelectItem value="transfer_to_flow">Transfer to Voice Flow</SelectItem>
                    <SelectItem value="play_audio">Play Audio & Hang Up</SelectItem>
                    <SelectItem value="voicemail">Go to Voicemail</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-grow">{renderActionValueInput(opt, i)}</div>
                <Button variant="ghost" size="icon" onClick={() => removeOption(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" onClick={addOption} className="w-full">Add Option</Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save Menu</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const IVRManager = ({ ivrMenus, audioFiles, extensions, handlers, audioHandlers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [flows, setFlows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('voice-config', { body: { action: 'list_flows' } });
        if (!cancelled) setFlows(data?.flows || []);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (menu) => {
    try {
      if (menu.id) {
        await handlers.update(menu);
        toast({ title: 'Success', description: 'IVR Menu updated.' });
      } else {
        await handlers.add(menu);
        toast({ title: 'Success', description: 'IVR Menu created.' });
      }
      setIsModalOpen(false);
      setSelectedMenu(null);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this IVR menu?')) {
      try {
        await handlers.delete(id);
        toast({ title: 'Success', description: 'IVR Menu deleted.' });
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>IVR Menus</CardTitle>
          <CardDescription>Create and manage interactive voice response menus.</CardDescription>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedMenu({ options: [] })}>
              <Plus className="w-4 h-4 mr-2" /> Create IVR Menu
            </Button>
          </DialogTrigger>
          {isModalOpen && <IVRModal menu={selectedMenu} onSave={handleSave} onClose={() => setIsModalOpen(false)} audioFiles={audioFiles} audioHandlers={audioHandlers} extensions={extensions} ivrMenus={ivrMenus} flows={flows} />}
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <div className="grid grid-cols-3 font-semibold border-b bg-muted/50 p-3">
            <span>Name</span>
            <span>Prompt Audio</span>
            <span>Actions</span>
          </div>
          {ivrMenus.map(menu => (
            <div key={menu.id} className="grid grid-cols-3 items-center p-3 border-b last:border-b-0">
              <span className="font-medium">{menu.name}</span>
              <span className="text-muted-foreground">{audioFiles.find(f => f.id === menu.prompt_audio_id)?.name || 'None'}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => { setSelectedMenu(menu); setIsModalOpen(true); }}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => handleDelete(menu.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {ivrMenus.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No IVR menus created yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IVRManager;