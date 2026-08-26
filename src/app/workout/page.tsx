'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dumbbell,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  BarChart2,
  Calendar,
  X,
  Edit3,
  RotateCcw,
  TrendingUp,
  Activity,
  Timer,
  Target,
  Zap,
  Shield,
  Wind,
  Footprints,
} from 'lucide-react';
import styles from './page.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Core'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Full Body'
  | 'Cardio'
  | 'Flexibility';

type Equipment = 'No Equipment' | 'Dumbbells' | 'Barbell' | 'Resistance Band' | 'Pull-up Bar' | 'Bench' | 'Kettlebell' | 'Machine' | 'Cable';

interface ExerciseSet {
  reps?: number;
  weight?: number; // kg
  duration?: number; // seconds
  completed: boolean;
}

interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  sets: ExerciseSet[];
  notes: string;
  restSeconds: number;
}

interface WorkoutSession {
  id: string;
  name: string;
  date: string; // ISO date "2025-08-26"
  dayOfWeek: number; // 0=Sun, 1=Mon ... 6=Sat
  exercises: WorkoutExercise[];
  durationMinutes: number;
  completed: boolean;
  completedAt?: string;
  notes: string;
  calories?: number;
}

interface WorkoutSchedule {
  dayOfWeek: number;
  label: string;
  sessionName: string;
  isRestDay: boolean;
}

// ── Preset Exercise Library ────────────────────────────────────────────────────

