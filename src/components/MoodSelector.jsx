import React from 'react';

const MOODS = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'sad', label: 'Melancholy', emoji: '😌' },
  { id: 'romantic', label: 'Romantic', emoji: '💕' },
  { id: 'adventurous', label: 'Adventurous', emoji: '🚀' },
  { id: 'cozy', label: 'Cozy', emoji: '☕' },
  { id: 'dark', label: 'Dark', emoji: '🌑' },
  { id: 'inspiring', label: 'Inspiring', emoji: '✨' },
];

export default function MoodSelector({ selectedMood, onMoodChange }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800 mb-3">🎧 Choose a mood</h3>
      <div className="flex flex-wrap gap-3">
        {MOODS.map(m => {
          const active = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onMoodChange(active ? null : m.id)}
              className={
                `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 inline-flex items-center gap-2 focus:outline-none ${active ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`
              }
              aria-pressed={active}
            >
              <span className="text-lg">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-slate-500">Pick a mood to get tailored recommendations. Click again to clear.</p>
    </div>
  );
}
