/* eslint-disable react/prop-types */
import React from 'react';

// Minimal, curated mood groups (as requested)
// Each button represents a top-level mood category. The backend maps these
// moods to more specific query terms (see backend/routes/recommendations.js).
const MOODS = [
  { id: 'positive', label: 'Positive', emoji: '🌞', subtitle: 'Feel-good, uplifting, motivational' },
  { id: 'emotional', label: 'Emotional', emoji: '🌧️', subtitle: 'Sad, reflective, healing reads' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡', subtitle: 'Adventure, mystery, thrillers' },
  { id: 'calm', label: 'Calm', emoji: '🌙', subtitle: 'Dreamy, chill, thoughtful' },
  { id: 'tech', label: 'Tech', emoji: '💡', subtitle: 'Science, tech, creative non-fiction' },
  { id: 'feelgood', label: 'Feel-Good', emoji: '💖', subtitle: 'Hopeful, community, empathetic' }
];

export default function MoodSelector({ selectedMood, onMoodChange }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800 mb-3">🎧 Choose a mood</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {MOODS.map(m => {
          const active = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onMoodChange(active ? null : m.id)}
              className={
                `relative p-6 rounded-2xl text-left transition-all duration-200 focus:outline-none shadow-sm ${active ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-2xl scale-102' : 'bg-white text-slate-800 hover:shadow-lg'}`
              }
              aria-pressed={active}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{m.emoji}</div>
                <div>
                  <div className="font-semibold text-base">{m.label}</div>
                  {m.subtitle && <div className="text-xs opacity-80 mt-1">{m.subtitle}</div>}
                </div>
              </div>
              {active && (
                <span className="absolute top-3 right-3 w-4 h-4 bg-white rounded-full shadow-md" />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-slate-500">Pick a mood to get tailored recommendations.</p>
    </div>
  );
}