const EXERCISE_LIBRARY: { name: string; muscle: MuscleGroup; equipment: Equipment; defaultSets: number; defaultReps: number; defaultDuration?: number }[] = [
  // Chest
  { name: 'Push-ups', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 4, defaultReps: 15 },
  { name: 'Wide Push-ups', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Diamond Push-ups', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  { name: 'Incline Push-ups', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 3, defaultReps: 15 },
  { name: 'Decline Push-ups', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Pike Push-ups', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  { name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell', defaultSets: 4, defaultReps: 8 },
  { name: 'Dumbbell Fly', muscle: 'Chest', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Chest Dips', muscle: 'Chest', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  // Back
  { name: 'Pull-ups', muscle: 'Back', equipment: 'Pull-up Bar', defaultSets: 4, defaultReps: 8 },
  { name: 'Chin-ups', muscle: 'Back', equipment: 'Pull-up Bar', defaultSets: 3, defaultReps: 8 },
  { name: 'Inverted Rows', muscle: 'Back', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Superman Hold', muscle: 'Back', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Bent-over Row', muscle: 'Back', equipment: 'Dumbbells', defaultSets: 4, defaultReps: 10 },
  { name: 'Single-arm Dumbbell Row', muscle: 'Back', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', defaultSets: 4, defaultReps: 10 },
  { name: 'Deadlift', muscle: 'Back', equipment: 'Barbell', defaultSets: 4, defaultReps: 6 },
  // Shoulders
  { name: 'Pike Shoulder Press', muscle: 'Shoulders', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  { name: 'Lateral Raises', muscle: 'Shoulders', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 15 },
  { name: 'Front Raises', muscle: 'Shoulders', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell', defaultSets: 4, defaultReps: 8 },
  { name: 'Arnold Press', muscle: 'Shoulders', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 10 },
  { name: 'Face Pulls', muscle: 'Shoulders', equipment: 'Cable', defaultSets: 3, defaultReps: 15 },
  // Biceps
  { name: 'Bicep Curls', muscle: 'Biceps', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Hammer Curls', muscle: 'Biceps', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Resistance Band Curls', muscle: 'Biceps', equipment: 'Resistance Band', defaultSets: 3, defaultReps: 15 },
  { name: 'Concentration Curl', muscle: 'Biceps', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 10 },
  // Triceps
  { name: 'Tricep Dips', muscle: 'Triceps', equipment: 'No Equipment', defaultSets: 3, defaultReps: 15 },
  { name: 'Diamond Push-ups', muscle: 'Triceps', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  { name: 'Skull Crushers', muscle: 'Triceps', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Overhead Tricep Extension', muscle: 'Triceps', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 12 },
  { name: 'Tricep Pushdown', muscle: 'Triceps', equipment: 'Cable', defaultSets: 3, defaultReps: 12 },
  // Core
  { name: 'Plank', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 60 },
  { name: 'Side Plank', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 30 },
  { name: 'Crunches', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 20 },
  { name: 'Bicycle Crunches', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 20 },
  { name: 'Leg Raises', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 15 },
  { name: 'Mountain Climbers', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 20 },
  { name: 'Russian Twists', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 20 },
  { name: 'V-Ups', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 15 },
  { name: 'Hollow Body Hold', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 30 },
  { name: 'Dead Bug', muscle: 'Core', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  // Legs
  { name: 'Squats', muscle: 'Quads', equipment: 'No Equipment', defaultSets: 4, defaultReps: 20 },
  { name: 'Jump Squats', muscle: 'Quads', equipment: 'No Equipment', defaultSets: 3, defaultReps: 15 },
  { name: 'Bulgarian Split Squats', muscle: 'Quads', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Wall Sit', muscle: 'Quads', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 60 },
  { name: 'Lunges', muscle: 'Quads', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Walking Lunges', muscle: 'Quads', equipment: 'No Equipment', defaultSets: 3, defaultReps: 20 },
  { name: 'Romanian Deadlift', muscle: 'Hamstrings', equipment: 'Dumbbells', defaultSets: 4, defaultReps: 10 },
  { name: 'Good Mornings', muscle: 'Hamstrings', equipment: 'No Equipment', defaultSets: 3, defaultReps: 12 },
  { name: 'Nordic Curls', muscle: 'Hamstrings', equipment: 'No Equipment', defaultSets: 3, defaultReps: 8 },
  { name: 'Glute Bridges', muscle: 'Glutes', equipment: 'No Equipment', defaultSets: 4, defaultReps: 20 },
  { name: 'Hip Thrusts', muscle: 'Glutes', equipment: 'No Equipment', defaultSets: 4, defaultReps: 15 },
  { name: 'Donkey Kicks', muscle: 'Glutes', equipment: 'No Equipment', defaultSets: 3, defaultReps: 20 },
  { name: 'Calf Raises', muscle: 'Calves', equipment: 'No Equipment', defaultSets: 4, defaultReps: 25 },
  { name: 'Jump Rope (simulated)', muscle: 'Calves', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 60 },
  // Full Body
  { name: 'Burpees', muscle: 'Full Body', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  { name: 'Bear Crawls', muscle: 'Full Body', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 30 },
  { name: 'Turkish Get-ups', muscle: 'Full Body', equipment: 'No Equipment', defaultSets: 3, defaultReps: 5 },
  { name: 'Inchworm', muscle: 'Full Body', equipment: 'No Equipment', defaultSets: 3, defaultReps: 10 },
  { name: 'Thruster', muscle: 'Full Body', equipment: 'Dumbbells', defaultSets: 3, defaultReps: 10 },
  { name: 'Kettlebell Swing', muscle: 'Full Body', equipment: 'Kettlebell', defaultSets: 4, defaultReps: 15 },
  // Cardio
  { name: 'High Knees', muscle: 'Cardio', equipment: 'No Equipment', defaultSets: 3, defaultReps: 1, defaultDuration: 30 },
  { name: 'Jumping Jacks', muscle: 'Cardio', equipment: 'No Equipment', defaultSets: 3, defaultReps: 30 },
  { name: 'Box Jumps', muscle: 'Cardio', equipment: 'No Equipment', defaultSets: 4, defaultReps: 10 },
  { name: 'Sprint Intervals', muscle: 'Cardio', equipment: 'No Equipment', defaultSets: 6, defaultReps: 1, defaultDuration: 20 },
  // Flexibility
  { name: 'Downward Dog', muscle: 'Flexibility', equipment: 'No Equipment', defaultSets: 1, defaultReps: 1, defaultDuration: 60 },
  { name: 'Child\'s Pose', muscle: 'Flexibility', equipment: 'No Equipment', defaultSets: 1, defaultReps: 1, defaultDuration: 60 },
  { name: 'Hip Flexor Stretch', muscle: 'Flexibility', equipment: 'No Equipment', defaultSets: 2, defaultReps: 1, defaultDuration: 30 },
  { name: 'World\'s Greatest Stretch', muscle: 'Flexibility', equipment: 'No Equipment', defaultSets: 2, defaultReps: 5 },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full Body', 'Cardio', 'Flexibility'];
const EQUIPMENT_LIST: Equipment[] = ['No Equipment', 'Dumbbells', 'Barbell', 'Resistance Band', 'Pull-up Bar', 'Bench', 'Kettlebell', 'Machine', 'Cable'];

const STORAGE_KEY = 'life-os-workouts-v1';
const SCHEDULE_KEY = 'life-os-workout-schedule-v1';

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getTodayDow() {
  return new Date().getDay();
}

function muscleGroupIcon(mg: MuscleGroup) {
  switch (mg) {
    case 'Chest': return <Shield size={12} />;
    case 'Back': return <Target size={12} />;
    case 'Core': return <Zap size={12} />;
    case 'Cardio': return <Activity size={12} />;
    case 'Flexibility': return <Wind size={12} />;
    case 'Calves': return <Footprints size={12} />;
    default: return <Dumbbell size={12} />;
  }
}

// ── Main Workout Page ─────────────────────────────────────────────────────────

export default function WorkoutPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [schedule, setSchedule] = useState<WorkoutSchedule[]>([
    { dayOfWeek: 0, label: 'Sunday', sessionName: '', isRestDay: true },
    { dayOfWeek: 1, label: 'Monday', sessionName: 'Upper Body', isRestDay: false },
    { dayOfWeek: 2, label: 'Tuesday', sessionName: 'Lower Body', isRestDay: false },
    { dayOfWeek: 3, label: 'Wednesday', sessionName: '', isRestDay: true },
    { dayOfWeek: 4, label: 'Thursday', sessionName: 'Push', isRestDay: false },
    { dayOfWeek: 5, label: 'Friday', sessionName: 'Pull & Core', isRestDay: false },
    { dayOfWeek: 6, label: 'Saturday', sessionName: '', isRestDay: true },
  ]);
  const [activeTab, setActiveTab] = useState<'today' | 'log' | 'schedule' | 'library'>('today');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<MuscleGroup | 'All'>('All');
  const [librarySearch, setLibrarySearch] = useState('');

  // New session form
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDuration, setNewSessionDuration] = useState('45');
  const [newSessionDate, setNewSessionDate] = useState(getToday());

  // Add exercise form
  const [exSearch, setExSearch] = useState('');
  const [exMuscle, setExMuscle] = useState<MuscleGroup | 'All'>('All');
  const [exEquipment, setExEquipment] = useState<Equipment | 'All'>('All');
  const [customExName, setCustomExName] = useState('');
  const [customExMuscle, setCustomExMuscle] = useState<MuscleGroup>('Full Body');
  const [customExEquipment, setCustomExEquipment] = useState<Equipment>('No Equipment');
  const [customExSets, setCustomExSets] = useState('3');
  const [customExReps, setCustomExReps] = useState('10');
  const [customExDuration, setCustomExDuration] = useState('');
  const [addMode, setAddMode] = useState<'library' | 'custom'>('library');

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSessions(JSON.parse(raw));
      const rawSched = localStorage.getItem(SCHEDULE_KEY);
      if (rawSched) setSchedule(JSON.parse(rawSched));
    } catch {/* ignore */}
  }, []);

  // Save
  const persistSessions = useCallback((data: WorkoutSession[]) => {
    setSessions(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const persistSchedule = useCallback((data: WorkoutSchedule[]) => {
    setSchedule(data);
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data));
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const todayStr = getToday();
  const todayDow = getTodayDow();
  const todaySession = sessions.find((s) => s.date === todayStr);
  const todaySchedule = schedule[todayDow];
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // Weekly streak: how many days this week had a completed workout
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const weeklyCompleted = sessions.filter((s) => {
    const d = new Date(s.date);
    return s.completed && d >= startOfWeek;
  }).length;

  // Total workouts ever
  const totalCompleted = sessions.filter((s) => s.completed).length;

  // Total volume this week (sets × reps)
  const weeklyVolume = sessions
    .filter((s) => {
      const d = new Date(s.date);
      return s.completed && d >= startOfWeek;
    })
    .reduce((acc, s) => {
      return acc + s.exercises.reduce((eAcc, ex) => {
        return eAcc + ex.sets.reduce((sAcc, set) => sAcc + (set.reps ?? 0), 0);
      }, 0);
    }, 0);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    const d = new Date(newSessionDate);
    const session: WorkoutSession = {
      id: genId(),
      name: newSessionName.trim(),
      date: newSessionDate,
      dayOfWeek: d.getDay(),
      exercises: [],
      durationMinutes: parseInt(newSessionDuration) || 45,
      completed: false,
      notes: '',
    };
    const updated = [session, ...sessions];
    persistSessions(updated);
    setActiveSessionId(session.id);
    setActiveTab('today');
    setShowNewSessionModal(false);
    setNewSessionName('');
    setNewSessionDuration('45');
    setNewSessionDate(getToday());
  };

  const handleAddExerciseFromLibrary = (preset: typeof EXERCISE_LIBRARY[0]) => {
    if (!activeSessionId) return;
    const exercise: WorkoutExercise = {
      id: genId(),
      name: preset.name,
      muscleGroup: preset.muscle,
      equipment: preset.equipment,
      sets: Array.from({ length: preset.defaultSets }, () => ({
        reps: preset.defaultReps,
        duration: preset.defaultDuration,
        completed: false,
      })),
      notes: '',
      restSeconds: 60,
    };
    const updated = sessions.map((s) =>
      s.id === activeSessionId ? { ...s, exercises: [...s.exercises, exercise] } : s
    );
    persistSessions(updated);
    setShowAddExerciseModal(false);
    setExSearch('');
  };

  const handleAddCustomExercise = () => {
    if (!customExName.trim() || !activeSessionId) return;
    const sets = parseInt(customExSets) || 3;
    const reps = parseInt(customExReps) || 10;
    const dur = parseInt(customExDuration) || undefined;
    const exercise: WorkoutExercise = {
      id: genId(),
      name: customExName.trim(),
      muscleGroup: customExMuscle,
      equipment: customExEquipment,
      sets: Array.from({ length: sets }, () => ({
        reps: dur ? undefined : reps,
        duration: dur,
        completed: false,
      })),
      notes: '',
      restSeconds: 60,
    };
    const updated = sessions.map((s) =>
      s.id === activeSessionId ? { ...s, exercises: [...s.exercises, exercise] } : s
    );
    persistSessions(updated);
    setShowAddExerciseModal(false);
    setCustomExName('');
    setCustomExSets('3');
    setCustomExReps('10');
    setCustomExDuration('');
  };

  const handleToggleSet = (sessionId: string, exerciseId: string, setIdx: number) => {
    const updated = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set, i) =>
              i === setIdx ? { ...set, completed: !set.completed } : set
            ),
          };
        }),
      };
    });
    persistSessions(updated);
  };

  const handleUpdateSetReps = (sessionId: string, exerciseId: string, setIdx: number, value: number) => {
    const updated = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set, i) => i === setIdx ? { ...set, reps: value } : set),
          };
        }),
      };
    });
    persistSessions(updated);
  };

  const handleUpdateSetWeight = (sessionId: string, exerciseId: string, setIdx: number, value: number) => {
    const updated = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set, i) => i === setIdx ? { ...set, weight: value } : set),
          };
        }),
      };
    });
    persistSessions(updated);
  };

  const handleUpdateSetDuration = (sessionId: string, exerciseId: string, setIdx: number, value: number) => {
    const updated = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set, i) => i === setIdx ? { ...set, duration: value } : set),
          };
        }),
      };
    });
    persistSessions(updated);
  };

  const handleAddSet = (sessionId: string, exerciseId: string) => {
    const updated = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          const lastSet = ex.sets[ex.sets.length - 1] ?? {};
          return { ...ex, sets: [...ex.sets, { ...lastSet, completed: false }] };
        }),
      };
    });
    persistSessions(updated);
  };

  const handleRemoveSet = (sessionId: string, exerciseId: string, setIdx: number) => {
    const updated = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) };
        }),
      };
    });
    persistSessions(updated);
  };

  const handleRemoveExercise = (sessionId: string, exerciseId: string) => {
    const updated = sessions.map((s) =>
      s.id !== sessionId ? s : { ...s, exercises: s.exercises.filter((ex) => ex.id !== exerciseId) }
    );
    persistSessions(updated);
  };

  const handleCompleteWorkout = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id !== sessionId ? s : { ...s, completed: true, completedAt: new Date().toISOString() }
    );
    persistSessions(updated);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!confirm('Delete this workout session?')) return;
    const updated = sessions.filter((s) => s.id !== sessionId);
    persistSessions(updated);
    if (activeSessionId === sessionId) setActiveSessionId(null);
  };

  const handleUpdateSchedule = (dow: number, field: Partial<WorkoutSchedule>) => {
    const updated = schedule.map((s) => s.dayOfWeek === dow ? { ...s, ...field } : s);
    persistSchedule(updated);
  };

  // ── Filtered library ─────────────────────────────────────────────────────────

  const filteredLibrary = EXERCISE_LIBRARY.filter((ex) => {
    if (libraryFilter !== 'All' && ex.muscle !== libraryFilter) return false;
    if (librarySearch && !ex.name.toLowerCase().includes(librarySearch.toLowerCase())) return false;
    return true;
  });

  const filteredModalLibrary = EXERCISE_LIBRARY.filter((ex) => {
    if (exMuscle !== 'All' && ex.muscle !== exMuscle) return false;
    if (exEquipment !== 'All' && ex.equipment !== exEquipment) return false;
    if (exSearch && !ex.name.toLowerCase().includes(exSearch.toLowerCase())) return false;
    return true;
  });

  // ── Weekly Calendar ───────────────────────────────────────────────────────────

  const getWeekDates = () => {
    const now = new Date();
    const dow = now.getDay();
    return DAYS.map((label, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - dow + i);
      const dateStr = d.toISOString().split('T')[0];
      const hasSession = sessions.some((s) => s.date === dateStr && s.completed);
      return { label, dateStr, dayNum: d.getDate(), isToday: dateStr === todayStr, hasSession, dow: i };
    });
  };

  const weekDates = getWeekDates();

  // ── Session progress ──────────────────────────────────────────────────────────

  const getSessionProgress = (session: WorkoutSession) => {
    const totalSets = session.exercises.reduce((a, ex) => a + ex.sets.length, 0);
    const doneSets = session.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
    return { totalSets, doneSets, pct: totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0 };
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderExerciseCard = (session: WorkoutSession, ex: WorkoutExercise) => {
    const doneCount = ex.sets.filter((s) => s.completed).length;
    const isDurationBased = ex.sets.some((s) => s.duration != null);

    return (
      <div key={ex.id} className={styles.exerciseCard}>
        <div className={styles.exerciseHeader}>
          <div className={styles.exerciseMeta}>
            <span className={styles.muscleTag}>
              {muscleGroupIcon(ex.muscleGroup)}
              {ex.muscleGroup}
            </span>
            <span className={styles.equipTag}>{ex.equipment}</span>
          </div>
          <div className={styles.exerciseActions}>
            <span className={styles.setsProgress}>{doneCount}/{ex.sets.length} sets</span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => handleRemoveExercise(session.id, ex.id)}
              title="Remove exercise"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className={styles.exerciseName}>{ex.name}</div>

        {/* Sets Table */}
        <div className={styles.setsTable}>
          <div className={styles.setsTableHead}>
            <span>Set</span>
            {isDurationBased ? <span>Duration (sec)</span> : <span>Reps</span>}
            <span>Weight (kg)</span>
            <span>Done</span>
            <span></span>
          </div>
          {ex.sets.map((set, i) => (
            <div key={i} className={`${styles.setRow} ${set.completed ? styles.setDone : ''}`}>
              <span className={styles.setNum}>{i + 1}</span>
              {isDurationBased ? (
                <input
                  type="number"
                  className={styles.setInput}
                  value={set.duration ?? ''}
                  min={1}
                  onChange={(e) => handleUpdateSetDuration(session.id, ex.id, i, parseInt(e.target.value) || 0)}
                />
              ) : (
                <input
                  type="number"
                  className={styles.setInput}
                  value={set.reps ?? ''}
                  min={1}
                  onChange={(e) => handleUpdateSetReps(session.id, ex.id, i, parseInt(e.target.value) || 0)}
                />
              )}
              <input
                type="number"
                className={styles.setInput}
                value={set.weight ?? ''}
                min={0}
                step={0.5}
                placeholder="—"
                onChange={(e) => handleUpdateSetWeight(session.id, ex.id, i, parseFloat(e.target.value) || 0)}
              />
              <button
                type="button"
                className={`${styles.setCheck} ${set.completed ? styles.setCheckDone : ''}`}
                onClick={() => handleToggleSet(session.id, ex.id, i)}
              >
                {set.completed && <Check size={11} />}
              </button>
              <button
                type="button"
                className={styles.setRemoveBtn}
                onClick={() => handleRemoveSet(session.id, ex.id, i)}
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addSetBtn}
            onClick={() => handleAddSet(session.id, ex.id)}
          >
            <Plus size={11} /> Add Set
          </button>
        </div>
      </div>
    );
  };

  const renderSessionView = (session: WorkoutSession) => {
    const { totalSets, doneSets, pct } = getSessionProgress(session);
    const allDone = totalSets > 0 && doneSets === totalSets;

    return (
      <div className={styles.sessionView}>
        {/* Session Header */}
        <div className={styles.sessionViewHeader}>
          <div>
            <div className={styles.sessionViewTitle}>{session.name}</div>
            <div className={styles.sessionViewMeta}>
              <Clock size={12} /> {session.durationMinutes} min target
              <Calendar size={12} style={{ marginLeft: 12 }} /> {new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className={styles.sessionActions}>
            {session.completed ? (
              <span className={styles.completedBadge}><Check size={13} /> Completed</span>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${allDone ? styles.btnPrimary : styles.btnSecondary}`}
                onClick={() => handleCompleteWorkout(session.id)}
              >
                <Check size={14} /> Mark Complete
              </button>
            )}
            <button
              type="button"
              className={styles.btn}
              onClick={() => setShowAddExerciseModal(true)}
            >
              <Plus size={14} /> Add Exercise
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => handleDeleteSession(session.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={styles.progressBarWrap}>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.progressLabel}>{doneSets}/{totalSets} sets · {pct}%</span>
        </div>

        {/* Exercises */}
        {session.exercises.length === 0 ? (
          <div className={styles.emptyExercises}>
            <Dumbbell size={36} strokeWidth={1.2} />
            <p>No exercises yet.</p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setShowAddExerciseModal(true)}
            >
              <Plus size={14} /> Add First Exercise
            </button>
          </div>
        ) : (
          <div className={styles.exerciseList}>
            {session.exercises.map((ex) => renderExerciseCard(session, ex))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleRow}>
          <Dumbbell size={22} strokeWidth={1.8} className={styles.pageIcon} />
          <div>
            <h1 className={styles.pageTitle}>Workout Tracker</h1>
            <p className={styles.pageSubtitle}>Train. Track. Progress.</p>
          </div>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setShowNewSessionModal(true)}
        >
          <Plus size={15} /> New Workout
        </button>
      </div>

      {/* ── Weekly Stats Bar ── */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <Flame size={18} className={styles.statIcon} style={{ color: '#f97316' }} />
          <div className={styles.statValue}>{weeklyCompleted}</div>
          <div className={styles.statLabel}>This Week</div>
        </div>
        <div className={styles.statCard}>
          <TrendingUp size={18} className={styles.statIcon} style={{ color: '#22d3ee' }} />
          <div className={styles.statValue}>{totalCompleted}</div>
          <div className={styles.statLabel}>Total Sessions</div>
        </div>
        <div className={styles.statCard}>
          <BarChart2 size={18} className={styles.statIcon} style={{ color: '#a78bfa' }} />
          <div className={styles.statValue}>{weeklyVolume.toLocaleString()}</div>
          <div className={styles.statLabel}>Weekly Volume (reps)</div>
        </div>
        <div className={styles.statCard}>
          <Timer size={18} className={styles.statIcon} style={{ color: '#34d399' }} />
          <div className={styles.statValue}>
            {sessions.filter((s) => s.completed).reduce((a, s) => a + s.durationMinutes, 0)}
          </div>
          <div className={styles.statLabel}>Total Minutes</div>
        </div>
      </div>

      {/* ── Weekly Calendar Strip ── */}
      <div className={styles.weekStrip}>
        {weekDates.map(({ label, dayNum, isToday, hasSession, dateStr, dow }) => {
          const sched = schedule[dow];
          const sess = sessions.find((s) => s.date === dateStr);
          return (
            <button
              key={label}
              type="button"
              className={`${styles.weekDay} ${isToday ? styles.weekDayToday : ''} ${hasSession ? styles.weekDayDone : ''} ${sched?.isRestDay && !sess ? styles.weekDayRest : ''}`}
              onClick={() => {
                const s = sessions.find((s) => s.date === dateStr);
                if (s) {
                  setActiveSessionId(s.id);
                  setActiveTab('today');
                }
              }}
            >
              <span className={styles.weekDayLabel}>{label}</span>
              <span className={styles.weekDayNum}>{dayNum}</span>
              {hasSession && <span className={styles.weekDayDot} />}
              {sched?.isRestDay && !sess && <span className={styles.weekDayRestLabel}>Rest</span>}
              {sched?.sessionName && !sched.isRestDay && !sess && (
                <span className={styles.weekDayPlan}>{sched.sessionName}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {(['today', 'log', 'schedule', 'library'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'today' && <Activity size={14} />}
            {tab === 'log' && <BarChart2 size={14} />}
            {tab === 'schedule' && <Calendar size={14} />}
            {tab === 'library' && <Dumbbell size={14} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.tabContent}>

        {/* TODAY TAB */}
        {activeTab === 'today' && (
          <div>
            {activeSession ? (
              renderSessionView(activeSession)
            ) : todaySession ? (
              <div>
                <p className={styles.hint}>Tap to open today&apos;s session</p>
                {renderSessionView(todaySession)}
              </div>
            ) : (
              <div className={styles.noSessionToday}>
                <div className={styles.noSessionIcon}>
                  {todaySchedule?.isRestDay ? (
                    <Wind size={48} strokeWidth={1} />
                  ) : (
                    <Dumbbell size={48} strokeWidth={1} />
                  )}
                </div>
                <h2 className={styles.noSessionTitle}>
                  {todaySchedule?.isRestDay ? 'Rest Day' : `Today: ${todaySchedule?.sessionName || 'No session planned'}`}
                </h2>
                <p className={styles.noSessionSub}>
                  {todaySchedule?.isRestDay
                    ? 'Recovery is part of the program. Rest, hydrate, stretch.'
                    : 'Start a new workout session to begin tracking.'}
                </p>
                {!todaySchedule?.isRestDay && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLg}`}
                    onClick={() => {
                      setNewSessionName(todaySchedule?.sessionName || '');
                      setShowNewSessionModal(true);
                    }}
                  >
                    <Plus size={16} /> Start Today&apos;s Workout
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {activeTab === 'log' && (
          <div className={styles.logList}>
            {sessions.length === 0 ? (
              <div className={styles.emptyState}>
                <BarChart2 size={36} strokeWidth={1.2} />
                <p>No workout sessions logged yet.</p>
              </div>
            ) : (
              [...sessions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((s) => {
                  const { totalSets, doneSets, pct } = getSessionProgress(s);
                  return (
                    <div
                      key={s.id}
                      className={`${styles.logItem} ${s.completed ? styles.logItemDone : ''}`}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setActiveTab('today');
                      }}
                    >
                      <div className={styles.logItemLeft}>
                        <div className={styles.logItemName}>{s.name}</div>
                        <div className={styles.logItemMeta}>
                          <Calendar size={11} />
                          {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          <Clock size={11} style={{ marginLeft: 10 }} /> {s.durationMinutes}m
                          <Dumbbell size={11} style={{ marginLeft: 10 }} /> {s.exercises.length} exercises
                        </div>
                      </div>
                      <div className={styles.logItemRight}>
                        {s.completed ? (
                          <span className={styles.completedBadge}><Check size={11} /> Done</span>
                        ) : (
                          <span className={styles.pendingBadge}>{pct}%</span>
                        )}
                        <ChevronRight size={15} className={styles.logItemArrow} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className={styles.scheduleTab}>
            <div className={styles.scheduleHeader}>
              <h2 className={styles.sectionTitle}>Weekly Training Schedule</h2>
              <p className={styles.scheduleSubtitle}>Define your training split for each day of the week</p>
            </div>
            <div className={styles.scheduleGrid}>
              {schedule.map((day) => (
                <div key={day.dayOfWeek} className={`${styles.scheduleDay} ${day.isRestDay ? styles.scheduleDayRest : styles.scheduleDayActive}`}>
                  <div className={styles.scheduleDayLabel}>{day.label}</div>
                  <div className={styles.scheduleDayControls}>
                    <label className={styles.restToggle}>
                      <input
                        type="checkbox"
                        checked={day.isRestDay}
                        onChange={(e) => handleUpdateSchedule(day.dayOfWeek, { isRestDay: e.target.checked })}
                      />
                      Rest Day
                    </label>
                    {!day.isRestDay && (
                      <input
                        type="text"
                        className={styles.scheduleInput}
                        value={day.sessionName}
                        placeholder="e.g. Push, Pull, Legs, Upper..."
                        onChange={(e) => handleUpdateSchedule(day.dayOfWeek, { sessionName: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'library' && (
          <div className={styles.libraryTab}>
            <div className={styles.libraryHeader}>
              <h2 className={styles.sectionTitle}>Exercise Library</h2>
              <p className={styles.scheduleSubtitle}>{EXERCISE_LIBRARY.length} exercises · home & gym</p>
            </div>
            <div className={styles.libraryFilters}>
              <input
                type="text"
                className={styles.librarySearch}
                placeholder="Search exercises..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
              />
              <div className={styles.libraryMuscleFilters}>
                {(['All', ...MUSCLE_GROUPS] as const).map((mg) => (
                  <button
                    key={mg}
                    type="button"
                    className={`${styles.muscleFilterBtn} ${libraryFilter === mg ? styles.muscleFilterActive : ''}`}
                    onClick={() => setLibraryFilter(mg as MuscleGroup | 'All')}
                  >
                    {mg}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.libraryGrid}>
              {filteredLibrary.map((ex) => (
                <div key={ex.name} className={styles.libraryCard}>
                  <div className={styles.libraryCardName}>{ex.name}</div>
                  <div className={styles.libraryCardMeta}>
                    <span className={styles.muscleTag}>
                      {muscleGroupIcon(ex.muscle)}
                      {ex.muscle}
                    </span>
                    <span className={styles.equipTag}>{ex.equipment}</span>
                  </div>
                  <div className={styles.libraryCardStats}>
                    {ex.defaultSets}×{ex.defaultDuration ? `${ex.defaultDuration}s` : `${ex.defaultReps} reps`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── New Session Modal ── */}
      {showNewSessionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewSessionModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>New Workout Session</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setShowNewSessionModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Session Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Upper Body, Push Day, Full Body HIIT..."
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Date</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Duration Target (min)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={newSessionDuration}
                    min={5}
                    max={180}
                    onChange={(e) => setNewSessionDuration(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowNewSessionModal(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreateSession}>
                <Plus size={14} /> Create Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Exercise Modal ── */}
      {showAddExerciseModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddExerciseModal(false)}>
          <div className={`${styles.modal} ${styles.modalLg}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Exercise</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setShowAddExerciseModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className={styles.addModeTabs}>
              <button
                type="button"
                className={`${styles.addModeTab} ${addMode === 'library' ? styles.addModeTabActive : ''}`}
                onClick={() => setAddMode('library')}
              >
                Exercise Library
              </button>
              <button
                type="button"
                className={`${styles.addModeTab} ${addMode === 'custom' ? styles.addModeTabActive : ''}`}
                onClick={() => setAddMode('custom')}
              >
                Custom Exercise
              </button>
            </div>

            {addMode === 'library' ? (
              <div className={styles.modalBody}>
                <div className={styles.formRow}>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Search exercises..."
                    value={exSearch}
                    onChange={(e) => setExSearch(e.target.value)}
                    autoFocus
                  />
                  <select className={styles.formSelect} value={exMuscle} onChange={(e) => setExMuscle(e.target.value as MuscleGroup | 'All')}>
                    <option value="All">All Muscles</option>
                    {MUSCLE_GROUPS.map((mg) => <option key={mg} value={mg}>{mg}</option>)}
                  </select>
                  <select className={styles.formSelect} value={exEquipment} onChange={(e) => setExEquipment(e.target.value as Equipment | 'All')}>
                    <option value="All">All Equipment</option>
                    {EQUIPMENT_LIST.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div className={styles.exercisePickerList}>
                  {filteredModalLibrary.length === 0 ? (
                    <p className={styles.hint}>No exercises match your filters.</p>
                  ) : (
                    filteredModalLibrary.map((ex) => (
                      <button
                        key={ex.name}
                        type="button"
                        className={styles.exercisePickerItem}
                        onClick={() => handleAddExerciseFromLibrary(ex)}
                      >
                        <div className={styles.pickerName}>{ex.name}</div>
                        <div className={styles.pickerMeta}>
                          <span className={styles.muscleTag}>{ex.muscle}</span>
                          <span className={styles.equipTag}>{ex.equipment}</span>
                          <span className={styles.pickerSets}>
                            {ex.defaultSets}×{ex.defaultDuration ? `${ex.defaultDuration}s` : `${ex.defaultReps}`}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Exercise Name</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Incline Dumbbell Press..."
                    value={customExName}
                    onChange={(e) => setCustomExName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Muscle Group</label>
                    <select className={styles.formSelect} value={customExMuscle} onChange={(e) => setCustomExMuscle(e.target.value as MuscleGroup)}>
                      {MUSCLE_GROUPS.map((mg) => <option key={mg} value={mg}>{mg}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Equipment</label>
                    <select className={styles.formSelect} value={customExEquipment} onChange={(e) => setCustomExEquipment(e.target.value as Equipment)}>
                      {EQUIPMENT_LIST.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                    </select>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Number of Sets</label>
                    <input type="number" className={styles.formInput} value={customExSets} min={1} max={20} onChange={(e) => setCustomExSets(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Reps per Set</label>
                    <input type="number" className={styles.formInput} value={customExReps} min={1} onChange={(e) => setCustomExReps(e.target.value)} disabled={!!customExDuration} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Duration (sec, optional)</label>
                    <input type="number" className={styles.formInput} placeholder="e.g. 60" value={customExDuration} min={1} onChange={(e) => setCustomExDuration(e.target.value)} />
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowAddExerciseModal(false)}>Cancel</button>
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddCustomExercise} disabled={!customExName.trim()}>
                    <Plus size={14} /> Add Exercise
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
